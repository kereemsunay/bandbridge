# BandBridge design system

## World

A pitch-side measurement sheet: the band is a sensor, the app is its readout.
The screen is a single form, not a dashboard. No cards, no rings, no badges, no
celebration. Green owns the cover; paper owns the body; ink carries action.

## Color

| Token | Hex | Use |
|---|---|---|
| `ground` | `#E7EBE2` | body background, cool paper |
| `paper` | `#F3F5EC` | text on green, button label |
| `ink` | `#121814` | primary text, rules, primary button |
| `muted` | `#5A645C` | labels, secondary text |
| `rule` | `#C3CABF` | hairlines between rows |
| `green` | `#125B3B` | cover, connected state, stamp, health-ok |
| `red` | `#9E3527` | errors and missing health permission only |

No gradients, no shadows, no glass. Depth comes from hairlines and the solid
cover block.

## Type

- Labels: 10–10.5 px, uppercase, letter-spacing 1.4–2.0, weight 600–700, `muted`.
- Date: 26 px, weight 800, letter-spacing −0.6.
- Values: monospaced, 21 px, `ink`; units inline, smaller.
- Log: monospaced 10 px.
- Platform faces only (SF Pro / Roboto + Menlo / monospace); no display face.

## Layout

- Fixed green cover at the top: wordmark, clock, hairline, date, status.
- Body scrolls: section label + stamp, five-row measurement table, primary
  action, health state, record log.
- 22 px side padding, max width 560, rows 12 px vertical padding.
- Square corners everywhere. One primary button, 54 px tall.

## States

- Connected: green cover, paper dot, `BAĞLI`.
- Disconnected: dimmed dot, `BAĞLI DEĞİL`; primary label becomes `BAĞLAN`.
- Syncing: button label `AKTARILIYOR`, disabled.
- Synced: green outlined stamp `SENKRON` + time, rotated −3.5°, spring in.
- Health missing: `SAĞLIK İZNİ YOK`, red foot line; no stamp.
- Empty data: em dash, never a fake zero.

## Motion

One authored moment: the stamp presses in with a spring (scale 1.2 → 1,
opacity 0 → 1) when a sync lands. Nothing else animates; the status dot is static.

## Voice

Turkish, plain, non-technical. Controls name the action. Errors name the problem.
No motivational copy, no exclamation marks, no streaks.

## Do not

- No gamification, badges, progress rings, confetti.
- No cards, no rounded corners, no shadows.
- No hero metric block; measurements stay in the table.
- No monospace outside data and timestamps.
