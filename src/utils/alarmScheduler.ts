/**
 * AlarmScheduler — T2d 新設 (2026-06-05)
 *
 * 「未来時刻 T にアラームを予約/取消する」責務だけを閉じ込める薄い1インタフェース。
 * ②′ 仕様: Android = LocalNotifications exact-alarm / Web・iOS = フォアグラウンド限定 no-op スタブ
 * (Web 本実装は T2e で行う)
 *
 * channel バージョニング: Android の通知 channel sound は immutable (一度作成したら変更不可)。
 * 旧 channel (pomocare-bell 等) が端末に残っていても新 MP3 が鳴るよう、
 * channelId に "-v2" サフィックスを付与し、新しい channel セットを作成する。
 * さらに ensureNotificationChannelsV2() で旧 v1 channel を deleteChannel してから v2 を作成し直す。
 */

import type { AlarmSound } from '@/types/settings';
import { isNative } from '@/utils/platform';
import { LocalNotifications } from '@capacitor/local-notifications';

/* ------------------------------------------------------------------ */
/*  channel ID バージョニング (§6 / §10 最重要リスク対処)              */
/* ------------------------------------------------------------------ */

/**
 * v3 channel id 一覧 — synth4 (bell/digital/chime/kitchen) を新4音 (windchime/canon/boxing/cuckoo) に置換。
 * v2 → v3 で channelId を変更することで旧端末の immutable channel を回避。
 * classic/gentle/soft は音変更なしだが v3 に統一するためリネーム。
 */
const NOTIFICATION_CHANNELS_V3: { id: string; sound: AlarmSound }[] = [
  { id: 'pomocare-windchime-v3', sound: 'windchime' },
  { id: 'pomocare-canon-v3',     sound: 'canon'     },
  { id: 'pomocare-boxing-v3',    sound: 'boxing'    },
  { id: 'pomocare-cuckoo-v3',    sound: 'cuckoo'    },
  { id: 'pomocare-classic-v3',   sound: 'classic'   },
  { id: 'pomocare-gentle-v3',    sound: 'gentle'    },
  { id: 'pomocare-soft-v3',      sound: 'soft'      },
  { id: 'pomocare-silent-v3',    sound: 'none'      },
];

/** v1 + v2 channel id リスト (削除対象) — v1 synth4 / v2 synth4 channels を掃除 */
const LEGACY_CHANNEL_IDS: string[] = [
  // v1
  'pomocare-bell',
  'pomocare-digital',
  'pomocare-chime',
  'pomocare-kitchen',
  'pomocare-classic',
  'pomocare-gentle',
  'pomocare-soft',
  'pomocare-silent',
  // v2 synth4 (replaced by new sounds)
  'pomocare-bell-v2',
  'pomocare-digital-v2',
  'pomocare-chime-v2',
  'pomocare-kitchen-v2',
  // v2 long-form (kept sounds but moved to v3 channelId)
  'pomocare-classic-v2',
  'pomocare-gentle-v2',
  'pomocare-soft-v2',
  'pomocare-silent-v2',
];

/** AlarmSound に対応する v3 channelId を返す */
export function channelIdForV2(sound: AlarmSound): string {
  return NOTIFICATION_CHANNELS_V3.find((c) => c.sound === sound)?.id ?? 'pomocare-classic-v3';
}

/** sound ファイルの拡張子 — 全ての alarm 音は MP3 */
function soundExtV3(sound: AlarmSound): string {
  void sound; // all sounds are MP3
  return 'mp3';
}

/** Android raw resource name */
function nativeSoundResourceV3(sound: AlarmSound): string | undefined {
  if (sound === 'none') return undefined;
  return `${sound}.${soundExtV3(sound)}`;
}

/**
 * v3 通知 channel を確保する。
 * - 旧 v1/v2 channel を deleteChannel で削除してから v3 を作成することで
 *   旧端末でも新 MP3 が鳴るようにする (channel immutable 対処)。
 * - v2 synth4 channels (bell/digital/chime/kitchen) も削除して新4音に置換する。
 * - idempotent: 何度呼んでも安全。
 */
export async function ensureNotificationChannelsV2(): Promise<void> {
  if (!isNative()) return;

  // Step 1: 旧 v1/v2 channel を削除 (already deleted でもエラーにならない)
  for (const id of LEGACY_CHANNEL_IDS) {
    try {
      await LocalNotifications.deleteChannel({ id });
    } catch {
      // ignore — channel may not exist yet
    }
  }

  // Step 2: v3 channel を作成
  for (const ch of NOTIFICATION_CHANNELS_V3) {
    try {
      await LocalNotifications.createChannel({
        id: ch.id,
        name: ch.sound === 'none' ? 'PomoCare (Silent)' : `PomoCare ${ch.sound} v3`,
        description: 'PomoCare timer alerts',
        importance: 5,
        sound: ch.sound === 'none' ? undefined : nativeSoundResourceV3(ch.sound),
        vibration: true,
        visibility: 1,
      });
    } catch {
      // ignore — platform may not support createChannel
    }
  }
}

/* ------------------------------------------------------------------ */
/*  AlarmScheduler インタフェース                                       */
/* ------------------------------------------------------------------ */

