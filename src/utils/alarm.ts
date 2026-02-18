import type { AlarmSound } from '@/types/settings';

/**
 * Generate alarm sound using Web Audio API (no external audio files needed)
 */
function createAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playBell(ctx: AudioContext, startTime: number): number {
  const duration = 1.5;
  // Fundamental + harmonics for bell-like sound
  const freqs = [880, 1760, 2640];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    const vol = 0.3 / (i + 1);
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  });
  return duration;
}

function playDigital(ctx: AudioContext, startTime: number): number {
  // Two-tone digital beep
  const beepDuration = 0.15;
  const gap = 0.05;
  const tones = [1000, 1200];
  tones.forEach((freq, i) => {
    const t = startTime + i * (beepDuration + gap);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.setValueAtTime(0.2, t + beepDuration - 0.01);
    gain.gain.linearRampToValueAtTime(0, t + beepDuration);
    osc.start(t);
    osc.stop(t + beepDuration);
  });
  return beepDuration * 2 + gap;
}

function playChime(ctx: AudioContext, startTime: number): number {
  // Three ascending notes
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDuration = 0.4;
  const noteGap = 0.15;
  notes.forEach((freq, i) => {
    const t = startTime + i * (noteDuration * 0.6 + noteGap);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);
    osc.start(t);
    osc.stop(t + noteDuration);
  });
  return notes.length * (noteDuration * 0.6 + noteGap) + noteDuration;
}

export function playAlarm(sound: AlarmSound, repeat: number): void {
  if (sound === 'none') return;

  const ctx = createAudioContext();
  if (!ctx) return;

  // Resume suspended context (required after user interaction)
  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  resume.then(() => {
    const now = ctx.currentTime;
    let singleDuration = 0;

    for (let i = 0; i < repeat; i++) {
      const t = now + i * (singleDuration + 0.3);
      if (sound === 'bell') {
        singleDuration = playBell(ctx, t);
      } else if (sound === 'digital') {
        singleDuration = playDigital(ctx, t);
      } else if (sound === 'chime') {
        singleDuration = playChime(ctx, t);
      }
    }

    // Close context after all sounds finish
    const totalDuration = repeat * (singleDuration + 0.3) + 1;
    setTimeout(() => ctx.close(), totalDuration * 1000);
  });
}

/** Preview a single play for settings UI */
export function previewAlarm(sound: AlarmSound): void {
  playAlarm(sound, 1);
}
