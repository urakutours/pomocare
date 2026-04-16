import type { AlarmSound, AlarmChannel, VibrationMode } from '@/types/settings';
import { classicWavB64, gentleWavB64, softWavB64 } from '@/assets/alarmWavData';
import { isNative } from '@/utils/platform';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

/* ------------------------------------------------------------------ */
/*  Shared AudioContext — mobile browsers require AudioContext to be   */
/*  created/resumed during a user gesture. We keep a single instance  */
/*  alive and "unlock" it on the first user tap (e.g. timer start).   */
/* ------------------------------------------------------------------ */
let sharedCtx: AudioContext | null = null;

/**
 * Must be called from a user-gesture handler (tap / click).
 * Creates the shared AudioContext, resumes it, and plays a silent
 * buffer so iOS WebKit marks the context as "allowed to play".
 * Also pre-unlocks HTMLAudioElement for iOS fallback.
 */
export function unlockAudio(): void {
  // Also request notification permission on first interaction
  requestNotificationPermission();

  // On native platforms, also request LocalNotifications permission
  // (fires Android 13+ runtime prompt). No-op on web.
  void requestNativeNotificationPermission();

  if (sharedCtx && sharedCtx.state === 'running') return;

  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = createAudioContext();
  }
  if (!sharedCtx) return;

  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }

  // Play a silent buffer to fully unlock on iOS
  try {
    const buf = sharedCtx.createBuffer(1, 1, 22050);
    const src = sharedCtx.createBufferSource();
    src.buffer = buf;
    src.connect(sharedCtx.destination);
    src.start(0);
  } catch {
    // ignore — context may not be fully ready yet
  }

  // Pre-unlock HTMLAudioElement on iOS (user-gesture context)
  unlockHtmlAudio();
}

/**
 * Try to resume the shared AudioContext (e.g. on visibilitychange).
 * Exported so useTimer can call it when the app returns to foreground.
 */
