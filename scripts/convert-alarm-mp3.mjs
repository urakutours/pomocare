/**
 * Convert master WAV files (PAlarm*.wav) to MP3 for pomocare alarm sounds.
 *
 * Mapping (determined by cross-correlation with existing public/sounds/*.wav):
 *   D:/ダウンロード/PAlarm.wav   → classic.mp3  (4.0s, corr=0.9963 with classic.wav)
 *   D:/ダウンロード/PAlarm2.wav  → gentle.mp3   (30.8s, corr=0.9997 with gentle.wav)
 *   D:/ダウンロード/PAlarm3.wav  → soft.mp3     (30.8s, corr=0.9925 with soft.wav)
 *
 * Output:
 *   public/sounds/classic.mp3  gentle.mp3  soft.mp3
 *   android/app/src/main/res/raw/classic.mp3  gentle.mp3  soft.mp3
 *
 * Usage: node scripts/convert-alarm-mp3.mjs
 *
 * Notes:
 *   - Uses lamejs (lame.min.js bundle) loaded via Node.js vm module to avoid
 *     CJS MPEGMode scope issue in lamejs/src/js/index.js
 *   - Source: 2ch / 48kHz / 24bit → Target: 2ch / 44.1kHz / 16bit / 128kbps MP3
 *   - Resampling: linear interpolation (adequate for 48k→44.1k)
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

// --- WAV reader: returns stereo int16 at 44100Hz ---

function readWavStereoAs44k16(path) {
  const buf = readFileSync(path);

  let offset = 12;
  let channels = 2, sampleRate = 48000, bitsPerSample = 24;
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
  const frameSize = channels * bytesPerSample;
  const numFrames = Math.floor(dataSize / frameSize);

  console.log(`  Source: ${channels}ch / ${sampleRate}Hz / ${bitsPerSample}bit / ${numFrames} frames / ${(numFrames / sampleRate).toFixed(3)}s`);

  const TARGET_RATE = 44100;
  const targetFrames = Math.ceil(numFrames * TARGET_RATE / sampleRate);

  const leftOut  = new Int16Array(targetFrames);
  const rightOut = new Int16Array(targetFrames);

  const getSample = (frame, ch) => {
    if (frame >= numFrames) return 0;
    const o = dataStart + frame * frameSize + ch * bytesPerSample;
    if (o + bytesPerSample > buf.length) return 0;
    if (bitsPerSample === 24) {
      const b0 = buf[o], b1 = buf[o + 1], b2 = buf[o + 2];
      let v = b0 | (b1 << 8) | (b2 << 16);
      if (v & 0x800000) v -= 0x1000000; // sign-extend
      return v >> 8; // 24bit → 16bit
    } else if (bitsPerSample === 16) {
      return buf.readInt16LE(o);
    } else if (bitsPerSample === 32) {
      return buf.readInt32LE(o) >> 16;
    }
    return 0;
  };

  const rCh = Math.min(1, channels - 1);

  for (let i = 0; i < targetFrames; i++) {
    const srcPos = i * sampleRate / TARGET_RATE;
    const srcIdx = Math.floor(srcPos);
    const frac   = srcPos - srcIdx;

    const lA = getSample(srcIdx,     0);
    const lB = getSample(srcIdx + 1, 0);
    leftOut[i]  = Math.round(lA + (lB - lA) * frac);

    const rA = getSample(srcIdx,     rCh);
    const rB = getSample(srcIdx + 1, rCh);
    rightOut[i] = Math.round(rA + (rB - rA) * frac);
  }

  return { leftOut, rightOut, targetFrames, targetRate: TARGET_RATE };
}

// --- MP3 encoder ---

function encodeMp3Stereo(left, right, sampleRate, kbps) {
  const mp3enc = new lamejs.Mp3Encoder(2, sampleRate, kbps);
  const chunks = [];

  const BLOCK = 1152; // lamejs requires multiples of 1152
  for (let i = 0; i < left.length; i += BLOCK) {
    const lBlock = left.subarray(i, i + BLOCK);
    const rBlock = right.subarray(i, i + BLOCK);
    const encoded = mp3enc.encodeBuffer(lBlock, rBlock);
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }

  const flushed = mp3enc.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed));

  return Buffer.concat(chunks);
}

// --- Convert one master file ---

function convertToMp3(srcPath, outName, kbps = 128) {
  const srcSizeKB = (readFileSync(srcPath).length / 1024).toFixed(0);
  console.log(`\nConverting ${srcPath.split('/').pop()} → ${outName}.mp3`);
  console.log(`  Input: ${srcSizeKB} KB (${(parseInt(srcSizeKB) / 1024).toFixed(2)} MB)`);

  const { leftOut, rightOut, targetFrames, targetRate } = readWavStereoAs44k16(srcPath);
  const mp3Buf = encodeMp3Stereo(leftOut, rightOut, targetRate, kbps);

  const outSizeKB = (mp3Buf.length / 1024).toFixed(0);
  const durationSec = (targetFrames / targetRate).toFixed(2);
  const ratio = ((1 - mp3Buf.length / (parseInt(srcSizeKB) * 1024)) * 100).toFixed(0);

  console.log(`  Output: ${outSizeKB} KB, ${durationSec}s, ${kbps}kbps stereo (${ratio}% smaller)`);

  const outPath = join(OUT_DIR, `${outName}.mp3`);
  writeFileSync(outPath, mp3Buf);
  console.log(`  → public/sounds/${outName}.mp3`);

  return { outPath, outSizeKB: parseInt(outSizeKB), srcSizeKB: parseInt(srcSizeKB) };
}

// --- Main ---

console.log('=== PomoCare alarm MP3 conversion (48kHz/24bit stereo → 44.1kHz/16bit 128kbps MP3) ===');

mkdirSync(OUT_DIR, { recursive: true });

const MAPPINGS = [
  { src: 'D:/ダウンロード/PAlarm.wav',  name: 'classic', kbps: 128 },
  { src: 'D:/ダウンロード/PAlarm2.wav', name: 'gentle',  kbps: 128 },
  { src: 'D:/ダウンロード/PAlarm3.wav', name: 'soft',    kbps: 128 },
];

const results = [];
for (const { src, name, kbps } of MAPPINGS) {
  if (!existsSync(src)) {
    console.error(`\nERROR: master file not found: ${src}`);
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
