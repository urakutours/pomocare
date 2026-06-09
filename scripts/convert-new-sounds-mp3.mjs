/**
 * Convert new 4 alarm WAV candidates to MP3 for pomocare.
 *
 * Source WAV: mono / 44100Hz / 16bit (algorithm-synthesized, PD originals)
 *   G:/マイドライブ/pomocare-audio-sources/candidates/cand-11-wind-chime.wav   → windchime.mp3
 *   G:/マイドライブ/pomocare-audio-sources/candidates/cand-03c-chime-pachelbel-canon.wav → canon.mp3
 *   G:/マイドライブ/pomocare-audio-sources/candidates/cand-13-boxing-bell.wav  → boxing.mp3
 *   G:/マイドライブ/pomocare-audio-sources/candidates/cand-12-cuckoo-clock.wav → cuckoo.mp3
 *
 * Output:
 *   public/sounds/{windchime,canon,boxing,cuckoo}.mp3
 *   android/app/src/main/res/raw/{windchime,canon,boxing,cuckoo}.mp3
 *
 * Usage: node scripts/convert-new-sounds-mp3.mjs
 *
 * Notes:
 *   - Uses lamejs (lame.min.js bundle) loaded via Node.js vm module to avoid
 *     CJS MPEGMode scope issue (same pattern as convert-alarm-mp3.mjs).
 *   - Source format: mono / 44100Hz / 16bit — no resampling needed.
 *   - Target: mono / 44100Hz / 16bit / 128kbps MP3.
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'sounds');
const ANDROID_RAW_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'res', 'raw');

// Load lamejs via vm to avoid MPEGMode global scope issue in CJS module graph
function loadLamejs() {
  const lameMinPath = join(ROOT, 'node_modules', 'lamejs', 'lame.min.js');
  const code = readFileSync(lameMinPath, 'utf-8');
  const ctx = { lamejs: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.lamejs;
}

const lamejs = loadLamejs();

// --- WAV reader: returns mono int16 at 44100Hz ---
// Source WAV is already mono 44100Hz 16bit — returns samples directly (no resampling).

function readWavMono16(path) {
  const buf = readFileSync(path);

  let offset = 12;
  let channels = 1, sampleRate = 44100, bitsPerSample = 16;
  let dataStart = 0, dataSize = 0;

  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataStart = offset + 8;
      dataSize = chunkSize;
      break;
    }
    if (chunkSize === 0) break;
    offset += 8 + chunkSize;
  }

  const bytesPerSample = bitsPerSample / 8;
  const numFrames = Math.floor(dataSize / (channels * bytesPerSample));
  const durationSec = numFrames / sampleRate;

  console.log(`  Source: ${channels}ch / ${sampleRate}Hz / ${bitsPerSample}bit / ${numFrames} frames / ${durationSec.toFixed(2)}s`);

  if (sampleRate !== 44100 || bitsPerSample !== 16) {
    throw new Error(`Unexpected WAV format: ${channels}ch/${sampleRate}Hz/${bitsPerSample}bit — expected mono/44100/16`);
  }

  // Extract mono samples as Int16Array
  const samples = new Int16Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const o = dataStart + i * channels * bytesPerSample;
    samples[i] = buf.readInt16LE(o);
  }

  // For stereo input duplicate left channel as right for lamejs
  return { samples, numFrames, sampleRate };
}

// --- MP3 encoder (mono: encode as stereo with identical L/R to ensure compatibility) ---

function encodeMp3Mono(samples, sampleRate, kbps) {
  // lamejs Mp3Encoder(channels, sampleRate, kbps)
  // Encode as stereo (2ch) with identical L and R from mono source
  const mp3enc = new lamejs.Mp3Encoder(2, sampleRate, kbps);
  const chunks = [];

  const BLOCK = 1152; // lamejs requires multiples of 1152
  for (let i = 0; i < samples.length; i += BLOCK) {
    const block = samples.subarray(i, i + BLOCK);
    const encoded = mp3enc.encodeBuffer(block, block); // L=R=mono
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }

  const flushed = mp3enc.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed));

  return Buffer.concat(chunks);
}

// --- Convert one WAV to MP3 ---

function convertToMp3(srcPath, outName, kbps = 128) {
  const srcSizeKB = (readFileSync(srcPath).length / 1024).toFixed(0);
  const shortSrc = srcPath.split(/[\\/]/).slice(-1)[0];
  console.log(`\nConverting ${shortSrc} → ${outName}.mp3`);
  console.log(`  Input: ${srcSizeKB} KB`);

  const { samples, numFrames, sampleRate } = readWavMono16(srcPath);
  const mp3Buf = encodeMp3Mono(samples, sampleRate, kbps);

  const outSizeKB = (mp3Buf.length / 1024).toFixed(0);
  const durationSec = (numFrames / sampleRate).toFixed(2);
  const ratio = ((1 - mp3Buf.length / (parseInt(srcSizeKB) * 1024)) * 100).toFixed(0);

  console.log(`  Output: ${outSizeKB} KB, ${durationSec}s, ${kbps}kbps stereo-wrapped (${ratio}% smaller)`);

  const outPath = join(OUT_DIR, `${outName}.mp3`);
  writeFileSync(outPath, mp3Buf);
  console.log(`  → public/sounds/${outName}.mp3`);

  return { outPath, outSizeKB: parseInt(outSizeKB), srcSizeKB: parseInt(srcSizeKB) };
}

// --- Main ---

console.log('=== PomoCare new 4 alarm sounds MP3 conversion (mono/44100Hz/16bit → 128kbps MP3) ===');

mkdirSync(OUT_DIR, { recursive: true });

const CANDIDATES_DIR = 'G:/マイドライブ/pomocare-audio-sources/candidates';

const MAPPINGS = [
  { src: join(CANDIDATES_DIR, 'cand-11-wind-chime.wav'),            name: 'windchime', kbps: 128 },
  { src: join(CANDIDATES_DIR, 'cand-03c-chime-pachelbel-canon.wav'), name: 'canon',    kbps: 128 },
  { src: join(CANDIDATES_DIR, 'cand-13-boxing-bell.wav'),            name: 'boxing',   kbps: 128 },
  { src: join(CANDIDATES_DIR, 'cand-12-cuckoo-clock.wav'),           name: 'cuckoo',   kbps: 128 },
];

const results = [];
for (const { src, name, kbps } of MAPPINGS) {
  if (!existsSync(src)) {
    console.error(`\nERROR: source WAV not found: ${src}`);
    process.exit(1);
  }
  const r = convertToMp3(src, name, kbps);
  results.push({ name, ...r });
}

// Copy to Android raw resources
if (existsSync(join(ROOT, 'android'))) {
  console.log('\nCopying MP3 to Android raw resources:');
  mkdirSync(ANDROID_RAW_DIR, { recursive: true });
  for (const { name } of results) {
    const src = join(OUT_DIR, `${name}.mp3`);
    const dst = join(ANDROID_RAW_DIR, `${name}.mp3`);
    copyFileSync(src, dst);
    console.log(`  → android/app/src/main/res/raw/${name}.mp3`);
  }
}

console.log('\n=== Summary ===');
for (const { name, srcSizeKB, outSizeKB } of results) {
  const ratio = ((1 - outSizeKB / srcSizeKB) * 100).toFixed(0);
  console.log(`  ${name}: ${srcSizeKB} KB → ${outSizeKB} KB (-${ratio}%)`);
}
console.log('\nDone.');
