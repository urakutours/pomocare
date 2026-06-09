import type { AlarmSound, VibrationMode } from '@/types/settings';
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

  // 永続 HTMLAudioElement をこのジェスチャで解除する（成功するまで毎ジェスチャ試行）。
  // AudioContext が後で suspended / 復帰不能になっても、この要素経由で前面アラームを鳴らせる。
  unlockHtmlAudio();

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

/**
 * 単一の永続 HTMLAudioElement。START タップ（ユーザージェスチャ）中に一度 play() して
 * iOS / モバイルのオートプレイ制限を解除し、以後この「同一要素」を使い回す。
 * iOS はジェスチャで一度解除した要素の再生は後から（ジェスチャ無しでも）許可するが、
 * 毎回 new Audio() した新規要素はブロックする。タイマー終了コールバックは
 * ジェスチャを持たないため、前面で確実に鳴らすにはこの primed 要素を再利用する必要がある。
 */
let primedAudio: HTMLAudioElement | null = null;

/** Tiny silent WAV (44 bytes) data URI — prime 用の無音ソース。 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

/** 永続 primed 要素を取得（無ければ生成）。 */
function getPrimedAudio(): HTMLAudioElement {
  if (!primedAudio) primedAudio = new Audio();
  return primedAudio;
}

/**
 * Pre-unlock HTMLAudioElement by playing silence during a user gesture.
 * 永続要素を使い、解除に成功するまで毎ジェスチャ試行する（reject 時は再試行余地を残す）。
 */
function unlockHtmlAudio(): void {
  if (htmlAudioUnlocked) return;
  try {
    const audio = getPrimedAudio();
    audio.src = SILENT_WAV;
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        htmlAudioUnlocked = true;
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => { /* ignore — gesture may be insufficient on this platform */ });
    }
  } catch {
    // ignore
  }
}

/** Return the file extension for a given alarm sound in public/sounds/
 * All alarm sounds are now MP3 (windchime/canon/boxing/cuckoo converted from WAV masters,
 * classic/gentle/soft are original MP3 long-form masters).
 */