export function tryResumeAudio(): void {
  if (sharedCtx && sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
}

/* ------------------------------------------------------------------ */
/*  HTMLAudioElement fallback — for when AudioContext is suspended     */
/*  (e.g. iOS returning from background without user gesture).        */
/* ------------------------------------------------------------------ */
let htmlAudioUnlocked = false;

/** Pre-unlock HTMLAudioElement by playing silence during user gesture */
function unlockHtmlAudio(): void {
  if (htmlAudioUnlocked) return;
  try {
    const audio = new Audio();
    // Tiny silent WAV (44 bytes) as data URI
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    audio.volume = 0.01;
    audio.play().then(() => {
      htmlAudioUnlocked = true;
      audio.pause();
    }).catch(() => { /* ignore */ });
  } catch {
    // ignore
  }
}

/**
 * Play alarm via HTMLAudioElement (fallback when AudioContext is unavailable).
 * Returns true if playback started successfully.
 */
async function playAlarmViaHtmlAudio(
  sound: AlarmSound,
  repeat: number,
  volume: number,
): Promise<boolean> {
  if (sound === 'none') return false;
  const basePath = import.meta.env.BASE_URL || '/';
  const src = `${basePath}sounds/${sound}.wav`;

  return new Promise<boolean>((resolve) => {
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    let playCount = 0;

    const onEnded = () => {
      playCount++;
      if (playCount < repeat) {
        setTimeout(() => {
          audio.currentTime = 0;
          audio.play().catch(() => { /* ignore */ });
        }, 400);
      } else {
        audio.removeEventListener('ended', onEnded);
      }
    };
    audio.addEventListener('ended', onEnded);

    audio.play().then(() => resolve(true)).catch(() => resolve(false));
  });
}

/**
 * Request notification permission (called from user gesture).
 * On Android, Notification vibration works without user-gesture restrictions.
 */
function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/** Return the shared AudioContext (creating if needed) and try to resume it. */
function getSharedContext(): AudioContext | null {
  if (sharedCtx && sharedCtx.state !== 'closed') {
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  }
  sharedCtx = createAudioContext();
  if (sharedCtx && sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

/**
 * マスター GainNode を作成し、volume (0-100) に応じたゲインを設定
 */
function createMasterGain(ctx: AudioContext, volume: number): GainNode {
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume / 100));
  master.connect(ctx.destination);
  return master;
}

/**
 * Bell: ハンドベル音 - 打撃音 + 金属的倍音 + 急速アタック・長い余韻
 * ハンドベルらしい「コーン」という澄んだ金属打撃音
 */
function playBell(ctx: AudioContext, dest: AudioNode, startTime: number): number {
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
    gainNode.connect(dest);

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
  clickGain.connect(dest);
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
function playDigital(ctx: AudioContext, dest: AudioNode, startTime: number): number {
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
      gainNode.connect(dest);

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
function playKitchen(ctx: AudioContext, dest: AudioNode, startTime: number): number {
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
    gainNode.connect(dest);
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
    g2.connect(dest);
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
function playChime(ctx: AudioContext, dest: AudioNode, startTime: number): number {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDuration = 0.5;
  const noteGap = 0.12;

  notes.forEach((freq, i) => {
    const t = startTime + i * (noteDuration * 0.5 + noteGap);
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(dest);
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
  dest: AudioNode,
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
  source.connect(dest);
  source.start(startTime);
  return buffer.duration;
}

function playSingleAlarm(ctx: AudioContext, dest: AudioNode, sound: AlarmSound, startTime: number): number {
  if (sound === 'bell') return playBell(ctx, dest, startTime);
  if (sound === 'digital') return playDigital(ctx, dest, startTime);
  if (sound === 'chime') return playChime(ctx, dest, startTime);
  if (sound === 'kitchen') return playKitchen(ctx, dest, startTime);
  return 0;
}

/** WAVベースサウンドかどうか */
const WAV_SOUNDS: AlarmSound[] = ['classic', 'gentle', 'soft'];

/**
 * バイブレーションパターンを生成（振動ms, 休止ms, ...）
 * repeat 回分の短いバースト振動を鳴らす
 */
function buildVibrationPattern(repeat: number): number[] {
  const pattern: number[] = [];
  for (let i = 0; i < repeat; i++) {
    if (i > 0) pattern.push(400); // 休止
    pattern.push(300, 100, 300);  // 振動, 短い休止, 振動
  }
  return pattern;
}

function vibrate(repeat: number): void {
  if (!navigator.vibrate) return;
  navigator.vibrate(buildVibrationPattern(repeat));
}

/**
 * Send a system notification when the timer completes.
 * On Android, the notification triggers device vibration even without
 * a user-gesture context (unlike navigator.vibrate()).
 */
function sendTimerNotification(vibrationPattern?: number[]): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    // renotify & vibrate are valid Web Notification API properties but
    // missing from TypeScript's built-in NotificationOptions type.
    const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
      body: 'PomoCare',
      icon: '/icons/icon-192x192.png',
      tag: 'pomocare-timer',       // replace previous notification
      renotify: true,              // vibrate even if tag is reused
      silent: false,               // allow sound & vibration
    };
    if (vibrationPattern && vibrationPattern.length > 0) {
      options.vibrate = vibrationPattern;
    }
    new Notification('Timer Complete', options);
  } catch {
    // Notification constructor may fail in some contexts; ignore
  }
}

/* ================================================================== */
/*  Native (Capacitor) alarm handlers                                  */
/*  On Android/iOS native, use LocalNotifications + Haptics instead    */
/*  of Web Audio API to bypass all web audio limitations.              */
/* ================================================================== */

/** Android raw resource name (lowercase, with .wav) for a given alarm sound */
function nativeSoundResource(sound: AlarmSound): string | undefined {
  if (sound === 'none') return undefined;
  return `${sound}.wav`;
}

/**
 * Android 8+ では notification sound は channel ごとに固定のため、
 * サウンドごとに個別の channel を作成し、schedule 時に channelId で切替える。
 * 各 channel はアプリ起動時に一度だけ作成すれば OK。
 */
const NOTIFICATION_CHANNELS: { id: string; sound: AlarmSound }[] = [
  { id: 'pomocare-bell',    sound: 'bell'    },
  { id: 'pomocare-digital', sound: 'digital' },
  { id: 'pomocare-chime',   sound: 'chime'   },
  { id: 'pomocare-kitchen', sound: 'kitchen' },
  { id: 'pomocare-classic', sound: 'classic' },
  { id: 'pomocare-gentle',  sound: 'gentle'  },
  { id: 'pomocare-soft',    sound: 'soft'    },
  { id: 'pomocare-silent',  sound: 'none'    },
];

function channelIdFor(sound: AlarmSound): string {
  return NOTIFICATION_CHANNELS.find((c) => c.sound === sound)?.id ?? 'pomocare-bell';
}

/** Create one notification channel per sound. Idempotent — safe to call multiple times. */
export async function ensureNotificationChannels(): Promise<void> {
  if (!isNative()) return;
  for (const ch of NOTIFICATION_CHANNELS) {
    try {
      await LocalNotifications.createChannel({
        id: ch.id,
        name: ch.sound === 'none' ? 'PomoCare (Silent)' : `PomoCare ${ch.sound}`,
        description: 'PomoCare timer alerts',
        importance: 5,
        sound: ch.sound === 'none' ? undefined : nativeSoundResource(ch.sound),
        vibration: true,
        visibility: 1,
      });
    } catch {
      // ignore — channel may already exist or platform may not support createChannel
    }
  }
}

/** Fire an immediate native notification with custom sound (no schedule). */
async function playAlarmNative(
  sound: AlarmSound,
  _repeat: number,
  vibrationMode: VibrationMode,
): Promise<void> {
  const isSilent = sound === 'none';
  const shouldVibrate =
    vibrationMode === 'always' || (vibrationMode === 'silent' && isSilent);

  // Notification channel は sound も vibration も 1 回のみ（UI の「通知モードでは 1 回のみ」に合わせる）
  if (shouldVibrate) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch { /* ignore */ }
  }

  if (isSilent) return;

  // Fire an immediate system notification with sound.
  // Android 8+ では sound は channelId 経由で決まる（per-notification の sound は無視される）。
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 2147483647,
          title: 'Timer Complete',
          body: 'PomoCare',
          sound: nativeSoundResource(sound),
          channelId: channelIdFor(sound),
        },
      ],
    });
  } catch (err) {
    console.warn('[alarm] native notification failed:', err);
  }
}

