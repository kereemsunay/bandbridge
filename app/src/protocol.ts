import { Buffer } from "buffer";

// PBS163 / HryFine protocol, ported from the decompiled official app.
// The band reports small calories (cal); the official app divides by 1000.
export const CALORIES_PER_KCAL = 1000;

export const SERVICE = "6E400001-B5A3-F393-E0A9-E50E24DCCA9F";
export const RX = "6E400002-B5A3-F393-E0A9-E50E24DCCA9F";
export const TX = "6E400003-B5A3-F393-E0A9-E50E24DCCA9F";

export function packet(category: number, sub: number, payload: number[] = []): string {
  const len = payload.length + 5;
  const raw = [
    0xdf,
    (len >> 8) & 0xff,
    len & 0xff,
    category & 0xff,
    0x01,
    sub & 0xff,
    (payload.length >> 8) & 0xff,
    payload.length & 0xff,
    ...payload,
  ];
  const sum = raw.reduce((a, b) => (a + b) & 0xff, 0);
  raw.splice(3, 0, sum);
  return Buffer.from(raw).toString("base64");
}

export function ack(category: number, key: number): string {
  const f = [0xfd, 0x00, 0x05, 0x00, category & 0xff, key & 0xff, 0x00, 0x01];
  f[3] = f.reduce((a, b) => (a + b) & 0xff, 0);
  return Buffer.from(f).toString("base64");
}

export function timePayload(d = new Date()): number[] {
  const y = (d.getFullYear() - 2000) & 0xff;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const mi = d.getMinutes();
  const s = d.getSeconds();
  return [
    ((y << 2) & 0xff) | ((m >> 2) & 0xff),
    (((m & 3) << 6) & 0xff) | ((day << 1) & 0xff) | ((h >> 4) & 0xff),
    (((h & 15) << 4) & 0xff) | ((mi >> 2) & 0xff),
    (((mi & 3) << 6) & 0xff) | (s & 0xff),
  ];
}

export type Frame = { cat: number; key: number; payload: Uint8Array; raw: Uint8Array };

export type Decoded =
  | { kind: "totals"; steps: number; distance: number; calories: number }
  | { kind: "steps"; date: Date; buckets: { start: Date; steps: number; distance: number; calories: number }[] }
  | { kind: "hr"; date: Date; samples: { time: Date; bpm: number }[] }
  | { kind: "sleep"; date: Date; start: Date; end: Date; light: number; deep: number; awake: number }
  | { kind: "spo2"; time: Date; percent: number }
  | { kind: "bp"; time: Date; systolic: number; diastolic: number }
  | { kind: "temp"; time: Date; celsius: number }
  | { kind: "workout"; start: Date; end: Date; mode: number; hr: number[]; calories: number; distance: number; steps: number }
  | { kind: "media"; key: number };

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

function dateOf(b: Uint8Array, offset = 0): Date {
  const b0 = b[offset];
  const b1 = b[offset + 1];
  const year = 2000 + ((b0 & 0x7f) >> 1);
  const month = ((b0 & 1) << 3) + ((b1 & 0xe0) >> 5);
  const day = b1 & 0x1f;
  return new Date(year, Math.max(0, month - 1), Math.max(1, day));
}

