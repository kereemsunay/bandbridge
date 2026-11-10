import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  StatusBar, PermissionsAndroid, Platform,
} from "react-native";
import { BandClient } from "./src/ble";
import { Health } from "./src/health";
import { Decoded } from "./src/protocol";

type Log = { t: string; msg: string };

export default function App() {
  const client = useRef(new BandClient()).current;
  const [status, setStatus] = useState("Bağlı değil");
  const [connected, setConnected] = useState(false);
  const [steps, setSteps] = useState(0);
  const [distance, setDistance] = useState(0);
  const [calories, setCalories] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const [healthOK, setHealthOK] = useState(false);

  const log = (msg: string) => {
    const t = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prev) => [...prev.slice(-19), { t, msg }]);
  };

  useEffect(() => {
    let alive = true;

    const boot = async () => {
      if (Platform.OS === "android") {
        const perms =
          Number(Platform.Version) >= 31
            ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
            : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
        await PermissionsAndroid.requestMultiple(perms as any);
      }

      const hc = await Health.init();
      if (alive) setHealthOK(hc);
      log(hc ? "Health Connect hazır" : "Health Connect izni yok");

      client.onStatus = (text, conn) => {
        if (!alive) return;
        setStatus(text);
        setConnected(conn);
        log(text);
      };

      client.onData = async (d: Decoded) => {
        if (d.kind === "totals") {
          setSteps(d.steps);
          setDistance(d.distance);
          setCalories(d.calories);
          log(`adım ${d.steps} · ${d.distance} m · ${d.calories} kcal`);
        } else if (d.kind === "steps") {
          log(`${d.buckets.length} saatlik adım bloğu`);
        } else if (d.kind === "hr") {
          log(`${d.samples.length} nabız kaydı`);
        } else if (d.kind === "sleep") {
          log(`uyku ${Math.round((d.end.getTime() - d.start.getTime()) / 60000)} dk`);
        }
        try {
          await Health.ingest(d);
        } catch (e: any) {
          log(`Health yazma hatası: ${e.message}`);
        }
      };

      client.start();
    };

    boot();
    return () => {
      alive = false;
    };
  }, [client]);

  const disconnect = async () => {
    await client.disconnect();
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>PBS163</Text>
        <Text style={s.sub}>HryFine yok. Reklam yok. Veri cihazında.</Text>

        <View style={s.card}>
          <View style={s.row}>
            <View style={[s.dot, { backgroundColor: connected ? "#22c55e" : "#9ca3af" }]} />
            <Text style={s.status}>{status}</Text>
          </View>
          <Text style={s.hint}>
            {healthOK ? "Health Connect'e yazılıyor" : "Health Connect izni bekleniyor"}
          </Text>
        </View>

        <View style={s.grid}>
          <Metric label="Adım" value={String(steps)} />
          <Metric label="Mesafe" value={`${distance} m`} />
          <Metric label="Kalori" value={`${calories}`} />
          <Metric label="Sağlık" value={healthOK ? "Açık" : "Kapalı"} />
        </View>

        <View style={s.buttons}>
          <TouchableOpacity style={[s.btn, s.primary]} onPress={() => client.syncNow()}>
            <Text style={s.primaryText}>Şimdi senkronize et</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.ghost]} onPress={connected ? disconnect : () => client.start()}>
            <Text style={s.ghostText}>{connected ? "Bırak" : "Bağlan"}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Günlük</Text>
          {logs.length === 0 ? (
            <Text style={s.log}>bekleniyor…</Text>
          ) : (
            logs.map((l, i) => (
              <Text key={i} style={s.log}>
                {l.t}  {l.msg}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.card, s.metric]}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f4f7" },
  content: { padding: 18, gap: 12 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827" },
  sub: { color: "#6b7280", marginTop: -6, marginBottom: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  status: { fontSize: 16, fontWeight: "600", color: "#111827" },
  hint: { color: "#6b7280", fontSize: 12, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { width: "47.5%", flexGrow: 1 },
  metricLabel: { color: "#6b7280", fontSize: 12 },
  metricValue: { color: "#111827", fontSize: 24, fontWeight: "700", marginTop: 4 },
  buttons: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primary: { backgroundColor: "#16a34a" },
  primaryText: { color: "#fff", fontWeight: "700" },
  ghost: { backgroundColor: "#e5e7eb" },
  ghostText: { color: "#111827", fontWeight: "600" },
  cardTitle: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  log: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11, color: "#6b7280" },
});
