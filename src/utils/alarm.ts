import type { AlarmSound } from '@/types/settings';

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
 * Bell: リアルなベル音 - 複数倍音 + ピッチ微下降
 */
function playBell(ctx: AudioContext, startTime: number): number {
  const duration = 2.5;

  const partials: { freq: number; gain: number; decay: number }[] = [
    { freq: 440,  gain: 0.40, decay: duration },
    { freq: 880,  gain: 0.20, decay: duration * 0.8 },
    { freq: 1318, gain: 0.15, decay: duration * 0.6 },
    { freq: 1760, gain: 0.10, decay: duration * 0.5 },
    { freq: 2217, gain: 0.07, decay: duration * 0.4 },
    { freq: 2637, gain: 0.05, decay: duration * 0.3 },
  ];

  partials.forEach(({ freq, gain, decay }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.98, startTime + duration);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

    osc.start(startTime);
    osc.stop(startTime + decay);
  });

  return duration;
}

/**
 * Digital: 電子目覚ましアラーム - 矩形波パルスの連続ビープ
 */
function playDigital(ctx: AudioContext, startTime: number): number {
  const beepFreq = 1040;
  const pulseOn = 0.08;
  const pulseOff = 0.04;
  const cycleTime = pulseOn + pulseOff;
  const totalBeeps = 8;
  const totalDuration = totalBeeps * cycleTime;

  for (let i = 0; i < totalBeeps; i++) {
    const t = startTime + i * cycleTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(i % 2 === 0 ? beepFreq * 1.06 : beepFreq, t);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.25, t + 0.005);
    gainNode.gain.setValueAtTime(0.25, t + pulseOn - 0.01);
    gainNode.gain.linearRampToValueAtTime(0, t + pulseOn);

    osc.start(t);
    osc.stop(t + pulseOn);
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

function playSingleAlarm(ctx: AudioContext, sound: AlarmSound, startTime: number): number {
  if (sound === 'bell') return playBell(ctx, startTime);
  if (sound === 'digital') return playDigital(ctx, startTime);
  if (sound === 'chime') return playChime(ctx, startTime);
  if (sound === 'kitchen') return playKitchen(ctx, startTime);
  return 0;
}

export function playAlarm(sound: AlarmSound, repeat: number): void {
  if (sound === 'none') return;

  const ctx = createAudioContext();
  if (!ctx) return;

  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
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

/** プレビュー: 指定の繰り返し回数で再生 */
export function previewAlarm(sound: AlarmSound, repeat: number): void {
  playAlarm(sound, repeat);
}
