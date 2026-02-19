import type { AlarmSound } from '@/types/settings';
import { classicWavB64, gentleWavB64, softWavB64 } from '@/assets/alarmWavData';

/**
 * Generate alarm sound using Web Audio API (no external audio files needed)
 */
function createAudioContext(): AudioContext | null {
  try {
    return new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
  } catch {
    return null;
  }
}

/**
 * Bell: ハンドベル音 - 打撃音 + 金属的倍音 + 急速アタック・長い余韻
 * ハンドベルらしい「コーン」という澄んだ金属打撃音
 */
function playBell(ctx: AudioContext, startTime: number): number {
  const duration = 3.2;

  // ハンドベルの基本音 (E5 = 659Hz 付近)
  // 非整数倍音が金属っぽさを生む
  const partials: { freq: number; gain: number; decay: number; detune: number }[] = [
    { freq: 659,   gain: 0.50, decay: duration,        detune: 0 },      // 基音
    { freq: 1318,  gain: 0.18, decay: duration * 0.75, detune: 0 },      // 2倍音
    { freq: 1976,  gain: 0.12, decay: duration * 0.55, detune: 5 },      // 3倍音 (少しシャープ)
    { freq: 2794,  gain: 0.09, decay: duration * 0.40, detune: -8 },     // 非整数倍音
    { freq: 3729,  gain: 0.06, decay: duration * 0.30, detune: 10 },     // 倍音
    { freq: 5273,  gain: 0.04, decay: duration * 0.20, detune: -5 },     // 高倍音
  ];

  partials.forEach(({ freq, gain, decay, detune }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    const f = freq * Math.pow(2, detune / 1200); // cent detune
    osc.frequency.setValueAtTime(f, startTime);
    // ハンドベルは打撃後わずかにピッチが下がる
    osc.frequency.exponentialRampToValueAtTime(f * 0.995, startTime + duration);

    gainNode.gain.setValueAtTime(0, startTime);
    // 非常に鋭いアタック (ハンドベルらしさ)
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.003);
    // 最初に素早く減衰してから長い余韻
    gainNode.gain.exponentialRampToValueAtTime(gain * 0.3, startTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

    osc.start(startTime);
    osc.stop(startTime + decay);
  });

  // 打撃音 (クリック成分 - ベルを叩く瞬間の音)
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  const clickFilter = ctx.createBiquadFilter();
  clickOsc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(ctx.destination);
  clickFilter.type = 'bandpass';
  clickFilter.frequency.setValueAtTime(4000, startTime);
  clickFilter.Q.setValueAtTime(0.5, startTime);
  clickOsc.type = 'square';
  clickOsc.frequency.setValueAtTime(800, startTime);
  clickGain.gain.setValueAtTime(0, startTime);
  clickGain.gain.linearRampToValueAtTime(0.15, startTime + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);
  clickOsc.start(startTime);
  clickOsc.stop(startTime + 0.05);

  return duration;
}

/**
 * Digital: 目覚まし時計風 - 「ピピピ、ピピピ、ピピピ」の3連パターン
 */
function playDigital(ctx: AudioContext, startTime: number): number {
  // 3回の「ピピピ」を繰り返す
  const beepFreq = 880;    // ピ の周波数
  const beepOn   = 0.07;   // 1ビープのON時間
  const beepOff  = 0.05;   // 1ビープ間のOFF
  const burstSize = 3;     // 「ピピピ」の回数
  const burstGap  = 0.20;  // 「ピピピ」間の沈黙
  const totalBursts = 3;   // 3回繰り返す

  const burstDuration = burstSize * (beepOn + beepOff) - beepOff; // 1バーストの長さ
  const totalDuration = totalBursts * (burstDuration + burstGap) - burstGap;

  for (let burst = 0; burst < totalBursts; burst++) {
    const burstStart = startTime + burst * (burstDuration + burstGap);
    for (let b = 0; b < burstSize; b++) {
      const t = burstStart + b * (beepOn + beepOff);

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, t);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'square';
      // 最初のビープを少し高く (デジタル感)
      osc.frequency.setValueAtTime(b === 0 ? beepFreq * 1.05 : beepFreq, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.22, t + 0.004);
      gainNode.gain.setValueAtTime(0.22, t + beepOn - 0.008);
      gainNode.gain.linearRampToValueAtTime(0, t + beepOn);

      osc.start(t);
      osc.stop(t + beepOn + 0.01);
    }
  }

  return totalDuration;
}