export function decode(f: Frame): Decoded | null {
  if (f.cat === 0x0c) return { kind: "media", key: f.key };
  if (f.cat !== 0x05 || f.payload.length < 2) return null;
  const p = f.payload;
  const date = dateOf(p);

  if (f.key === 0x02 && p.length >= 194) {
    const buckets = [];
    for (let i = 0; i < 24; i++) {
      const o = 2 + i * 8;
      const steps = u16(p, o);
      if (steps === 0xffff || steps === 0) continue;
      const d = new Date(date);
      d.setHours(i, 0, 0, 0);
      buckets.push({ start: d, steps, distance: u16(p, o + 2), calories: u32(p, o + 4) });
    }
    return { kind: "steps", date, buckets };
  }

  if (f.key === 0x04 && p.length >= 4) {
    const n = p[3];
    const samples = [];
    for (let i = 0; i < n; i++) {
      const o = 4 + i * 8;
      if (o + 7 >= p.length) break;
      const sec = u32(p, o);
      const bpm = p[o + 7];
      if (bpm < 30 || bpm > 220) continue;
      const t = new Date(date);
      t.setHours(sec / 3600, (sec / 60) % 60, sec % 60, 0);
      samples.push({ time: t, bpm });
    }
    return { kind: "hr", date, samples };
  }

  if (f.key === 0x09 && p.length >= 12) {
    const startMin = u16(p, 2);
    const light = u16(p, 4);
    const deep = u16(p, 6);
    const endMin = u16(p, 8);
    const awake = u16(p, 10);
    if (light >= 1440 || deep >= 1440 || awake >= 1440 || endMin <= startMin) return null;
    const start = new Date(date);
    start.setHours(startMin / 60, startMin % 60, 0, 0);
    const end = new Date(start);
    end.setHours(endMin / 60, endMin % 60, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { kind: "sleep", date, start, end, light, deep, awake };
  }

  if (f.key === 0x0c && p.length >= 12) {
    return { kind: "totals", steps: u32(p, 0), distance: u32(p, 4), calories: u32(p, 8) };
  }

  if (f.key === 0x0e && p.length >= 12) {
    const sec = u32(p, 4);
    const t = new Date(date);
    t.setHours(sec / 3600, (sec / 60) % 60, sec % 60, 0);
    return { kind: "spo2", time: t, percent: p[11] };
  }

  if (f.key === 0x05 && p.length >= 4) {
    const n = p[3];
    if (n > 0) {
      const o = 4;
      if (o + 7 < p.length) {
        const sec = u32(p, o);
        const t = new Date(date);
        t.setHours(sec / 3600, (sec / 60) % 60, sec % 60, 0);
        const sys = p[o + 6], dia = p[o + 7];
        if (sys >= 50 && sys <= 300 && dia >= 30 && dia <= 200) {
          return { kind: "bp", time: t, systolic: sys, diastolic: dia };
        }
      }
    }
    return null;
  }

  if (f.key === 0x0d && p.length >= 4) {
    const n = p[3];
    if (n > 0 && 4 + 7 < p.length) {
      const o = 4;
      const sec = u32(p, o);
      const t = new Date(date);
      t.setHours(sec / 3600, (sec / 60) % 60, sec % 60, 0);
      const celsius = p[o + 6] + p[o + 7] / 10;
      if (celsius >= 30 && celsius <= 50) return { kind: "temp", time: t, celsius };
    }
    return null;
  }

  if (f.key === 0x10 && p.length >= 29) {
    const startSec = u32(p, 2);
    const duration = u32(p, 6);
    if (duration > 0) {
      const start = new Date(date);
      start.setHours(startSec / 3600, (startSec / 60) % 60, startSec % 60, 0);
      const end = new Date(start.getTime() + duration * 1000);
      return {
        kind: "workout",
        start,
        end,
        mode: p[10],
        hr: [p[12], p[13], p[14], p[15], p[16]],
        calories: u32(p, 17),
        distance: u32(p, 21),
        steps: u32(p, 25),
      };
    }
    return null;
  }

  return null;
}

export class FrameAssembler {
  private buf = new Uint8Array(0);

  push(chunk: Uint8Array): Frame[] {
    const out: Frame[] = [];
    let data = new Uint8Array(this.buf.length + chunk.length);
    data.set(this.buf, 0);
    data.set(chunk, this.buf.length);
    this.buf = new Uint8Array(0);

    while (data.length > 0) {
      if (data[0] !== 0xdf) {
        const next = data.indexOf(0xdf);
        if (next < 0) return out;
        data = data.slice(next);
      }
      if (data.length < 3) break;
      const total = (((data[1] << 8) | data[2]) + 4) >>> 0;
      if (data.length < total) break;
      const raw = data.slice(0, total);
      data = data.slice(total);
      let sum = 0;
      for (let i = 0; i < raw.length; i++) if (i !== 3) sum = (sum + raw[i]) & 0xff;
      if (sum !== raw[3]) continue;
      out.push({
        cat: raw[4],
        key: raw[6],
        payload: raw.slice(9),
        raw,
      });
    }
    this.buf = data;
    return out;
  }
}
