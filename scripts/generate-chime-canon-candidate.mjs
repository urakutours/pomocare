/**
 * pomocare 通知音 候補 — チャイム × パッヘルベル「カノン」(Canon in D)
 * ─────────────────────────────────────────────────────────────
 * cand-03 チャイム音色 (柔らかいマレット) で、パッヘルベルのカノン (Johann Pachelbel, 1680頃,
 * 1706年没=パブリックドメイン) の第1ヴァイオリン主旋律 (あの結婚式の名旋律) を奏でる。
 * 完全オリジナル合成・旋律のみ。
 *
 * 旋律: D-A-Bm-F#m-G-D-G-A のコード進行に乗る下降線 F#5 E5 D5 C#5 B4 A4 B4 C#5 → D5 で解決。
 * ※ 旋律は記憶からの best-effort。違えば音名で指摘ください、即修正。
 *
 * 出力: G:\マイドライブ\pomocare-audio-sources\candidates\cand-03c-chime-pachelbel-canon.wav
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SR = 44100;
const OUT_DIR = process.env.OUT_DIR || 'G:/マイドライブ/pomocare-audio-sources/candidates';
mkdirSync(OUT_DIR, { recursive: true });

function writeWav(filename, samples) {
  const dataSize = samples.length * 2, buf = Buffer.alloc(44 + dataSize); let o = 0;
  buf.write('RIFF', o); o += 4; buf.writeUInt32LE(36 + dataSize, o); o += 4;
  buf.write('WAVE', o); o += 4; buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4; buf.writeUInt16LE(1, o); o += 2; buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt32LE(SR, o); o += 4; buf.writeUInt32LE(SR * 2, o); o += 4;
  buf.writeUInt16LE(2, o); o += 2; buf.writeUInt16LE(16, o); o += 2;
  buf.write('data', o); o += 4; buf.writeUInt32LE(dataSize, o); o += 4;
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), o); o += 2; }
  const p = join(OUT_DIR, filename); writeFileSync(p, buf); return p;
}

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(name) {
  const m = name.match(/^([A-G])([#b]?)(-?\d)$/);
  let s = SEMI[m[1]]; if (m[2] === '#') s++; else if (m[2] === 'b') s--;
  return 440 * Math.pow(2, ((parseInt(m[3], 10) + 1) * 12 + s - 69) / 12);
}
function addTone(buf, startT, f, amp, attackMs, tau) {
  const start = Math.floor(startT * SR), aSamp = Math.max(2, Math.floor((attackMs / 1000) * SR)), w = (2 * Math.PI * f) / SR;
  for (let n = start, i = 0; n < buf.length; n++, i++) {
    let env;
    if (i < aSamp) env = 0.5 * (1 - Math.cos((Math.PI * i) / aSamp));
    else { env = Math.exp(-(i - aSamp) / (tau * SR)); if (env < 1e-5) break; }
    buf[n] += amp * env * Math.sin(w * i);
  }
}
// チャイム1音 (cand-03: 柔らかいマレット, 倍音控えめ, ゆったり減衰)
function chimeNote(buf, t, f, a) {
  addTone(buf, t, f, a, 6, 1.7);
  addTone(buf, t, f * 2, a * 0.30, 6, 1.1);
  addTone(buf, t, f * 3, a * 0.12, 6, 0.7);
}

const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLP = [556, 441, 341, 225];
function comb(input, d, fb, damp) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0, lp = 0; for (let i = 0; i < input.length; i++) { const y = ring[idx]; out[i] = y; lp = y * (1 - damp) + lp * damp; ring[idx] = input[i] + lp * fb; idx = (idx + 1) % d; } return out; }
function allpass(input, d, g) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0; for (let i = 0; i < input.length; i++) { const bo = ring[idx]; out[i] = -input[i] + bo; ring[idx] = input[i] + bo * g; idx = (idx + 1) % d; } return out; }
function reverb(input, { feedback, damp, wet, dry }) {
  const acc = new Float64Array(input.length);
  for (const c of COMB) { const cf = comb(input, c, feedback, damp); for (let i = 0; i < acc.length; i++) acc[i] += cf[i]; }
  for (let i = 0; i < acc.length; i++) acc[i] /= COMB.length;
  let sig = acc; for (const d of ALLP) sig = allpass(sig, d, 0.5);
  const out = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * dry + sig[i] * wet;
  return out;
}
function finalize(buf, peak = 0.84) {
  let mean = 0; for (let i = 0; i < buf.length; i++) mean += buf[i]; mean /= buf.length;
  for (let i = 0; i < buf.length; i++) buf[i] -= mean;
  let mx = 0; for (let i = 0; i < buf.length; i++) mx = Math.max(mx, Math.abs(buf[i]));
  if (mx > 0) { const g = peak / mx; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  for (let i = 0; i < buf.length; i++) buf[i] = (Math.tanh(buf[i] * 1.1) / Math.tanh(1.1)) * peak;
  const fi = Math.floor(0.003 * SR); for (let i = 0; i < fi; i++) buf[i] *= i / fi;
  const fo = Math.floor(0.18 * SR); for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo;
  return buf;
}
function rms(b) { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); }

// ── カノン 第1ヴァイオリン主旋律 (D-A-Bm-F#m-G-D-G-A の下降線 → D で解決) ──
const NOTE_SEC = 0.72; // ゆったり目
const MELODY = [
  { n: 'F#5', d: 1 }, { n: 'E5', d: 1 }, { n: 'D5', d: 1 }, { n: 'C#5', d: 1 },
  { n: 'B4', d: 1 }, { n: 'A4', d: 1 }, { n: 'B4', d: 1 }, { n: 'C#5', d: 1 },
  { n: 'D5', d: 2.2 }, // 主音へ解決して伸ばす
];
const LEAD = 0.3, TAIL = 1.8, AMP = 0.6;
const totalSec = LEAD + MELODY.reduce((s, e) => s + e.d, 0) * NOTE_SEC + TAIL;
const buf = new Float64Array(Math.ceil(totalSec * SR));
let t = LEAD;
for (const ev of MELODY) { chimeNote(buf, t, freq(ev.n), AMP); t += ev.d * NOTE_SEC; }
const out = finalize(reverb(buf, { feedback: 0.86, damp: 0.30, wet: 0.30, dry: 0.92 }), 0.84);
writeWav('cand-03c-chime-pachelbel-canon.wav', out);
console.log(`✓ cand-03c-chime-pachelbel-canon.wav  ${totalSec.toFixed(1)}s  RMS=${rms(out).toFixed(3)}  チャイム×パッヘルベルのカノン`);

const readme = [
  'pomocare 通知音 候補 — チャイム × パッヘルベル「カノン」(アルゴリズム合成 / 完全オリジナル)',
  '',
  `生成日: ${process.env.GEN_DATE || '(未指定)'}`,
  'cand-03c-chime-pachelbel-canon.wav',
  `  cand-03 チャイム音色 (柔らかいマレット) / ${totalSec.toFixed(1)}秒 / WAV ${SR}Hz 16-bit mono`,
  '  楽曲: パッヘルベルのカノン (Pachelbel, 1706年没=PD)。第1ヴァイオリン主旋律1巡。旋律のみ。',
  '  進行: D-A-Bm-F#m-G-D-G-A の下降線 (F#5→…→C#5) → D5 で解決。',
  '  ※ 旋律は記憶からの best-effort。違えば音名/長さを指示で即修正。',
  '',
  '調整例: もっと遅く/速く、音域を上げ下げ、フレーズを伸ばす(2巡目=8分音符の変奏)、リバーブ量 など。',
].join('\n');
writeFileSync(join(OUT_DIR, 'README-chime-canon.txt'), readme);
console.log('✓ README-chime-canon.txt');
