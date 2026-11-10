# PBS163 / HryFine BLE protocol

Reverse-engineered from the official HryFine Android app (`com.lianhezhuli.hyfit`)
and verified against a Polosmart PBS163 band.

## GATT

| UUID | Role |
|---|---|
| `6E400001-B5A3-F393-E0A9-E50E24DCCA9F` | Nordic UART Service (normal channel) |
| `6E400002-…` | RX, host → band (write / write-no-response) |
| `6E400003-…` | TX, band → host (notify) |
| `0000FF00-…` | OTA / file transfer — do not touch |
| `180A` | Device information (2A26/2A27 return ASCII `10000`) |
| `180F` / `2A19` | Battery level |

## Host → band frame

```
DF lenHi lenLo CKSUM cat 01 sub payHi payLo payload…
```

- `len = payloadLen + 5`
- `CKSUM = sum of every other byte mod 256`, inserted at index 3
- `cat` = command group, `sub` = command id

## Band → host

ACK / response:

```
FD 00 05 CKSUM cat key auxHi auxLo status
```

`status = 01` means success. `aux` is not fully understood.

Data frame: same `DF` layout as above. **Every DF frame must be ACKed**:

```
FD 00 05 CKSUM cat key 00 01
```

If the ACK is missing, the band stops sending. Large frames may arrive in
multiple notifications; concatenate until `len + 4` bytes are collected.

## Settings commands (category `02`)

| Sub | Action | Payload |
|---|---|---|
| `01` | Time sync | 4 bytes, bit-packed (below) |
| `0B` | Find / vibrate | `01` on, `00` off |
| `0C` | Notification switches | 12 × `01` |
| `0D` | Heart-rate LED | `01` / `00` |
| `0E` | Blood pressure | `01` / `00` |
| `11` | Incoming call | `state, 00, name…` |
| `12` | Message push | `appType, 00, 00, text…` |
| `1A` | 24h format | `01` 24h, `00` 12h |
| `1B` | Units | `01` metric, `00` imperial |
| `1C` | SpO2 | `01` / `00` |
| `1D` | Weather | `yearHi, yearLo, month, day, 0, code, min, max, cur, city…` |
| `21` | Drink reminder | `enable, startH, startM, endH, endM, interval` |

Time payload:

```
b0 = (year-2000)<<2 | month>>2
b1 = (month&3)<<6 | day<<1 | hour>>4
b2 = (hour&15)<<4 | minute>>2
b3 = (minute&3)<<6 | second
```

## Device / identity

| Command | Meaning |
|---|---|
| `F3/00` | Device info request |
| `03/00` | Bind, payload = 8-char ASCII user id |
| `04/00` | Unbind |
| `05/01` | Sync all history |
| `05/06` | Realtime step switch (`01` / `00`), band then pushes key `0C` |
| `05/0A` | Today's history |
| `0F/01` | Installed watch faces |
| `19/00` | Capabilities |

Typical app handshake: read `2A27` → `F3/00` → bind `03/00` → `05/01` → `05/06`.

## Health data (category `05`, key at byte 6)

| Key | Meaning | Payload |
|---|---|---|
| `02` | 15-min step buckets | date(2) + 24 × [steps u16, distance u16, calories u32] |
| `04` | Heart rate | date(2), count, count × [secondsOfDay u32, type, ?, bpm] |
| `07` | Sync start | `01` |
| `08` | Sync end | `01` |
| `09` | Sleep summary | date(2), startMin u16, light u16, deep u16, endMin u16, awake u16 |
| `0C` | Today totals | steps u32, distance u32, calories u32 |
| `0F` | Sport modes | — |
| `10` | Workouts | date(2), start u32, duration u32, mode, HR[5], calories u32, distance u32, steps u32 |

Date encoding (2 bytes):

```
year  = 2000 + ((b0 & 0x7F) >> 1)
month = ((b0 & 1) << 3) + ((b1 & 0xE0) >> 5)
day   = b1 & 0x1F
```

Steps: `0xFFFF` means no record. Totals are cumulative for the day; the client
must store the last value and write the difference to HealthKit / Health Connect.

## Media / button events (category `0C`)

Band → host when the touch button is used on music/camera screens:

```
DF 00 06 CKSUM 0C 01 key 00 01 state
```

Keys: `0D` next, `0C` previous, `0A/0B` play-pause, `03/04` camera shutter.
