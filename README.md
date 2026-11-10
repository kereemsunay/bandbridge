# BandBridge — health bridge for a cheap smart band

Reverse-engineered **Polosmart PBS163** (HryFine-family) smart bracelet: BLE protocol,
a macOS control CLI, a native iOS app, and a React Native app that writes the band's
data into Apple Health / Health Connect.

The name is the point: the band talks to *your* health app, not to a vendor cloud.

No HryFine, no ads, no account, no cloud.

> Unofficial hobby project. Not affiliated with Polosmart or HryFine. Use only on
> hardware you own.

## What works

| Feature | Status |
|---|---|
| BLE connect (NUS `6E400001…`) + ACK framing | ✅ verified on device |
| Time sync, vibrate, message, call, weather, 24h, units | ✅ verified |
| Battery read | ✅ |
| Today's steps / distance / calories (`key 12`) | ✅ verified |
| History sync (`05/01`) handshake | ✅ starts, empty until a past day exists |
| 15-min step buckets (`key 02`), HR (`key 04`), sleep (`key 09`) | parser written, needs a full day of data |
| SpO2 (`key 14`), blood pressure (`key 05`), temperature (`key 13`) | parser + Health Connect write |
| Workouts (`key 16`) | parser + ExerciseSession write |
| Battery level | ✅ header |
| Media button events (`0C`) | logged, playback control not wired |
| iOS HealthKit app | ✅ builds (needs signing team) |
| React Native Android app + Health Connect | ✅ APK builds |
| Real-time heart rate | ❌ band does not stream it |
| Background sync | ⚠️ app-open only for now |

## Usage guide

Turkish step-by-step guide: [docs/KULLANIM.md](docs/KULLANIM.md). Covers first-run
permissions, how the band pairs (no pairing mode — it only advertises), daily sync,
delays, the cal → kcal conversion, and what the band can and cannot do.

## Repo layout

```
cli/    pbsctl — Swift CoreBluetooth CLI for macOS (no dependencies)
ios/    native SwiftUI app: CoreBluetooth + HealthKit (xcodegen project)
app/    React Native app: BLE + Health Connect (Android), shared JS protocol
docs/   protocol notes
```

## Quick start

### macOS CLI

```bash
cd cli
swiftc -O pbsctl.swift -o pbsctl
./pbsctl battery
./pbsctl time
./pbsctl buzz 3
./pbsctl sync2          # realtime steps + history request
```

Commands: `time`, `battery`, `buzz [sec]`, `msg <text>`, `call <name>`,
`hr on|off`, `spo2 on|off`, `weather <code> <min> <max> <cur> <city>`,
`24h on|off`, `metric on|off`, `sync`, `today`, `sync2`, `init2`, `rt on|off`,
`raw <hex>`, `listen [sec]`.

### iOS

```bash
cd ios
xcodegen generate       # needs `brew install xcodegen`
open PBS163.xcodeproj   # select your Team, run on iPhone
```

### Android (React Native)

```bash
cd app
npm install
npx react-native run-android
# or: cd android && ./gradlew assembleRelease
```

Requirements: Android 9+ (minSdk 26), Health Connect (built in on Android 14+).

## How it works

The band speaks a framed binary protocol over the Nordic UART Service:

```
DF lenHi lenLo CKSUM category 01 subCmd payHi payLo payload…
```

Every frame from the band is acknowledged with `FD 00 05 CKSUM cat key 00 01`;
without the ACK the band stops sending. Health data lives under category `0x05`.
See [docs/PROTOCOL.md](docs/PROTOCOL.md) for commands, payload layouts, and the
reverse-engineering notes.

## Credits

- Protocol first documented by [jsphu/polosmart-pbs163-ble](https://github.com/jsphu/polosmart-pbs163-ble) (MIT).
- HryFine app (`com.lianhezhuli.hyfit`) decompiled for command/payload mapping.
- Health data query IDs cross-checked against [develmts/Jieli-watch-research](https://github.com/develmts/Jieli-watch-research).

## License

MIT — see [LICENSE](LICENSE). No vendor code, firmware, or APK is included.