export interface AlarmScheduler {
  /** 指定 unix ms 時刻にアラームを予約する (冪等: 前の予約は自動 cancel) */
  schedule(fireAtMs: number, sound: AlarmSound): Promise<void>;
  /** 予約中のアラームを取消す */
  cancel(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  NativeAlarmScheduler (Android exact-alarm)                        */
/* ------------------------------------------------------------------ */

/**
 * fix9 (B): アラーム通知の ID をアプリ全体で固定の定数1本にする。
 * 単一タイマー設計なので固定 ID で OK (再 schedule 時に OS が replace する)。
 * autoCancel: true と組み合わせることで通知トレイへの累積を防ぐ。
 */
const ALARM_NOTIFICATION_ID = 999999;

export class NativeAlarmScheduler implements AlarmScheduler {
  private pendingId: number = -1;

  async schedule(fireAtMs: number, sound: AlarmSound): Promise<void> {
    // 前の予約を先にキャンセル (冪等保証)
    await this.cancel();

    const isSilent = sound === 'none';
    // fix9 (B-1): 固定 ID を使用（毎回新規 ID だと通知が replace されず累積する）
    const id = ALARM_NOTIFICATION_ID;
    const nowMs = Date.now();

    // B-log: 予約の開始を記録 (logcat: adb logcat | grep -i "AlarmScheduler")
    const fireDate = new Date(fireAtMs).toISOString();
    const nowDate = new Date(nowMs).toISOString();
    if (import.meta.env.DEV) {
      console.warn(`[AlarmScheduler] scheduling id=${id} sound=${sound} fireAt_epoch=${fireAtMs} fireAt_iso=${fireDate} now_epoch=${nowMs} now_iso=${nowDate} delayMs=${fireAtMs - nowMs}`);
    }

    // Stage 1: exact alarm with allowWhileIdle (requires SCHEDULE_EXACT_ALARM on Android 12+)
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: 'Timer Complete',
            body: 'PomoCare',
            sound: isSilent ? undefined : nativeSoundResourceV3(sound),
            channelId: channelIdForV2(sound),
            schedule: { at: new Date(fireAtMs), allowWhileIdle: true },
            // fix9 (B-2): タップで通知を自動 dismiss（通知トレイに残らない）
            autoCancel: true,
          },
        ],
      });
      this.pendingId = id;
      // B-log: Stage1 (exact + allowWhileIdle) 成功
      if (import.meta.env.DEV) {
        console.warn(`[AlarmScheduler] scheduled stage=1(exact+allowWhileIdle) id=${id} fireAt_epoch=${fireAtMs} now_epoch=${nowMs}`);
      }
      return;
    } catch (err) {
      console.warn('[AlarmScheduler] Stage1 exact schedule failed, retrying without allowWhileIdle:', err);
    }

    // Stage 2: non-exact fallback (no allowWhileIdle) when SCHEDULE_EXACT_ALARM is denied
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: 'Timer Complete',
            body: 'PomoCare',
            sound: isSilent ? undefined : nativeSoundResourceV3(sound),
            channelId: channelIdForV2(sound),
            schedule: { at: new Date(fireAtMs) },
            // fix9 (B-2): タップで通知を自動 dismiss
            autoCancel: true,
          },
        ],
      });
      this.pendingId = id;
      // B-log: Stage2 (inexact, no allowWhileIdle) 成功 — これが遅延の原因候補
      if (import.meta.env.DEV) {
        console.warn(`[AlarmScheduler] scheduled stage=2(inexact-fallback) id=${id} fireAt_epoch=${fireAtMs} now_epoch=${nowMs}`);
      }
    } catch (err) {
      console.warn('[AlarmScheduler] Stage2 schedule also failed:', err);
      this.pendingId = -1;
    }
  }

  async cancel(): Promise<void> {
    if (this.pendingId < 0) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: this.pendingId }] });
    } catch {
      // ignore
    } finally {
      this.pendingId = -1;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  WebAlarmScheduler — T2e 実装                                       */
/*  Web / iOS: フォアグラウンド時のみ setTimeout + in-app 音再生。      */
/*  OS 予約なし（Web では技術的に不可、②′ 仕様 §2 振る舞い表）。       */
/* ------------------------------------------------------------------ */

/**
 * AlarmScheduler インタフェースを Web 用に拡張した schedule 引数型。
 * volume / vibration を schedule 呼び出し時点でバインドすることで
 * 循環参照を避けつつ、fire 時に正しい設定を使えるようにする。
 */
export interface WebAlarmScheduleParams {
  volume: number;
  repeat: number;
  vibration: import('@/types/settings').VibrationMode;
}

export class WebAlarmScheduler implements AlarmScheduler {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** schedule() 時点でバインドした再生パラメータ */
  private params: WebAlarmScheduleParams = { volume: 80, repeat: 1, vibration: 'off' };

  async schedule(fireAtMs: number, sound: AlarmSound): Promise<void> {
    await this.cancel();
    const delayMs = Math.max(0, fireAtMs - Date.now());
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this._fire(sound);
    }, delayMs);
  }

  /**
   * useTimer から呼ぶ拡張メソッド: Web 用の追加パラメータを渡す。
   * `schedule()` の前後を問わず設定可能。次回 fire 時に参照される。
   */
  setParams(p: WebAlarmScheduleParams): void {
    this.params = p;
  }

  async cancel(): Promise<void> {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private _fire(sound: AlarmSound): void {
    // 動的 import で循環参照を回避しつつ alarm.ts の in-app 音経路を呼ぶ
    import('@/utils/alarm').then((mod) => {
      mod.playAlarmForForeground(sound, this.params.repeat, this.params.volume, this.params.vibration);
    });
  }
}

/* ------------------------------------------------------------------ */
/*  モジュールシングルトン                                              */
/* ------------------------------------------------------------------ */

/**
 * アプリ全体で共有する AlarmScheduler インスタンス。
 * native → NativeAlarmScheduler / それ以外 → WebAlarmScheduler (T2d は no-op)
 */
export const alarmScheduler: AlarmScheduler = isNative()
  ? new NativeAlarmScheduler()
  : new WebAlarmScheduler();
