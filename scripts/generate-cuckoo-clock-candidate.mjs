/**
 * pomocare 通知音 候補 — ハト時計 (cuckoo clock)
 * ─────────────────────────────────────────────────────────────
 * 小さなパイプ(笛)2本の柔らかい音色で「クックー」(高→低の短3度下降)を複数回。
 * 息感(チフ/ブレス)+ 機構の小さな木の音を添える。完全オリジナル合成。
 *
 * 出力: G:\マイドライブ\pomocare-audio-sources\candidates\cand-12-cuckoo-clock.wav
 *   env: CALLS=3 HI=G5 LO=E5
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SR = 44100;
const OUT_DIR = process.env.OUT_DIR || 'G:/マイドライブ/pomocare-audio-sources/candidates';
mkdirSync(OUT_DIR, { recursive: true });
const CALLS = parseInt(process.env.CALLS || '3', 10);
const HI = process.env.HI || 'G5';
const LO = process.env.LO || 'E5';

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

// 笛(パイプ)1音: 基音+弱い2,3倍音 / 柔らかいアタック / 軽いビブラート / 息(ブレス)レイヤー + 立ち上がりチフ
function pipeNote(buf, t, f, a, dur, seed) {
  const start = Math.floor(t * SR), len = Math.floor(dur * SR);
  const atk = Math.floor(0.022 * SR), rel = Math.floor(0.05 * SR);
  const H = [1.0, 0.25, 0.06];
  const ph = [0, 0, 0];
  let ns = (seed * 2654435761) >>> 0; const rnd = () => { ns = (ns * 1664525 + 1013904223) >>> 0; return (ns / 0xffffffff) * 2 - 1; };
  let bp = 0; // breath lowpass state
  for (let i = 0; i < len && start + i < buf.length; i++) {
    let env;
    if (i < atk) env = 0.5 * (1 - Math.cos((Math.PI * i) / atk));
    else if (i > len - rel) env = 0.5 * (1 - Math.cos((Math.PI * (len - i)) / rel));
    else env = 1;
    const vib = 1 + 0.004 * Math.sin((2 * Math.PI * 5.5 * i) / SR);
    let s = 0;
    for (let h = 0; h < H.length; h++) { ph[h] += (2 * Math.PI * f * (h + 1) * vib) / SR; s += H[h] * Math.sin(ph[h]); }
    // 息: 帯域制限ノイズ。立ち上がりにチフ(やや強め)、その後は薄く。
    bp = rnd() * 0.25 + bp * 0.75;
    const chiff = Math.exp(-i / (0.02 * SR)) * 0.6;
    buf[start + i] += a * env * (s / 1.3 + bp * (0.05 + chiff));
  }
}
// 機構の小さな木の音(クリック)
function tick(buf, t, a, seed) {
  const start = Math.floor(t * SR), len = Math.floor(0.02 * SR);
  let ns = (seed * 40503) >>> 0; const rnd = () => { ns = (ns * 1664525 + 1013904223) >>> 0; return (ns / 0xffffffff) * 2 - 1; };
  let lp = 0;
  for (let i = 0; i < len && start + i < buf.length; i++) { const env = Math.exp(-i / (len * 0.3)); lp = rnd() * 0.5 + lp * 0.5; buf[start + i] += a * env * lp; }
  // 低い共鳴
  const w = (2 * Math.PI * 220) / SR;
  for (let i = 0; i < Math.floor(0.08 * SR) && start + i < buf.length; i++) buf[start + i] += a * 0.5 * Math.exp(-i / (0.04 * SR)) * Math.sin(w * i);
}

const COMB = [1116, 1188, 1277, 1356, 1422, 1491], ALLP = [556, 441, 341];
function comb(input, d, fb, damp) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0, lp = 0; for (let i = 0; i < input.length; i++) { const y = ring[idx]; out[i] = y; lp = y * (1 - damp) + lp * damp; ring[idx] = input[i] + lp * fb; idx = (idx + 1) % d; } return out; }
function allpass(input, d, g) { const out = new Float64Array(input.length), ring = new Float64Array(d); let idx = 0; for (let i = 0; i < input.length; i++) { const bo = ring[idx]; out[i] = -input[i] + bo; ring[idx] = input[i] + bo * g; idx = (idx + 1) % d; } return out; }
function reverb(input) { const acc = new Float64Array(input.length); for (const c of COMB) { const cf = comb(input, c, 0.80, 0.40); for (let i = 0; i < acc.length; i++) acc[i] += cf[i]; } for (let i = 0; i < acc.length; i++) acc[i] /= COMB.length; let sig = acc; for (const d of ALLP) sig = allpass(sig, d, 0.5); const out = new Float64Array(input.length); for (let i = 0; i < input.length; i++) out[i] = input[i] * 0.92 + sig[i] * 0.13; return out; }
function finalize(buf, peak = 0.82) { let mean = 0; for (let i = 0; i < buf.length; i++) mean += buf[i]; mean /= buf.length; for (let i = 0; i < buf.length; i++) buf[i] -= mean; let mx = 0; for (let i = 0; i < buf.length; i++) mx = Math.max(mx, Math.abs(buf[i])); if (mx > 0) { const g = peak / mx; for (let i = 0; i < buf.length; i++) buf[i] *= g; } for (let i = 0; i < buf.length; i++) buf[i] = (Math.tanh(buf[i] * 1.05) / Math.tanh(1.05)) * peak; const fi = Math.floor(0.003 * SR); for (let i = 0; i < fi; i++) buf[i] *= i / fi; const fo = Math.floor(0.12 * SR); for (let i = 0; i < fo; i++) buf[buf.length - 1 - i] *= i / fo; return buf; }
function rms(b) { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); }

const fHi = freq(HI), fLo = freq(LO);
const N1 = 0.22, N2 = 0.40, GAP12 = 0.04, GAPCALL = 0.40, LEAD = 0.18, TAIL = 0.8;
const callLen = N1 + GAP12 + N2 + GAPCALL;
const total = LEAD + CALLS * callLen + TAIL;
const buf = new Float64Array(Math.ceil(total * SR));
tick(buf, 0.02, 0.5, 9); // 扉が開く小さな機構音
let t = LEAD;
for (let c = 0; c < CALLS; c++) {
  pipeNote(buf, t, fHi, 0.85, N1, c * 7 + 1); t += N1 + GAP12;
  pipeNote(buf, t, fLo, 0.85, N2, c * 7 + 4); t += N2 + GAPCALL;
}
const out = finalize(reverb(buf), 0.82);
writeWav('cand-12-cuckoo-clock.wav', out);
console.log(`✓ cand-12-cuckoo-clock.wav  ${total.toFixed(1)}s  「クックー」×${CALLS} (${HI}→${LO})  RMS=${rms(out).toFixed(3)}`);

const readme = [
  'pomocare 通知音 候補 — ハト時計 (cuckoo clock) (アルゴリズム合成 / 完全オリジナル)',
  '',
  `生成日: ${process.env.GEN_DATE || '(未指定)'}`,
  'cand-12-cuckoo-clock.wav',
  `  小さなパイプ(笛)の音色で「クックー」(${HI}→${LO}, 高→低)を${CALLS}回 / 息感+機構の木の音 / ${total.toFixed(1)}秒`,
  '  WAV ' + SR + 'Hz 16-bit mono / 完全オリジナル(著作権問題なし)',
  '',
  '調整例: 回数(CALLS)、音程(HI/LO)、息感の量、速さ、機構音の有無 など。',
].join('\n');
writeFileSync(join(OUT_DIR, 'README-cuckoo-clock.txt'), readme);
console.log('✓ README-cuckoo-clock.txt');