/**
 * Kitchen Timer: ポモドーロ型キッチンタイマーの「チーン」音
 * ゼンマイが解ける最後の「チン！」をイメージした金属的な高音
 */
function playKitchen(ctx: AudioContext, startTime: number): number {
  const duration = 3.0;

  // メインの「チン！」: 高い金属音
  const mainPartials: { freq: number; gain: number; decay: number }[] = [
    { freq: 2000, gain: 0.45, decay: duration },
    { freq: 4000, gain: 0.25, decay: duration * 0.7 },
    { freq: 6500, gain: 0.15, decay: duration * 0.5 },
    { freq: 1000, gain: 0.20, decay: duration * 0.8 },
  ];

  mainPartials.forEach(({ freq, gain, decay }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.97, startTime + decay);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
    osc.start(startTime);
    osc.stop(startTime + decay);
  });

  // ゼンマイの「カチカチ」余韻 (0.3秒後に短いノイズバースト)
  for (let i = 0; i < 3; i++) {
    const t = startTime + 0.3 + i * 0.15;
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800 - i * 80, t);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.05, t + 0.005);
    g2.gain.linearRampToValueAtTime(0, t + 0.04);
    osc2.start(t);
    osc2.stop(t + 0.05);
  }

  return duration;
}

/**
 * Chime: 3音アルペジオ
 */
function playChime(ctx: AudioContext, startTime: number): number {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDuration = 0.5;
  const noteGap = 0.12;

  notes.forEach((freq, i) => {
    const t = startTime + i * (noteDuration * 0.5 + noteGap);
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.35, t + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + noteDuration);
    osc.start(t);
    osc.stop(t + noteDuration);
  });

  return notes.length * (noteDuration * 0.5 + noteGap) + noteDuration;
}

/**
 * WAV (Base64) → AudioBuffer のキャッシュ
 */
const wavBufferCache: Partial<Record<AlarmSound, AudioBuffer | null>> = {};

async function decodeWavB64(ctx: AudioContext, b64: string): Promise<AudioBuffer | null> {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return await ctx.decodeAudioData(bytes.buffer);
  } catch {
    return null;
  }
}

const WAV_B64_MAP: Partial<Record<AlarmSound, string>> = {
  classic: classicWavB64,
  gentle:  gentleWavB64,
  soft:    softWavB64,
};

/**
 * WAVアラーム音を再生し、再生時間(秒)を返す
 */
async function playWavAlarm(
  ctx: AudioContext,
  sound: AlarmSound,
  startTime: number,
): Promise<number> {
  const b64 = WAV_B64_MAP[sound];
  if (!b64) return 0;

  let buffer = wavBufferCache[sound];
  if (buffer === undefined) {
    buffer = await decodeWavB64(ctx, b64);
    wavBufferCache[sound] = buffer;
  }
  if (!buffer) return 0;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(startTime);
  return buffer.duration;
}

function playSingleAlarm(ctx: AudioContext, sound: AlarmSound, startTime: number): number {
  if (sound === 'bell') return playBell(ctx, startTime);
  if (sound === 'digital') return playDigital(ctx, startTime);
  if (sound === 'chime') return playChime(ctx, startTime);
  if (sound === 'kitchen') return playKitchen(ctx, startTime);
  return 0;
}

/** WAVベースサウンドかどうか */
const WAV_SOUNDS: AlarmSound[] = ['classic', 'gentle', 'soft'];

export function playAlarm(sound: AlarmSound, repeat: number): void {
  if (sound === 'none') return;

  const ctx = createAudioContext();
  if (!ctx) return;

  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();

  if (WAV_SOUNDS.includes(sound)) {
    // WAVベースのサウンドは非同期で順次スケジュール
    resume.then(async () => {
      const gap = 0.4;
      let cursor = ctx.currentTime;
      for (let i = 0; i < repeat; i++) {
        const d = await playWavAlarm(ctx, sound, cursor);
        cursor += d + gap;
      }
      setTimeout(() => ctx.close(), (cursor - ctx.currentTime + 1) * 1000);
    });
  } else {
    resume.then(() => {
      const now = ctx.currentTime;
      let cursor = now;
      const gap = 0.4;

      for (let i = 0; i < repeat; i++) {
        const d = playSingleAlarm(ctx, sound, cursor);
        cursor += d + gap;
      }

      setTimeout(() => ctx.close(), (cursor - now + 1) * 1000);
    });
  }
}

/** プレビュー: 指定の繰り返し回数で再生 */
export function previewAlarm(sound: AlarmSound, repeat: number): void {
  playAlarm(sound, repeat);
}
