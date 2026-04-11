/**
 * Generate alarm sound WAV files for HTMLAudioElement fallback AND
 * copy them to the Android raw resources directory for Capacitor.
 * Runs in Node.js — no external audio packages needed.
 *
 * Usage: node scripts/generate-alarm-sounds.mjs
 *
 * Outputs:
 *   - public/sounds/{bell,digital,chime,kitchen,classic,gentle,soft}.wav (web)
 *   - android/app/src/main/res/raw/{...}.wav (native Android, if dir exists)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'sounds');
const ANDROID_RAW_DIR = join(ROOT, 'android', 'app', 'src', 'main', 'res', 'raw');

mkdirSync(OUT_DIR, { recursive: true });

const SAMPLE_RATE = 44100;

// --- WAV file writer ---

function writeWav(filename, samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const bitsPerSample = 16;
  const byteRate = sampleRate * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buf.write('RIFF', offset); offset += 4;
  buf.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buf.write('WAVE', offset); offset += 4;

  // fmt chunk
  buf.write('fmt ', offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4; // chunk size
  buf.writeUInt16LE(1, offset); offset += 2;  // PCM
  buf.writeUInt16LE(1, offset); offset += 2;  // mono
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(byteRate, offset); offset += 4;
  buf.writeUInt16LE(2, offset); offset += 2;  // block align
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buf.write('data', offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buf.writeInt16LE(Math.round(val), offset);
    offset += 2;
  }

  const path = join(OUT_DIR, filename);
  writeFileSync(path, buf);
  console.log(`  -> ${filename} (${(buf.length / 1024).toFixed(1)} KB, ${(numSamples / sampleRate).toFixed(2)}s)`);
}

// --- Envelope helpers ---

function linearRamp(startVal, endVal, startSample, endSample, currentSample) {
  if (currentSample <= startSample) return startVal;
  if (currentSample >= endSample) return endVal;
  const t = (currentSample - startSample) / (endSample - startSample);
  return startVal + (endVal - startVal) * t;
}

function expRamp(startVal, endVal, startSample, endSample, currentSample) {
  if (currentSample <= startSample) return startVal;
  if (currentSample >= endSample) return endVal;
  const safeStart = Math.max(startVal, 0.0001);
  const safeEnd = Math.max(endVal, 0.0001);
  const t = (currentSample - startSample) / (endSample - startSample);
  return safeStart * Math.pow(safeEnd / safeStart, t);
}

// --- Synthesized sounds (matching alarm.ts parameters) ---

function generateBell() {
  const duration = 3.2;
  const totalSamples = Math.ceil(duration * SAMPLE_RATE);
  const samples = new Float64Array(totalSamples);

  const partials = [
    { freq: 659,  gain: 0.50, decay: duration,        detune: 0 },
    { freq: 1318, gain: 0.18, decay: duration * 0.75, detune: 0 },
    { freq: 1976, gain: 0.12, decay: duration * 0.55, detune: 5 },
    { freq: 2794, gain: 0.09, decay: duration * 0.40, detune: -8 },
    { freq: 3729, gain: 0.06, decay: duration * 0.30, detune: 10 },
    { freq: 5273, gain: 0.04, decay: duration * 0.20, detune: -5 },
  ];

  for (const { freq, gain, decay, detune } of partials) {
    const f = freq * Math.pow(2, detune / 1200);
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      if (t > decay) break;
      const currentFreq = f * Math.pow(0.995, t / duration); // slight pitch drop
      let env;
      if (t < 0.003) {
        env = linearRamp(0, gain, 0, 0.003 * SAMPLE_RATE, i);
      } else if (t < 0.15) {
        env = expRamp(gain, gain * 0.3, 0.003 * SAMPLE_RATE, 0.15 * SAMPLE_RATE, i);
      } else {
        env = expRamp(gain * 0.3, 0.0001, 0.15 * SAMPLE_RATE, decay * SAMPLE_RATE, i);
      }
      samples[i] += Math.sin(2 * Math.PI * currentFreq * t) * env;
    }
  }

  // Click component
  for (let i = 0; i < Math.min(0.05 * SAMPLE_RATE, totalSamples); i++) {
    const t = i / SAMPLE_RATE;
    let env;
    if (t < 0.002) {
      env = linearRamp(0, 0.15, 0, 0.002 * SAMPLE_RATE, i);
    } else {
      env = expRamp(0.15, 0.0001, 0.002 * SAMPLE_RATE, 0.04 * SAMPLE_RATE, i);
    }
    // Bandpass-filtered square wave approximation
    const sq = Math.sign(Math.sin(2 * Math.PI * 800 * t));
    samples[i] += sq * env * 0.3; // reduce for approximation
  }

  return { samples, duration };
}

function generateDigital() {
  const beepFreq = 880;
  const beepOn = 0.07;
  const beepOff = 0.05;
  const burstSize = 3;
  const burstGap = 0.20;
  const totalBursts = 3;

  const burstDuration = burstSize * (beepOn + beepOff) - beepOff;
  const totalDuration = totalBursts * (burstDuration + burstGap) - burstGap;
  const totalSamples = Math.ceil((totalDuration + 0.1) * SAMPLE_RATE);
  const samples = new Float64Array(totalSamples);

  for (let burst = 0; burst < totalBursts; burst++) {
    const burstStart = burst * (burstDuration + burstGap);
    for (let b = 0; b < burstSize; b++) {
      const tStart = burstStart + b * (beepOn + beepOff);
      const freq = b === 0 ? beepFreq * 1.05 : beepFreq;
      const sStart = Math.floor(tStart * SAMPLE_RATE);
      const sEnd = Math.floor((tStart + beepOn) * SAMPLE_RATE);

      for (let i = sStart; i < sEnd && i < totalSamples; i++) {
        const t = i / SAMPLE_RATE;
        const localT = t - tStart;
        let env;
        if (localT < 0.004) {
          env = linearRamp(0, 0.22, 0, 0.004 * SAMPLE_RATE, i - sStart);
        } else if (localT > beepOn - 0.008) {
          env = linearRamp(0.22, 0, (beepOn - 0.008) * SAMPLE_RATE, beepOn * SAMPLE_RATE, i - sStart);
        } else {
          env = 0.22;
        }
        // Square wave with rough lowpass
        const sq = Math.sign(Math.sin(2 * Math.PI * freq * t));
        samples[i] += sq * env;
      }
    }
  }

  return { samples, duration: totalDuration + 0.05 };
}

function generateKitchen() {
  const duration = 3.0;
  const totalSamples = Math.ceil(duration * SAMPLE_RATE);
  const samples = new Float64Array(totalSamples);

  const mainPartials = [
    { freq: 2000, gain: 0.45, decay: duration },
    { freq: 4000, gain: 0.25, decay: duration * 0.7 },
    { freq: 6500, gain: 0.15, decay: duration * 0.5 },
    { freq: 1000, gain: 0.20, decay: duration * 0.8 },
  ];

  for (const { freq, gain, decay } of mainPartials) {
    for (let i = 0; i < totalSamples; i++) {
      const t = i / SAMPLE_RATE;
      if (t > decay) break;
      const currentFreq = freq * Math.pow(0.97, t / decay);
      let env;
      if (t < 0.003) {
        env = linearRamp(0, gain, 0, 0.003 * SAMPLE_RATE, i);
      } else {
        env = expRamp(gain, 0.0001, 0.003 * SAMPLE_RATE, decay * SAMPLE_RATE, i);
      }
      samples[i] += Math.sin(2 * Math.PI * currentFreq * t) * env;
    }
  }

  // Ratchet clicks
  for (let j = 0; j < 3; j++) {
    const clickStart = 0.3 + j * 0.15;
    const sStart = Math.floor(clickStart * SAMPLE_RATE);
    const sEnd = Math.floor((clickStart + 0.05) * SAMPLE_RATE);
    const clickFreq = 800 - j * 80;
    for (let i = sStart; i < sEnd && i < totalSamples; i++) {
      const localT = (i - sStart) / SAMPLE_RATE;
      let env;
      if (localT < 0.005) {
        env = linearRamp(0, 0.05, 0, 0.005 * SAMPLE_RATE, i - sStart);
      } else {
        env = linearRamp(0.05, 0, 0.005 * SAMPLE_RATE, 0.04 * SAMPLE_RATE, i - sStart);
      }
      const sq = Math.sign(Math.sin(2 * Math.PI * clickFreq * (i / SAMPLE_RATE)));
      samples[i] += sq * env;
    }
  }

  return { samples, duration };
}

function generateChime() {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDuration = 0.5;
  const noteGap = 0.12;

  const totalDuration = notes.length * (noteDuration * 0.5 + noteGap) + noteDuration;
  const totalSamples = Math.ceil(totalDuration * SAMPLE_RATE);
  const samples = new Float64Array(totalSamples);

  notes.forEach((freq, idx) => {
    const noteStart = idx * (noteDuration * 0.5 + noteGap);
    const sStart = Math.floor(noteStart * SAMPLE_RATE);

    for (let i = 0; i < Math.floor(noteDuration * SAMPLE_RATE); i++) {
      const si = sStart + i;
      if (si >= totalSamples) break;
      const t = i / SAMPLE_RATE;
      let env;
      if (t < 0.005) {
        env = linearRamp(0, 0.35, 0, 0.005 * SAMPLE_RATE, i);
      } else {
        env = expRamp(0.35, 0.0001, 0.005 * SAMPLE_RATE, noteDuration * SAMPLE_RATE, i);
      }
      samples[si] += Math.sin(2 * Math.PI * freq * t) * env;
    }
  });

  return { samples, duration: totalDuration };
}

// --- WAV-based sounds (decode from Base64 in alarmWavData.ts) ---

function extractBase64FromTs(varName) {
  const tsPath = join(ROOT, 'src', 'assets', 'alarmWavData.ts');
  const content = readFileSync(tsPath, 'utf-8');

  // Match: export const varName = "...";
  const regex = new RegExp(`export const ${varName}\\s*=\\s*"([^"]+)"`);
  const match = content.match(regex);
  if (!match) {
    console.warn(`  !! Could not find ${varName} in alarmWavData.ts`);
    return null;
  }
  return match[1];
}

function decodeWavFromBase64(varName, filename) {
  const b64 = extractBase64FromTs(varName);
  if (!b64) return;

  const buf = Buffer.from(b64, 'base64');
  const path = join(OUT_DIR, filename);
  writeFileSync(path, buf);
  console.log(`  -> ${filename} (${(buf.length / 1024).toFixed(1)} KB, decoded from Base64)`);
}

// --- Main ---

console.log('Generating alarm sound files...\n');

// Synthesized sounds
console.log('Synthesized sounds:');
const bell = generateBell();
writeWav('bell.wav', bell.samples);

const digital = generateDigital();
writeWav('digital.wav', digital.samples);

const kitchen = generateKitchen();
writeWav('kitchen.wav', kitchen.samples);

const chime = generateChime();
writeWav('chime.wav', chime.samples);

// WAV-based sounds (decoded from Base64)
console.log('\nWAV-based sounds (from Base64):');
decodeWavFromBase64('classicWavB64', 'classic.wav');
decodeWavFromBase64('gentleWavB64', 'gentle.wav');
decodeWavFromBase64('softWavB64', 'soft.wav');

console.log('\nWeb files written to public/sounds/');

// --- Copy to Android raw resources (for Capacitor native notifications) ---
// Capacitor's LocalNotifications plugin reads sound files from res/raw/.
// File names must be lowercase alphanumeric + underscore only (already OK).
if (existsSync(join(ROOT, 'android'))) {
  console.log('\nCopying to Android raw resources:');
  mkdirSync(ANDROID_RAW_DIR, { recursive: true });
  const soundFiles = readdirSync(OUT_DIR).filter((f) => f.endsWith('.wav'));
  for (const file of soundFiles) {
    const src = join(OUT_DIR, file);
    const dst = join(ANDROID_RAW_DIR, file);
    copyFileSync(src, dst);
    console.log(`  -> android/app/src/main/res/raw/${file}`);
  }
  console.log(`\nDone! ${soundFiles.length} files copied to Android raw resources.`);
} else {
  console.log('\n(android/ directory not found — skipping Android copy)');
}

