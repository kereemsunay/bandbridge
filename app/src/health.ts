import { Platform } from "react-native";
import {
  initialize,
  requestPermission,
  insertRecords,
  Permission,
  SleepStageType,
} from "react-native-health-connect";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Decoded } from "./protocol";

const perms: Permission[] = [
  { accessType: "write", recordType: "Steps" },
  { accessType: "write", recordType: "HeartRate" },
  { accessType: "write", recordType: "SleepSession" },
  { accessType: "write", recordType: "ActiveCaloriesBurned" },
  { accessType: "write", recordType: "Distance" },
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

    if (d.kind === "totals") {
      const day = now.toISOString().slice(0, 10);
      const lastDay = await AsyncStorage.getItem("hc.day");
      let last = Number((await AsyncStorage.getItem("hc.steps")) ?? 0);
      let lastDist = Number((await AsyncStorage.getItem("hc.dist")) ?? 0);
      let lastCal = Number((await AsyncStorage.getItem("hc.cal")) ?? 0);
      if (lastDay !== day) {
        last = 0;
        lastDist = 0;
        lastCal = 0;
      }
      const delta = d.steps >= last ? d.steps - last : d.steps;
      const deltaDist = d.distance >= lastDist ? d.distance - lastDist : d.distance;
      const deltaCal = d.calories >= lastCal ? d.calories - lastCal : d.calories;
      if (delta <= 0 && deltaDist <= 0 && deltaCal <= 0) return;

      const start = (await AsyncStorage.getItem("hc.sampleStart")) ?? now.toISOString();
      let from = new Date(Math.max(new Date(start).getTime(), new Date(day).getTime()));
      if (from.getTime() >= now.getTime()) {
        from = new Date(now.getTime() - 60_000);
      }
      await insertRecords([
        {
          recordType: "Steps",
          count: delta,
          startTime: from.toISOString(),
          endTime: now.toISOString(),
        },
      ] as any);
      if (deltaDist > 0) {
        await insertRecords([
          {
            recordType: "Distance",
            distance: { value: deltaDist, unit: "meters" },
            startTime: from.toISOString(),
            endTime: now.toISOString(),
          },
        ] as any);
      }
      if (deltaCal > 0) {
        await insertRecords([
          {
            recordType: "ActiveCaloriesBurned",
            energy: { value: deltaCal / 1000, unit: "kilocalories" },
            startTime: from.toISOString(),
            endTime: now.toISOString(),
          },
        ] as any);
      }
      await AsyncStorage.setItem("hc.steps", String(d.steps));
      await AsyncStorage.setItem("hc.dist", String(d.distance));
      await AsyncStorage.setItem("hc.cal", String(d.calories));
      await AsyncStorage.setItem("hc.day", day);
      await AsyncStorage.setItem("hc.sampleStart", now.toISOString());
    }

    if (d.kind === "steps" && d.buckets.length) {
      await insertRecords(
        d.buckets.map((b) => ({
          recordType: "Steps",
          count: b.steps,
          startTime: b.start.toISOString(),
          endTime: new Date(b.start.getTime() + 15 * 60_000).toISOString(),
        })) as any
      );
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
  }
}