function soundExt(sound: AlarmSound): string {
  void sound; // all sounds are MP3
  return 'mp3';
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
 * MP3 file → AudioBuffer のキャッシュ
 * classic/gentle/soft は public/sounds/*.mp3 から fetch して decodeAudioData する。
 * decodeAudioData は MP3 に対応（全モダンブラウザ / iOS Safari / Android WebView）。
 */
const mp3BufferCache: Partial<Record<AlarmSound, AudioBuffer | null>> = {};

async function fetchAndDecodeMp3(ctx: AudioContext, sound: AlarmSound): Promise<AudioBuffer | null> {
  try {
    const basePath = import.meta.env.BASE_URL || '/';
    const url = `${basePath}sounds/${sound}.mp3`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arrayBuf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  }
}

/**
 * MP3アラーム音を再生し、再生時間(秒)を返す
 */
async function playMp3Alarm(
  ctx: AudioContext,
  dest: AudioNode,
  sound: AlarmSound,
  startTime: number,
): Promise<number> {
  let buffer = mp3BufferCache[sound];
  if (buffer === undefined) {
    buffer = await fetchAndDecodeMp3(ctx, sound);
    mp3BufferCache[sound] = buffer;
  }
  if (!buffer) return 0;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(dest);
  source.start(startTime);
  return buffer.duration;
}

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


/* ------------------------------------------------------------------ */
/*  プレビュー停止機構 (Bug2 fix)                                       */
/*  previewAlarm 呼び出し時に前の再生を停止するためのグローバル参照。    */
/* ------------------------------------------------------------------ */

/** 現在プレビュー再生中の HTMLAudioElement (null = なし) */
let previewHtmlAudio: HTMLAudioElement | null = null;

/** 現在プレビュー再生中の Web Audio GainNode (null = なし)。gain を 0 にして無音化する。 */
let previewGainNode: GainNode | null = null;

/** 前のプレビュー再生を停止する */
export function stopPreview(): void {
  if (previewHtmlAudio) {
    previewHtmlAudio.pause();
    previewHtmlAudio.currentTime = 0;
    previewHtmlAudio = null;
  }
  if (previewGainNode) {
    try {
      previewGainNode.gain.setValueAtTime(0, previewGainNode.context.currentTime);
    } catch { /* ignore */ }
    previewGainNode = null;
  }
  notifyPreviewPlaying(false);
}

/* ------------------------------------------------------------------ */
/*  終了アラーム停止機構 (fix3 Issue-C)                                 */
/*  タイマー終了時の前面 in-app 音を追跡・停止するためのグローバル参照。  */
/*  fix6 変更D: document リスナーを撤去し React オーバーレイに一本化。   */
/* ------------------------------------------------------------------ */

/** 現在終了アラーム再生中の HTMLAudioElement (null = なし) */
let alarmHtmlAudio: HTMLAudioElement | null = null;

/** 現在終了アラーム再生中の Web Audio GainNode (null = なし) */
let alarmGainNode: GainNode | null = null;

/** document の pointerdown / touchstart リスナー (stop-on-touch 用) */
let touchStopListener: ((_e: Event) => void) | null = null;

/** dismiss タップの click イベントを1回だけ握り潰す click リスナー (alarm 用) */
let clickSwallowListener: ((e: MouseEvent) => void) | null = null;

/* ------------------------------------------------------------------ */
/*  fix6 変更D: 鳴動中フラグ通知コールバック                            */
/*  in-app 音の開始/停止を React に伝え、React オーバーレイを条件マウント */
/* ------------------------------------------------------------------ */

/** アラーム鳴動状態が変化したときに呼ばれるコールバック */
let alarmRingingCallback: ((ringing: boolean) => void) | null = null;
/** プレビュー再生状態が変化したときに呼ばれるコールバック */
let previewPlayingCallback: ((playing: boolean) => void) | null = null;

/** React から呼ぶ: アラーム鳴動状態変化を受け取るコールバックを登録する */
export function setAlarmRingingCallback(fn: ((ringing: boolean) => void) | null): void {
  alarmRingingCallback = fn;
}

/** React から呼ぶ: プレビュー再生状態変化を受け取るコールバックを登録する */
export function setPreviewPlayingCallback(fn: ((playing: boolean) => void) | null): void {
  previewPlayingCallback = fn;
}

export function notifyAlarmRinging(ringing: boolean): void {
  alarmRingingCallback?.(ringing);
}

function notifyPreviewPlaying(playing: boolean): void {
  previewPlayingCallback?.(playing);
}

/**
 * 終了アラームの再生を停止する。
 * fix6 変更D: document リスナー撤去済、React オーバーレイへコールバック通知。
 */
export function stopAlarm(): void {
  if (alarmHtmlAudio) {
    alarmHtmlAudio.pause();
    alarmHtmlAudio.currentTime = 0;
    alarmHtmlAudio = null;
  }
  if (alarmGainNode) {
    try {
      alarmGainNode.gain.setValueAtTime(0, alarmGainNode.context.currentTime);
    } catch { /* ignore */ }
    alarmGainNode = null;
  }
  notifyAlarmRinging(false);
  deactivateTouchStopListener();
}

/**
 * 音が再生中に document への任意タップで停止する リスナーを有効化する (fix3 Issue-C)。
 * リスナーは一度発火するか deactivateTouchStopListener() で解除される。
 *
 * fix5(ii): Capacitor WebView では pointerdown が document capture に届かない場合がある。
 * touchstart も併用し、{ once: true } をやめて手動 removeEventListener に変更。
 * これにより任意タップで確実に stop が発火する。
 *
 * @param suppressClick
 *   true  = タイマー終了アラームの dismiss 用。最初のタップはアラームを止めるだけで
 *            タップ先のボタン動作・ナビゲーションも発火させない（click も1回握り潰す）。
 *           2回目以降のタップは通常どおり。
 *   false = プレビュー停止用（デフォルト）。タップで音は止まるが、タップ先の動作は通過させる。
 *           設定画面で別の音をタップして切り替える操作を阻害しないために通過させる。
 */
export function activateTouchStopListener(suppressClick = false): void {
  // 既にリスナーが登録済みの場合は二重登録しない
  if (touchStopListener) return;

  touchStopListener = () => {
    // fix5(ii): touchstart は pointerdown と両方来る場合があるため、
    // 一方が発火した時点で両方を除去してから処理する（二重発火防止）。
    deactivateTouchStopListener();

    // アラームと（もし残っていれば）プレビューを停止する
    stopAlarm();
    stopPreview();

    if (suppressClick) {
      // pointerdown の直後に来る click イベントを1回だけ握り潰す。
      // pointerdown と click は別イベントなので pointerdown で stopPropagation/preventDefault
      // しても click は独立して発火する。ここで click capture リスナーを1回限りで仕込む。
      // touchstart の場合も click が続く（touch → click の合成）ので同じ処理。
      if (!clickSwallowListener) {
        clickSwallowListener = (ce: MouseEvent) => {
          ce.stopPropagation();
          ce.stopImmediatePropagation();
          ce.preventDefault();
          clickSwallowListener = null;
        };
        // setTimeout 0 で次 tick に登録することで、同一フレームの click に確実に間に合わせる。
        // capture: true, once: true で1回だけ発火して自動解除される。
        setTimeout(() => {
          if (clickSwallowListener) {
            document.addEventListener('click', clickSwallowListener, { capture: true, once: true });
          }
        }, 0);
      }
    }
    // touchstart の場合、デフォルト動作（スクロールなど）は防がない。
    // suppressClick=true でも preventDefault は click のみに適用する設計を維持。
  };

  // fix5(ii): pointerdown と touchstart の両方に attach する（{ once: true } は使わない）。
  // Capacitor WebView で pointerdown が document capture に届かない場合、
  // touchstart が確実にフォールバックとして機能する。
  // deactivateTouchStopListener() で両方まとめて除去する。
  document.addEventListener('pointerdown', touchStopListener, { capture: true });
  document.addEventListener('touchstart', touchStopListener, { capture: true });
}

/**
 * stop-on-touch リスナーを解除する (クリーンアップ用)。
 * click swallow リスナーもあれば合わせて解除する。
 */
export function deactivateTouchStopListener(): void {
  if (touchStopListener) {
    document.removeEventListener('pointerdown', touchStopListener, { capture: true });
    document.removeEventListener('touchstart', touchStopListener, { capture: true });
    touchStopListener = null;
  }
  if (clickSwallowListener) {
    document.removeEventListener('click', clickSwallowListener, { capture: true });
    clickSwallowListener = null;
  }
}

/**
 * 終了アラームを永続 primed 要素で再生する（AudioContext が suspended / 復帰不能なときの確実な経路）。
 * new Audio() でなく START 時に解除済みの「同一要素」を使い回すため、iOS 前面でもジェスチャ無しで鳴る。
 * repeat はここでは無視する（②′ 仕様＝長尺音 1 回再生。旧 fresh-Audio fallback も同挙動）。
 *
 * 注: ここでの `audio` は `primedAudio` と同一オブジェクト。`alarmHtmlAudio` はその「鳴動中マーカー」で、
 * stopAlarm() / 自然終了(onended) で null に戻すが `primedAudio` 自体は次回再利用のため保持する。
 * 前提として START ジェスチャで unlock 済みだが、unlock が未完了(=play 拒否)なら htmlAudioUnlocked を
 * 倒して次ジェスチャでの再 unlock を促す（自己修復）。
 */
function playAlarmViaPrimedAudio(sound: AlarmSound, volume: number): void {
  try {
    const basePath = import.meta.env.BASE_URL || '/';
    const audio = getPrimedAudio();
    audio.src = `${basePath}sounds/${sound}.${soundExt(sound)}`;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    audio.currentTime = 0;
    alarmHtmlAudio = audio;
    // 自然終了時に鳴動中マーカーを解除する（primed 要素は保持）。
    audio.onended = () => { if (alarmHtmlAudio === audio) alarmHtmlAudio = null; };
    // fix6 変更D: document リスナーの代わりに React オーバーレイへ通知
    notifyAlarmRinging(true);
    audio.play().catch(() => {
      // 再生拒否（unlock 未完了の可能性）→ 次ジェスチャで再 unlock を試みる
      htmlAudioUnlocked = false;
    });
  } catch {
    // ignore
  }
}

/**
 * 終了アラーム専用の playViaMediaChannel — 再生を追跡して停止可能にする。
 * fix6 変更D: document リスナー (activateTouchStopListener) を撤去し、
 * notifyAlarmRinging(true) で React オーバーレイ側に通知する。
 * Web の A 修正: AudioContext が running なら Web Audio（音量連動）、suspended / 復帰不能なら
 * 永続 primed 要素にフォールバックして前面でも確実に鳴らす。
 */
function playViaMediaChannelForAlarm(sound: AlarmSound, repeat: number, volume: number): void {
  const ctx = getSharedContext();

  if (ctx) {
    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      if (ctx.state === 'running') {
        const master = createMasterGain(ctx, volume);
        alarmGainNode = master;
        // fix6 変更D: document リスナーの代わりに React オーバーレイへ通知
        notifyAlarmRinging(true);
        // All sounds are now MP3
        void (async () => {
          const gap = 0.4;
          let cursor = ctx.currentTime;
          for (let i = 0; i < repeat; i++) {
            const d = await playMp3Alarm(ctx, master, sound, cursor);
            cursor += d + gap;
          }
        })();
      } else {
        // AudioContext suspended / 復帰不能 → 永続 primed 要素で確実に鳴らす
        playAlarmViaPrimedAudio(sound, volume);
      }
    }).catch(() => {
      // resume() が reject → 永続 primed 要素で確実に鳴らす
      playAlarmViaPrimedAudio(sound, volume);
    });
  } else {
    // AudioContext を生成できない環境 → 永続 primed 要素で鳴らす
    playAlarmViaPrimedAudio(sound, volume);
  }
}

