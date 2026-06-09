/**
 * pomocare 通知音 候補 — ウィンドチャイム (風に揺れて自然に鳴る)
 * ─────────────────────────────────────────────────────────────
 * ペンタトニックに調律した複数の金属管を、風の「突風モデル」で不規則に鳴らす。
 * 突風時は群れて(フラリー)、穏やかな時は疎らに ―― 揺らぎのある自然なシャラシャラ感。
 * 長い余韻 + 空気感のある残響。完全オリジナル合成。
 * 再現性のためシード付き擬似乱数を使用 (再実行で同じ並び、微調整しやすい)。
 *
 * 出力: G:\マイドライブ\pomocare-audio-sources\candidates\cand-11-wind-chime.wav
 * Usage: node scripts/generate-wind-chime-candidate.mjs   (env: SEED=12345 DUR=11.5)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SR = 44100;
const OUT_DIR = process.env.OUT_DIR || 'G:/マイドライブ/pomocare-audio-sources/candidates';
mkdirSync(OUT_DIR, { recursive: true });
const DUR = parseFloat(process.env.DUR || '11.5');
const N = Math.ceil(DUR * SR);

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
function freq(name) { const m = name.match(/^([A-G])([#b]?)(-?\d)$/); let s = SEMI[m[1]]; if (m[2] === '#') s++; else if (m[2] === 'b') s--; return 440 * Math.pow(2, ((parseInt(m[3], 10) + 1) * 12 + s - 69) / 12); }

function addTone(buf, startT, f, amp, attackMs, tau) {
  const start = Math.floor(startT * SR), aSamp = Math.max(2, Math.floor((attackMs / 1000) * SR)), w = (2 * Math.PI * f) / SR;
  for (let n = start, i = 0; n >= 0 && n < buf.length; n++, i++) {
    let env;
    if (i < aSamp) env = 0.5 * (1 - Math.cos((Math.PI * i) / aSamp));
    else { env = Math.exp(-(i - aSamp) / (tau * SR)); if (env < 1e-5) break; }
    buf[n] += amp * env * Math.sin(w * i);
  }
}
function addNoise(buf, startT, durMs, amp, lpAlpha, seed) {
  const start = Math.floor(startT * SR), len = Math.floor((durMs / 1000) * SR);
  let lp = 0, s = (seed * 2654435761) >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 0xffffffff) * 2 - 1; };
  for (let i = 0; i < len && start + i >= 0 && start + i < buf.length; i++) { const env = Math.exp(-i / (len * 0.35)); lp = rand() * (1 - lpAlpha) + lp * lpAlpha; buf[start + i] += amp * env * lp; }
}
// 金属管チャイム1打: 強い基音(長い余韻) + 管の非整数倍音 + 高域きらめき + クラッパーの当たり
function chimeTube(buf, t, f, a, seed) {
  addTone(buf, t, f, a, 2, 3.0);
  addTone(buf, t, f * 2.76, a * 0.40, 2, 0.9);
  addTone(buf, t, f * 5.40, a * 0.15, 1, 0.30);
  addNoise(buf, t, 4, a * 0.07, 0.2, seed);
}

// 残響 (空気感、長め)
const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLP = [556, 441, 341, 225];
function comb(input, d, fb, damp) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0, lp = 0; for (let i = 0; i < input.length; i++) { const y = ring[idx]; out[i] = y; lp = y * (1 - damp) + lp * damp; ring[idx] = input[i] + lp * fb; idx = (idx + 1) % d; } return out; }
function allpass(input, d, g) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0; for (let i = 0; i < input.length; i++) { const bo = ring[idx]; out[i] = -input[i] + bo; ring[idx] = input[i] + bo * g; idx = (idx + 1) % d; } return out; }
function reverb(input) {
  const acc = new Float64Array(input.length);
  for (const c of COMB) { const cf = comb(input, c, 0.88, 0.18); for (let i = 0; i < acc.length; i++) acc[i] += cf[i]; }
  for (let i = 0; i < acc.length; i++) acc[i] /= COMB.length;
  let sig = acc; for (const d of ALLP) sig = allpass(sig, d, 0.5);
  const out = new Float64Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * 0.88 + sig[i] * 0.34;
  return out;
}
function finalize(buf, peak = 0.8) {
  let mean = 0; for (let i = 0; i < buf.length; i++) mean += buf[i]; mean /= buf.length;
  for (let i = 0; i < buf.length; i++) buf[i] -= mean;
  let mx = 0; for (let i = 0; i < buf.length; i++) mx = Math.max(mx, Math.abs(buf[i]));
  if (mx > 0) { const g = peak / mx; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  for (let i = 0; i < buf.length; i++) buf[i] = (Math.tanh(buf[i] * 1.1) / Math.tanh(1.1)) * peak;
  const fi = Math.floor(0.004 * SR); for (let i = 0; i < fi; i++) buf[i] *= i / fi;
  const fo = Math.floor(0.5 * SR); for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo; // ゆっくりフェードアウト
  return buf;
}
function rms(b) { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); }

// ペンタトニック調律 (Cメジャー/Aマイナー = どの組合せも協和) — 繊細で明るい管
const PENTA = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'].map(freq);

// シード付き擬似乱数
let st = (parseInt(process.env.SEED || '12345', 10) * 2654435761) >>> 0;
const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 0xffffffff; };

// 風の突風モデル: 複数のガウス突風 + 微風ベース
const GUSTS = [
  { c: 1.2, w: 0.9, a: 1.0 }, { c: 4.2, w: 1.3, a: 0.8 }, { c: 7.0, w: 1.0, a: 0.95 }, { c: 9.2, w: 0.8, a: 0.55 },
];
function wind(t) { let v = 0.06; for (const g of GUSTS) v += g.a * Math.exp(-((t - g.c) ** 2) / (2 * g.w * g.w)); return Math.min(1, v); }

const buf = new Float64Array(N);
const END = DUR - 1.8; // 末尾は余韻のために打たない
let t = 0.2, count = 0, prevTube = -1;
while (t < END) {
  const w = wind(t);
  if (rnd() < 0.18 + 0.82 * w) {
    let idx = Math.floor(rnd() * PENTA.length);
    if (idx === prevTube && rnd() < 0.6) idx = (idx + 1 + Math.floor(rnd() * (PENTA.length - 1))) % PENTA.length; // 同じ管の連打を抑制
    prevTube = idx;
    const amp = 0.28 + 0.62 * w * (0.55 + 0.45 * rnd());
    chimeTube(buf, t, PENTA[idx], amp, (count * 2779 + idx * 17 + 3) >>> 0);
    count++;
  }
  const dt = (0.09 + (1 - w) * 0.95) * (0.5 + 1.0 * rnd()); // 突風時は密、穏やかな時は疎
  t += Math.max(0.05, dt);
}
const out = finalize(reverb(buf), 0.8);
writeWav('cand-11-wind-chime.wav', out);
console.log(`✓ cand-11-wind-chime.wav  ${DUR.toFixed(1)}s  ${count}打(ペンタ8管・突風モデル)  RMS=${rms(out).toFixed(3)}`);

const readme = [
  'pomocare 通知音 候補 — ウィンドチャイム (風に揺れて自然に鳴る) (アルゴリズム合成 / 完全オリジナル)',
  '',
  `生成日: ${process.env.GEN_DATE || '(未指定)'}`,
  'cand-11-wind-chime.wav',
  `  ペンタトニック調律の金属管8本(A4〜D6) / 風の突風モデルで不規則に${count}打(群れる⇄疎ら) / 長い余韻+空気感のある残響`,
  `  ${DUR.toFixed(1)}秒 / WAV ${SR}Hz 16-bit mono / シード付き(再現可)`,
  '',
  '調整例: SEED で鳴り方違いを量産、もっと疎らに/賑やかに、音域(管の調律)、長さ(DUR)、余韻量 など。',
  '通知音には少し長いので、採用時は気に入った数秒を切り出す案も可。',
].join('\n');
writeFileSync(join(OUT_DIR, 'README-wind-chime.txt'), readme);
console.log('✓ README-wind-chime.txt');
