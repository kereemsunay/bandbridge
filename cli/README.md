# pbsctl

Dependency-free Swift CLI for the PBS163 band on macOS (CoreBluetooth).

## Build

```bash
swiftc -O pbsctl.swift -o pbsctl
```

## Use

```bash
./pbsctl battery
./pbsctl time
./pbsctl buzz 3
./pbsctl msg "Merhaba"
./pbsctl call "Anne"
./pbsctl hr on
./pbsctl spo2 on
./pbsctl weather 3 12 19 15 Istanbul
./pbsctl 24h on
./pbsctl metric on
./pbsctl sync2          # realtime steps + history request
./pbsctl rt on          # realtime step stream
./pbsctl init2          # time + device info + bind + sync
./pbsctl raw DF0005...
./pbsctl listen 15
```

The CLI connects to a previously seen `PBS163` by cached CoreBluetooth id,
or scans for it if the cache is empty. Keep the band awake (tap the screen)
if the connection fails.

`sync2` sends `05/06` (realtime steps) and `05/01` (history). Today's total
arrives as key `0C`; history buckets only exist for completed days.

## Notes

- Never writes to the `FF00` OTA service.
- Every incoming frame is automatically ACKed.
- Battery, steps, distance, and calories are decoded and printed.