/**
 * Schedule a native alarm at a future wall-clock time.
 * Called when the timer starts — the OS will fire the notification
 * even if the app is killed or the device is idle.
 * Returns the notification id (use it to cancel), or -1 on failure.
 */
export async function scheduleNativeAlarm(
  fireAt: number,
  sound: AlarmSound,
): Promise<number> {
  if (!isNative()) return -1;
  const isSilent = sound === 'none';
  // Notification id must fit in 32-bit int; derive deterministically from fireAt
  const id = Math.floor(fireAt / 1000) % 2147483647;

  // Stage 1: exact alarm with allowWhileIdle (requires SCHEDULE_EXACT_ALARM on Android 12+)
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Timer Complete',
          body: 'PomoCare',
          sound: isSilent ? undefined : nativeSoundResource(sound),
          channelId: channelIdFor(sound),
          schedule: { at: new Date(fireAt), allowWhileIdle: true },
        },
      ],
    });
    return id;
  } catch (err) {
    console.warn('[alarm] exact schedule failed, retrying without allowWhileIdle:', err);
  }

  // Stage 2: non-exact fallback (no allowWhileIdle) when SCHEDULE_EXACT_ALARM is denied
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Timer Complete',
          body: 'PomoCare',
          sound: isSilent ? undefined : nativeSoundResource(sound),
          channelId: channelIdFor(sound),
          schedule: { at: new Date(fireAt) },
        },
      ],
    });
    return id;
  } catch (err) {
    console.warn('[alarm] native schedule failed entirely:', err);
    return -1;
  }
}

/** Cancel a previously scheduled native alarm by id. */
export async function cancelNativeAlarm(id: number): Promise<void> {
  if (!isNative() || id < 0) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch { /* ignore */ }
}

/**
 * Request local notification permission on native platforms.
 * Safe to call on web — no-op there.
 */