/**
 * 前面 in-app 終了アラームを再生する (fix3 Issue-A)。
 * native/web 問わずアプリが前面可視のときに呼ぶ。
 * stop-on-touch リスナーも自動で有効化される。
 */
export function playAlarmForForeground(
  sound: AlarmSound,
  repeat: number,
  volume: number = 80,
  vibrationMode: VibrationMode = 'off',
): void {
  // Android は OS 通知1経路のため in-app 前面音を鳴らさない（① judgment「Android=OS通知1経路」の構造強制）
  if (isNative()) return;
  if (sound === 'none' || volume === 0) return;

  // バイブレーション
  const shouldVibrate = vibrationMode === 'always';
  if (shouldVibrate) {
    if (isNative()) {
      void (async () => {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch { /* ignore */ }
      })();
    } else {
      vibrate(repeat);
    }
  }

  playViaMediaChannelForAlarm(sound, repeat, volume);
}

/**
 * プレビュー専用の playViaMediaChannel — 再生を追跡して停止可能にする。
 * fix6 変更D: document リスナー (activateTouchStopListener) を撤去し、
 * notifyPreviewPlaying(true) で React オーバーレイ側に通知する。
 */
function playViaMediaChannelForPreview(sound: AlarmSound, repeat: number, volume: number): void {
  const ctx = getSharedContext();

  if (ctx) {
    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      if (ctx.state === 'running') {
        const master = createMasterGain(ctx, volume);
        previewGainNode = master;  // 参照を保持して停止可能にする
        // fix6 変更D: document リスナーの代わりに React オーバーレイへ通知
        notifyPreviewPlaying(true);
        // All sounds are now MP3
        void (async () => {
          const gap = 0.4;
          let cursor = ctx.currentTime;
          for (let i = 0; i < repeat; i++) {
            const d = await playMp3Alarm(ctx, master, sound, cursor);
            cursor += d + gap;
          }
        })();
      } else {
        void (async () => {
          const basePath = import.meta.env.BASE_URL || '/';
          const src = `${basePath}sounds/${sound}.${soundExt(sound)}`;
          const audio = new Audio(src);
          audio.volume = Math.max(0, Math.min(1, volume / 100));
          previewHtmlAudio = audio;  // 参照を保持して停止可能にする
          // fix6 変更D: document リスナーの代わりに React オーバーレイへ通知
          notifyPreviewPlaying(true);
          audio.play().catch(() => { /* ignore */ });
        })();
      }
    }).catch(() => {
      void (async () => {
        const basePath = import.meta.env.BASE_URL || '/';
        const src = `${basePath}sounds/${sound}.${soundExt(sound)}`;
        const audio = new Audio(src);
        audio.volume = Math.max(0, Math.min(1, volume / 100));
        previewHtmlAudio = audio;
        // fix6 変更D: document リスナーの代わりに React オーバーレイへ通知
        notifyPreviewPlaying(true);
        audio.play().catch(() => { /* ignore */ });
      })();
    });
  } else {
    void (async () => {
      const basePath = import.meta.env.BASE_URL || '/';
      const src = `${basePath}sounds/${sound}.${soundExt(sound)}`;
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, volume / 100));
      previewHtmlAudio = audio;
      // fix6 変更D: document リスナーの代わりに React オーバーレイへ通知
      notifyPreviewPlaying(true);
      audio.play().catch(() => { /* ignore */ });
    })();
  }
}

/** プレビュー: 指定の繰り返し回数で再生。前の再生が続いていれば停止してから開始する。 */
export function previewAlarm(
  sound: AlarmSound,
  repeat: number,
  volume: number = 80,
): void {
  // Bug2 fix: 前のプレビュー再生を必ず止めてから新しい音を鳴らす
  stopPreview();
  // fix3 Issue-C: 終了アラームが再生中であれば停止してからプレビューを開始する
  stopAlarm();

  if (sound === 'none' || volume === 0) return;

  playViaMediaChannelForPreview(sound, repeat, volume);
}
