import { Platform } from "react-native";
import {
  initialize,
  requestPermission,
  insertRecords,
  Permission,
  SleepStageType,
} from "react-native-health-connect";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Decoded, CALORIES_PER_KCAL } from "./protocol";

const perms: Permission[] = [
  { accessType: "write", recordType: "Steps" },
  { accessType: "write", recordType: "HeartRate" },
  { accessType: "write", recordType: "SleepSession" },
  { accessType: "write", recordType: "ActiveCaloriesBurned" },
  { accessType: "write", recordType: "Distance" },
  { accessType: "write", recordType: "OxygenSaturation" },
  { accessType: "write", recordType: "BloodPressure" },
  { accessType: "write", recordType: "BodyTemperature" },
  { accessType: "write", recordType: "ExerciseSession" },
];

export class Health {
  static ready = false;

  static async init(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    const ok = await initialize();
    if (!ok) return false;
    const granted = await requestPermission(perms);
    Health.ready = granted.length > 0;
    return Health.ready;
  }

  static async ingest(d: Decoded) {
    if (!Health.ready) return;
    const now = new Date();

    if (d.kind === "steps" && d.buckets.length) {
      // 15-min buckets carry their own date. They are the only reliable source:
      // the band's undated total (key 0C) can stay on yesterday's value.
      const byDay = new Map<string, typeof d.buckets>();
      for (const b of d.buckets) {
        const key = `${b.start.getFullYear()}-${String(b.start.getMonth() + 1).padStart(2, "0")}-${String(b.start.getDate()).padStart(2, "0")}`;
        const arr = byDay.get(key) ?? [];
        arr.push(b);
        byDay.set(key, arr);
      }
      for (const [day, buckets] of byDay) {
        const storeKey = `hc.buckets.${day}`;
        const raw = await AsyncStorage.getItem(storeKey);
        let seen: string[] = [];
        try {
          seen = raw ? JSON.parse(raw) : [];
        } catch {}
        const known = new Set(seen);
        const fresh = buckets.filter((b) => !known.has(b.start.toISOString()));
        if (!fresh.length) continue;
        await insertRecords(
          fresh.map((b) => ({
            recordType: "Steps",
            count: b.steps,
            startTime: b.start.toISOString(),
            endTime: new Date(b.start.getTime() + 15 * 60_000).toISOString(),
          })) as any
        );
        const withDistance = fresh.filter((b) => b.distance > 0);
        if (withDistance.length) {
          await insertRecords(
            withDistance.map((b) => ({
              recordType: "Distance",
              distance: { value: b.distance, unit: "meters" },
              startTime: b.start.toISOString(),
              endTime: new Date(b.start.getTime() + 15 * 60_000).toISOString(),
            })) as any
          );
        }
        const withCal = fresh.filter((b) => b.calories > 0);
        if (withCal.length) {
          await insertRecords(
            withCal.map((b) => ({
              recordType: "ActiveCaloriesBurned",
              energy: { value: b.calories / CALORIES_PER_KCAL, unit: "kilocalories" },
              startTime: b.start.toISOString(),
              endTime: new Date(b.start.getTime() + 15 * 60_000).toISOString(),
            })) as any
          );
        }
        fresh.forEach((b) => known.add(b.start.toISOString()));
        await AsyncStorage.setItem(storeKey, JSON.stringify([...known].slice(-400)));
      }
    }

    if (d.kind === "hr" && d.samples.length) {
      const key = d.date.toISOString().slice(0, 10);
      const seenRaw = await AsyncStorage.getItem(`hc.hr.${key}`);
      const seen = new Set<number>(seenRaw ? JSON.parse(seenRaw) : []);
      const fresh = d.samples.filter((s) => !seen.has(s.time.getTime()));
      if (fresh.length) {
        await insertRecords([
          {
            recordType: "HeartRate",
            samples: fresh.map((s) => ({
              time: s.time.toISOString(),
              beatsPerMinute: s.bpm,
            })),
          },
        ] as any);
        fresh.forEach((s) => seen.add(s.time.getTime()));
        await AsyncStorage.setItem(`hc.hr.${key}`, JSON.stringify([...seen].slice(-3000)));
      }
    }

    if (d.kind === "sleep") {
      const key = `hc.sleep.${d.start.toISOString().slice(0, 10)}`;
      if (await AsyncStorage.getItem(key)) return;
      const stages = [];
      if (d.deep > 0) {
        stages.push({
          startTime: d.start.toISOString(),
          endTime: new Date(d.start.getTime() + d.deep * 60_000).toISOString(),
          stage: SleepStageType.DEEP,
        });
      }
      if (d.light > 0) {
        const s = d.start.getTime() + d.deep * 60_000;
        stages.push({
          startTime: new Date(s).toISOString(),
          endTime: new Date(s + d.light * 60_000).toISOString(),
          stage: SleepStageType.LIGHT,
        });
      }
      await insertRecords([
        {
          recordType: "SleepSession",
          startTime: d.start.toISOString(),
          endTime: d.end.toISOString(),
          stages,
        },
      ] as any);
      await AsyncStorage.setItem(key, "1");
    }

    if (d.kind === "spo2") {
      const t = d.time.toISOString();
      if (await AsyncStorage.getItem(`hc.spo2.${t}`)) return;
      await insertRecords([{ recordType: "OxygenSaturation", percentage: d.percent, time: t }] as any);
      await AsyncStorage.setItem(`hc.spo2.${t}`, "1");
    }

    if (d.kind === "bp") {
      const t = d.time.toISOString();
      if (await AsyncStorage.getItem(`hc.bp.${t}`)) return;
      await insertRecords([
        {
          recordType: "BloodPressure",
          systolic: { value: d.systolic, unit: "millimetersOfMercury" },
          diastolic: { value: d.diastolic, unit: "millimetersOfMercury" },
          bodyPosition: 0,
          measurementLocation: 0,
          time: t,
        },
      ] as any);
      await AsyncStorage.setItem(`hc.bp.${t}`, "1");
    }

    if (d.kind === "temp") {
      const t = d.time.toISOString();
      if (await AsyncStorage.getItem(`hc.temp.${t}`)) return;
      await insertRecords([
        { recordType: "BodyTemperature", temperature: { value: d.celsius, unit: "celsius" }, time: t },
      ] as any);
      await AsyncStorage.setItem(`hc.temp.${t}`, "1");
    }

    if (d.kind === "workout") {
      const t = d.start.toISOString();
      if (await AsyncStorage.getItem(`hc.workout.${t}`)) return;
      await insertRecords([
        {
          recordType: "ExerciseSession",
          exerciseType: 0,
          title: "Antrenman",
          notes: `${d.steps} adım · ${(d.calories / 1000).toFixed(1)} kcal`,
          startTime: t,
          endTime: d.end.toISOString(),
        },
      ] as any);
      await AsyncStorage.setItem(`hc.workout.${t}`, "1");
    }
  }
}