export async function requestNativeNotificationPermission(): Promise<void> {
  if (!isNative()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch { /* ignore */ }
}

export function playAlarm(
  sound: AlarmSound,
  repeat: number,
  volume: number = 80,
  vibrationMode: VibrationMode = 'silent',
  channel: AlarmChannel = 'media',
): void {
  // --- Native + notification channel: OS 通知音（メディア音量と独立、repeat/volume 非対応） ---
  if (isNative() && channel === 'notification') {
    void playAlarmNative(sound, repeat, vibrationMode);
    return;
  }

  const isSilent = sound === 'none' || volume === 0;

  // バイブレーション判定
  const shouldVibrate = vibrationMode === 'always' || (vibrationMode === 'silent' && isSilent);
  if (shouldVibrate) {
    if (isNative()) {
      // Native: Capacitor Haptics を使用（navigator.vibrate は WebView で不安定）
      void (async () => {
        for (let i = 0; i < repeat; i++) {
          try {
            await Haptics.impact({ style: ImpactStyle.Heavy });
          } catch { /* ignore */ }
          if (i < repeat - 1) await new Promise((r) => setTimeout(r, 400));
        }
      })();
    } else {
      vibrate(repeat);
      sendTimerNotification(buildVibrationPattern(repeat));
    }
  } else if (!isNative()) {
    sendTimerNotification();
  }

  if (isSilent) return;

  // NOTE: Web で channel='notification' のパスは現状 UI でガードされ到達しない
  // （SettingsPanel.tsx の isNative() ガード）。将来拡張のため残す。
  if (channel === 'notification') {
    playViaNotificationChannel(repeat);
    return;
  }

  // --- Media channel: Web Audio / HTML5 Audio（volume と repeat に対応、メディア音量連動） ---
  playViaMediaChannel(sound, repeat, volume);
}

/**
 * Notification channel: fire system notifications with `silent: false`
 * to produce the default notification sound (works even when media is muted).
 */
function playViaNotificationChannel(repeat: number): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  for (let i = 0; i < repeat; i++) {
    setTimeout(() => {
      try {
        const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
          body: 'PomoCare',
          icon: '/icons/icon-192x192.png',
          tag: `pomocare-timer-${i}`, // unique tag per repeat so each one sounds
          renotify: true,
          silent: false,
          vibrate: [300, 100, 300],
        };
        new Notification('Timer Complete', options);
      } catch { /* ignore */ }
    }, i * 1500);
  }
}

/**
 * Media channel: try Web Audio API first, fall back to HTMLAudioElement,
 * then finally to system notification sound.
 */
function playViaMediaChannel(sound: AlarmSound, repeat: number, volume: number): void {
  const ctx = getSharedContext();

  // Attempt Web Audio API
  if (ctx) {
    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      // Check if context is actually running after resume attempt
      if (ctx.state === 'running') {
        const master = createMasterGain(ctx, volume);
        if (WAV_SOUNDS.includes(sound)) {
          void (async () => {
            const gap = 0.4;
            let cursor = ctx.currentTime;
            for (let i = 0; i < repeat; i++) {
              const d = await playWavAlarm(ctx, master, sound, cursor);
              cursor += d + gap;
            }
          })();
        } else {
          let cursor = ctx.currentTime;
          const gap = 0.4;
          for (let i = 0; i < repeat; i++) {
            const d = playSingleAlarm(ctx, master, sound, cursor);
            cursor += d + gap;
          }
        }
      } else {
        // AudioContext still suspended (e.g. iOS after background) — try HTMLAudioElement
        void playAlarmViaHtmlAudio(sound, repeat, volume).then((ok) => {
          if (!ok) {
            // Last resort: fire a notification with sound
            playViaNotificationChannel(1);
          }
        });
      }
    }).catch(() => {
      // resume() rejected — try HTMLAudioElement fallback
      void playAlarmViaHtmlAudio(sound, repeat, volume).then((ok) => {
        if (!ok) playViaNotificationChannel(1);
      });
    });
  } else {
    // No AudioContext available — try HTMLAudioElement directly
    void playAlarmViaHtmlAudio(sound, repeat, volume).then((ok) => {
      if (!ok) playViaNotificationChannel(1);
    });
  }
}

/** プレビュー: 指定の繰り返し回数で再生 */
export function previewAlarm(
  sound: AlarmSound,
  repeat: number,
  volume: number = 80,
  vibrationMode: VibrationMode = 'silent',
  channel: AlarmChannel = 'media',
): void {
  playAlarm(sound, repeat, volume, vibrationMode, channel);
}
