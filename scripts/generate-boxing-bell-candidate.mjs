/**
 * pomocare 通知音 候補 — ボクシングのラウンド終了ゴング (ring bell)
 * ─────────────────────────────────────────────────────────────
 * 明るい金属ベルを高速で連打 (カンカンカン…) して、金属的なうなり(ビート)と長い余韻で
 * リングのゴングを表現。各打が余韻に重なってクラング感が育つ。完全オリジナル合成。
 *
 * 出力: G:\マイドライブ\pomocare-audio-sources\candidates\cand-13-boxing-bell.wav
 *   env: STRIKES=5 STRIKE_GAP=0.16 F0=680
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SR = 44100;
const OUT_DIR = process.env.OUT_DIR || 'G:/マイドライブ/pomocare-audio-sources/candidates';
mkdirSync(OUT_DIR, { recursive: true });
const STRIKES = parseInt(process.env.STRIKES || '5', 10);
const STRIKE_GAP = parseFloat(process.env.STRIKE_GAP || '0.16');
const F0 = parseFloat(process.env.F0 || '680');

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
  let lp = 0, s = (seed * 2654435761) >>> 0; const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 0xffffffff) * 2 - 1; };
  for (let i = 0; i < len && start + i >= 0 && start + i < buf.length; i++) { const env = Math.exp(-i / (len * 0.3)); lp = rand() * (1 - lpAlpha) + lp * lpAlpha; buf[start + i] += amp * env * lp; }
}

// 金属ベル(明るいクラング): 非整数倍音 + 近接デチューン対でうなり(ビート) + 金属的な打撃ノイズ
// [ratio, amp, tau]
const BELL = [
  [1.00, 1.0, 3.6], [1.006, 0.65, 3.6], // 基音 + デチューン → うなり
  [2.01, 0.7, 2.0], [2.76, 0.5, 1.4], [3.01, 0.42, 1.2],
  [4.22, 0.3, 0.8], [5.41, 0.24, 0.5], [6.83, 0.16, 0.35], [8.2, 0.10, 0.22],
];
function bellStrike(buf, t, f0, a, seed) {
  for (const [r, amp, tau] of BELL) addTone(buf, t, f0 * r, a * amp, 1.5, tau);
  addNoise(buf, t, 5, a * 0.18, 0.12, seed); // ハンマーが金属を叩く明るいクリック
}

const COMB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLP = [556, 441, 341, 225];
function comb(input, d, fb, damp) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0, lp = 0; for (let i = 0; i < input.length; i++) { const y = ring[idx]; out[i] = y; lp = y * (1 - damp) + lp * damp; ring[idx] = input[i] + lp * fb; idx = (idx + 1) % d; } return out; }
function allpass(input, d, g) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0; for (let i = 0; i < input.length; i++) { const bo = ring[idx]; out[i] = -input[i] + bo; ring[idx] = input[i] + bo * g; idx = (idx + 1) % d; } return out; }
function reverb(input) { const acc = new Float64Array(input.length); for (const c of COMB) { const cf = comb(input, c, 0.87, 0.20); for (let i = 0; i < acc.length; i++) acc[i] += cf[i]; } for (let i = 0; i < acc.length; i++) acc[i] /= COMB.length; let sig = acc; for (const d of ALLP) sig = allpass(sig, d, 0.5); const out = new Float64Array(input.length); for (let i = 0; i < input.length; i++) out[i] = input[i] * 0.88 + sig[i] * 0.26; return out; }
function finalize(buf, peak = 0.86) { let mean = 0; for (let i = 0; i < buf.length; i++) mean += buf[i]; mean /= buf.length; for (let i = 0; i < buf.length; i++) buf[i] -= mean; let mx = 0; for (let i = 0; i < buf.length; i++) mx = Math.max(mx, Math.abs(buf[i])); if (mx > 0) { const g = peak / mx; for (let i = 0; i < buf.length; i++) buf[i] *= g; } for (let i = 0; i < buf.length; i++) buf[i] = (Math.tanh(buf[i] * 1.1) / Math.tanh(1.1)) * peak; const fi = Math.floor(0.002 * SR); for (let i = 0; i < fi; i++) buf[i] *= i / fi; const fo = Math.floor(0.3 * SR); for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo; return buf; }
function rms(b) { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); }

const LEAD = 0.06, RINGOUT = 3.4;
const total = LEAD + (STRIKES - 1) * STRIKE_GAP + RINGOUT;
const buf = new Float64Array(Math.ceil(total * SR));
let t = LEAD;
for (let i = 0; i < STRIKES; i++) {
  const a = i === STRIKES - 1 ? 0.95 : 0.78 + 0.1 * (i % 2); // 連打、最後を少し強く
  bellStrike(buf, t, F0, a, i * 131 + 7);
  t += STRIKE_GAP;
}
const out = finalize(reverb(buf), 0.86);
writeWav('cand-13-boxing-bell.wav', out);
console.log(`✓ cand-13-boxing-bell.wav  ${total.toFixed(1)}s  金属ベル${STRIKES}連打 (F0=${F0}Hz, 間隔${(STRIKE_GAP * 1000).toFixed(0)}ms)  RMS=${rms(out).toFixed(3)}`);

const readme = [
  'pomocare 通知音 候補 — ボクシング ラウンド終了ゴング (アルゴリズム合成 / 完全オリジナル)',
  '',
  `生成日: ${process.env.GEN_DATE || '(未指定)'}`,
  'cand-13-boxing-bell.wav',
  `  明るい金属ベルを${STRIKES}連打(間隔${(STRIKE_GAP * 1000).toFixed(0)}ms, F0=${F0}Hz) / 非整数倍音+デチューンのうなり / 長い金属余韻`,
  `  「カンカンカン…」のリングのゴング / ${total.toFixed(1)}秒 / WAV ${SR}Hz 16-bit mono`,
  '',
  '調整例: 連打数(STRIKES)、速さ(STRIKE_GAP)、ベルの高さ(F0)、余韻の長さ、もっと甲高く/重く など。',
].join('\n');
writeFileSync(join(OUT_DIR, 'README-boxing-bell.txt'), readme);
console.log('✓ README-boxing-bell.txt');
