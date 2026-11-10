import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Modal, PermissionsAndroid, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BandClient } from "./src/ble";
import { Health } from "./src/health";
import { Decoded, CALORIES_PER_KCAL } from "./src/protocol";

const C = {
  ground: "#E7EBE2",
  ink: "#121814",
  muted: "#5A645C",
  rule: "#C3CABF",
  green: "#125B3B",
  paper: "#F3F5EC",
  red: "#9E3527",
};

const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

type Log = { t: string; msg: string };
type Phase = "idle" | "scanning" | "connecting" | "syncing" | "connected";

const fmt = (n: number) => n.toLocaleString("tr-TR");
const distance = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`;
const kcal = (c: number) => {
  const v = c / CALORIES_PER_KCAL;
  return v >= 10 ? fmt(Math.round(v)) : v.toFixed(1).replace(".", ",");
};
const clock = (d: Date) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const dayline = (d: Date) =>
  d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

const phaseOf = (text: string, connected: boolean): Phase => {
  if (text.includes("aranıyor")) return "scanning";
  if (text.includes("Bağlanıyor")) return "connecting";
  if (text.includes("Senkronize")) return "syncing";
  return connected ? "connected" : "idle";
};

function Screen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const client = useRef(new BandClient()).current;
  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState("Bağlı değil");
  const [phase, setPhase] = useState<Phase>("idle");
  const [connected, setConnected] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);
  const [dist, setDist] = useState<number | null>(null);
  const [cal, setCal] = useState<number | null>(null);
  const [hr, setHr] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [healthOK, setHealthOK] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const stampAnim = useRef(new Animated.Value(0)).current;

  const log = (msg: string) => {
    const t = clock(new Date());
    setLogs((prev) => [...prev.slice(-5), { t, msg }]);
  };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!lastSync) return;
    stampAnim.setValue(0);
    Animated.spring(stampAnim, {
      toValue: 1,
      tension: 130,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [lastSync, stampAnim]);

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
      if (!alive) return;
      setHealthOK(hc);

      client.onStatus = (text, conn) => {
        if (!alive) return;
        setStatus(text);
        setConnected(conn);
        setPhase(phaseOf(text, conn));
        if (conn) setCancelled(false);
        log(text.toLowerCase());
      };

      client.onData = async (d: Decoded) => {
        if (!alive) return;
        if (d.kind === "totals") {
          setSteps(d.steps);
          setDist(d.distance);
          setCal(d.calories);
          log(`${fmt(d.steps)} adım · ${distance(d.distance)}`);
        } else if (d.kind === "steps") {
          log(`${d.buckets.length} saatlik blok`);
        } else if (d.kind === "hr") {
          const last = d.samples[d.samples.length - 1];
          if (last) setHr(last.bpm);
          log(`${d.samples.length} nabız kaydı`);
        } else if (d.kind === "sleep") {
          setSleep(Math.round((d.end.getTime() - d.start.getTime()) / 60000));
          log("uyku kaydı");
        }
        try {
          await Health.ingest(d);
          if (d.kind === "totals") setLastSync(new Date());
          setError(null);
        } catch (e: any) {
          setError("Health'e yazılamadı");
          log(`health: ${e.message}`);
        }
      };

      client.start();
    };

    boot();
    return () => {
      alive = false;
    };
  }, [client]);

  const onSync = async () => {
    if (!connected) {
      setCancelled(false);
      client.start();
      if (phase === "idle") setPhase("scanning");
      return;
    }
    setError(null);
    setSyncing(true);
    try {
      await client.syncNow();
    } catch {
      setError("Senkron başlatılamadı");
    }
    setTimeout(() => setSyncing(false), 1500);
  };

  const cancelConnect = () => {
    client.cancel();
    setCancelled(true);
    setPhase("idle");
    log("bağlantı iptal edildi");
  };

  const detail =
    status === "Bağlı değil" || status === "Bağlandı" || status === "Bağlı" || status === "Bağlantı koptu"
      ? ""
      : status;

  const stampStyle = {
    opacity: stampAnim,
    transform: [
      { scale: stampAnim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] }) },
      { rotate: "-3.5deg" },
    ],
  };

  const showConnectSheet = !cancelled && (phase === "scanning" || phase === "connecting") && !help;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <View style={[s.cover, { paddingTop: insets.top + 14 }]}>
        <View style={s.coverInner}>
          <View style={s.topline}>
            <Text style={s.wordmark}>BANDBRIDGE</Text>
            <Text style={s.clock}>{clock(now)}</Text>
          </View>
          <View style={s.coverRule} />
          <Text style={s.date}>{dayline(now)}</Text>
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: connected ? C.paper : "rgba(243,245,236,0.45)" }]} />
            <Text style={s.statusWord}>{connected ? "BAĞLI" : "BAĞLI DEĞİL"}</Text>
            {detail ? <Text style={s.statusDetail} numberOfLines={1}>{detail}</Text> : null}
          </View>
        </View>
        {(phase === "scanning" || phase === "connecting" || phase === "syncing") && (
          <ProgressLine width={width} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.sheet} showsVerticalScrollIndicator={false}>
        <View style={s.sectionHead}>
          <Text style={s.label}>BUGÜN</Text>
          {lastSync && healthOK ? (
            <Animated.View style={[s.stamp, stampStyle]}>
              <Text style={s.stampMain}>SENKRON</Text>
              <Text style={s.stampSub}>{clock(lastSync)}</Text>
            </Animated.View>
          ) : (
            <Text style={s.pending}>{healthOK ? "BEKLEMEDE" : "SAĞLIK İZNİ YOK"}</Text>
          )}
        </View>

        <View style={s.table}>
          <Row label="Adım" value={steps === null ? "—" : fmt(steps)} />
          <Row label="Mesafe" value={dist === null ? "—" : distance(dist)} />
          <Row label="Kalori" value={cal === null ? "—" : `${kcal(cal)} kcal`} />
          <Row label="Nabız" value={hr === null ? "—" : `${hr} bpm`} />
          <Row
            label="Uyku"
            value={sleep === null ? "—" : `${Math.floor(sleep / 60)} sa ${sleep % 60} dk`}
            last
          />
        </View>

        <Pressable
          onPress={onSync}
          disabled={syncing}
          accessibilityRole="button"
          accessibilityLabel={connected ? "Senkronize et" : "Bağlan"}
          style={({ pressed }) => [
            s.button,
            { backgroundColor: syncing ? C.muted : pressed ? "#24332B" : C.ink },
          ]}
        >
          <Text style={s.buttonText}>
            {syncing || phase === "syncing"
              ? "SENKRONİZE EDİLİYOR"
              : connected
              ? "SENKRONİZE ET"
              : phase === "scanning"
              ? "ARANIYOR…"
              : phase === "connecting"
              ? "BAĞLANIYOR…"
              : "BAĞLAN"}
          </Text>
        </Pressable>

        <View style={s.footRow}>
          <Text style={[s.foot, { color: healthOK ? C.green : C.red }]}>
            HEALTH CONNECT · {healthOK ? "AÇIK" : "İZİN YOK"}
          </Text>
          <View style={s.footLinks}>
            {connected && (
              <Pressable onPress={() => client.disconnect()} hitSlop={10}>
                <Text style={s.footLink}>bağlantıyı kes</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setHelp(true)} hitSlop={10}>
              <Text style={s.footLink}>nasıl bağlanır?</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        <View style={s.logHead}>
          <Text style={s.label}>KAYIT</Text>
        </View>
        <View>
          {logs.length === 0 ? (
            <Text style={s.logEmpty}>Henüz kayıt yok. Saatini bağla.</Text>
          ) : (
            logs.map((l, i) => (
              <View key={`${l.t}-${i}`} style={s.logRow}>
                <Text style={s.logTime}>{l.t}</Text>
                <Text style={s.logMsg} numberOfLines={1}>{l.msg}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={showConnectSheet} animationType="fade" onRequestClose={cancelConnect}>
        <View style={s.backdrop}>
          <View style={[s.sheetPanel, { paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
            <Text style={s.panelLabel}>BAĞLANTI</Text>
            <Text style={s.panelTitle}>
              {phase === "connecting" ? "Bağlanıyor" : "Saat aranıyor"}
            </Text>
            <View style={s.panelLine}>
              <ProgressLine width={width - 44} dark />
            </View>
            <Steps />
            <Pressable onPress={cancelConnect} style={s.panelBtn}>
              <Text style={s.panelBtnText}>VAZGEÇ</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={help} animationType="fade" onRequestClose={() => setHelp(false)}>
        <View style={s.backdrop}>
          <View style={[s.sheetPanel, { paddingBottom: Math.max(insets.bottom, 18) + 8 }]}>
            <Text style={s.panelLabel}>YÖNERGE</Text>
            <Text style={s.panelTitle}>Nasıl bağlanır</Text>
            <Text style={s.panelBody}>
              Ayrı bir eşleştirme modu yok. Saat yayın verdiği sürece uygulama bulur.
            </Text>
            <Steps />
            <Pressable onPress={() => setHelp(false)} style={s.panelBtn}>
              <Text style={s.panelBtnText}>TAMAM</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  );
}

function Steps() {
  const items = [
    "Saatin ekranına dokun, ana kadrana dön.",
    "Telefonda Bluetooth açık; HryFine kapalı olsun.",
    "Saati telefonun yanında tut ve BAĞLAN'a bas.",
  ];
  return (
    <View style={s.steps}>
      {items.map((t, i) => (
        <View key={i} style={[s.step, i === items.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={s.stepNo}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={s.stepText}>{t}</Text>
        </View>
      ))}
      <Text style={s.stepNote}>
        Bulamazsa saati kapat-aç; şarj kablosundan çıkar. Hâlâ yoksa telefondaki eski
        PBS163 eşleşmesini sil.
      </Text>
    </View>
  );
}

function ProgressLine({ width, dark = false }: { width: number; dark?: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const seg = Math.max(width * 0.32, 60);
  return (
    <View style={[s.progress, { backgroundColor: dark ? "rgba(18,24,20,0.14)" : "rgba(243,245,236,0.22)" }]}>
      <Animated.View
        style={{
          width: seg,
          height: "100%",
          backgroundColor: dark ? C.green : C.paper,
          transform: [
            { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-seg, width] }) },
          ],
        }}
      />
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.rowRule]}>
      <Text style={s.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ground },
  cover: { backgroundColor: C.green, paddingHorizontal: 22, paddingBottom: 22, overflow: "hidden" },
  coverInner: { maxWidth: 560, width: "100%", alignSelf: "center" },
  topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  wordmark: { fontSize: 11, letterSpacing: 2.6, fontWeight: "700", color: C.paper },
  clock: { fontFamily: MONO, fontSize: 11, color: "rgba(243,245,236,0.72)" },
  coverRule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(243,245,236,0.38)", marginTop: 9 },
  date: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6, color: C.paper, marginTop: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusWord: { fontSize: 10, letterSpacing: 1.7, fontWeight: "700", color: C.paper },
  statusDetail: { fontFamily: MONO, fontSize: 10, color: "rgba(243,245,236,0.7)", marginLeft: 10, flexShrink: 1 },
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, overflow: "hidden" },
  sheet: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 36, maxWidth: 560, width: "100%", alignSelf: "center" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 46 },
  label: { fontSize: 10, letterSpacing: 2, fontWeight: "700", color: C.muted },
  pending: { fontSize: 9, letterSpacing: 1.4, fontWeight: "700", color: C.muted },
  stamp: { borderWidth: 1.5, borderColor: C.green, paddingVertical: 4, paddingHorizontal: 9, alignItems: "center" },
  stampMain: { fontSize: 9.5, letterSpacing: 1.8, fontWeight: "800", color: C.green },
  stampSub: { fontFamily: MONO, fontSize: 8.5, color: C.green, marginTop: 1 },
  table: { marginTop: 4 },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingVertical: 12 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.rule },
  rowLabel: { fontSize: 10.5, letterSpacing: 1.5, fontWeight: "600", color: C.muted },
  rowValue: { fontFamily: MONO, fontSize: 21, color: C.ink, maxWidth: "62%" },
  button: { marginTop: 28, height: 54, alignItems: "center", justifyContent: "center" },
  buttonText: { color: C.paper, fontSize: 12, letterSpacing: 1.6, fontWeight: "800" },
  footRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  foot: { fontSize: 9.5, letterSpacing: 1.2, fontWeight: "700" },
  footLinks: { flexDirection: "row", gap: 14 },
  footLink: { fontSize: 11, color: C.muted, textDecorationLine: "underline" },
  error: { marginTop: 10, fontSize: 11, color: C.red, letterSpacing: 0.4 },
  logHead: { marginTop: 32, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.ink },
  logRow: { flexDirection: "row", alignItems: "baseline", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.rule },
  logTime: { fontFamily: MONO, fontSize: 10, color: C.muted, width: 52 },
  logMsg: { fontFamily: MONO, fontSize: 10, color: C.ink, flex: 1 },
  logEmpty: { fontFamily: MONO, fontSize: 10.5, color: C.muted, paddingVertical: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(18,24,20,0.5)", justifyContent: "flex-end" },
  sheetPanel: {
    backgroundColor: C.ground, paddingHorizontal: 22, paddingTop: 22,
    borderTopWidth: 3, borderTopColor: C.green,
  },
  panelLabel: { fontSize: 9.5, letterSpacing: 2, fontWeight: "700", color: C.muted },
  panelTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4, color: C.ink, marginTop: 6 },
  panelBody: { fontSize: 12.5, lineHeight: 19, color: C.muted, marginTop: 8 },
  panelLine: { marginTop: 14, marginBottom: 6 },
  steps: { marginTop: 10 },
  step: {
    flexDirection: "row", alignItems: "flex-start", paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.rule,
  },
  stepNo: { fontFamily: MONO, fontSize: 10, color: C.green, width: 28, paddingTop: 2 },
  stepText: { fontSize: 13, lineHeight: 19, color: C.ink, flex: 1 },
  stepNote: { fontSize: 11, lineHeight: 17, color: C.muted, marginTop: 12 },
  panelBtn: { marginTop: 18, borderWidth: 1.5, borderColor: C.ink, height: 48, alignItems: "center", justifyContent: "center" },
  panelBtnText: { fontSize: 11, letterSpacing: 1.8, fontWeight: "800", color: C.ink },
});
