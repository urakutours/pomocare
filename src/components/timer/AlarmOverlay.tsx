/**
 * AlarmOverlay — fix6 変更D
 *
 * in-app 音が鳴動中（alarm または preview）の間だけマウントされる
 * 全画面透明オーバーレイ。React 合成イベント (onPointerDown) で stopAlarm / stopPreview を呼ぶ。
 *
 * 背景:
 * - 旧実装: document.addEventListener('pointerdown'/'touchstart', ..., { capture: true })
 *   → Capacitor WebView で capture が届かない / stale closure で効かない
 * - 新実装: 高 z-index 全画面透明オーバーレイが最前面でタップを受け取る
 *   → React 合成イベント経路 = リセットボタンで動作確認済みの経路に乗せる
 *
 * preview の reconcile 方式 (Daisuke 要件=「任意タップで止まる + 別の音アイコンも選択できる」):
 * - 1st タップでオーバーレイが stopAlarm/stopPreview を呼んで unmount される
 * - 2nd タップ以降はオーバーレイが消えているので下の設定 UI (音アイコン等) が通常どおり発火する
 * - これにより「任意タップで停止 + 別の音を選択」が 2-tap で自然に実現される
 *
 * B/D 相互作用 (重要):
 * - 変更B で Android 前面アラーム音は OS 通知になる (in-app 音でない)
 * - OS 通知音は JS の stopAlarm() では止まらない (OS 管理)
 * - fix7 (a): Android 前面 OS 通知も tap-dismiss できるよう、
 *   isAlarm=true の onPointerDown で alarmScheduler.cancel() を呼ぶ。
 *   Reset が行っているのと同じ手段 (alarmScheduler.cancel()) で OS 通知を取消す。
 *   in-app 音ケース (Web 前面) では stopAlarm() も呼ぶ (両方呼んで安全)。
 * - fix7 (b): isAlarm=false (preview) では stopPreview() を呼ぶ (stopAlarm() でなく)。
 */

import { useEffect, useRef } from 'react';
import { stopAlarm, stopPreview } from '@/utils/alarm';
import { alarmScheduler } from '@/utils/alarmScheduler';
// fix9 (B-3): dismiss 時に delivered 通知をトレイからクリアする
import { LocalNotifications } from '@capacitor/local-notifications';

interface AlarmOverlayProps {
  /** true = アラーム停止オーバーレイ (alarm 用), false = プレビュー停止オーバーレイ (preview 用) */
  isAlarm: boolean;
  /** タップで停止後に呼ぶコールバック */
  onDismiss: () => void;
}

/**
 * in-app 音鳴動中だけマウントする全画面透明オーバーレイ。
 * onPointerDown で stopAlarm() + onDismiss() を呼んでアンマウントを促す。
 */
export function AlarmOverlay({ isAlarm, onDismiss }: AlarmOverlayProps) {
  const dismissedRef = useRef(false);

  // クリーンアップ時にも stop を呼ぶ (コンポーネントが強制アンマウントされた場合)
  useEffect(() => {
    return () => {
      if (!dismissedRef.current) {
        if (isAlarm) {
          // fix7 (a): OS 通知キャンセル (Reset と同じ手段) + in-app 音も停止 (Web/Android 両対応)
          void alarmScheduler.cancel();
          stopAlarm();
          // fix9 (B-3): delivered 通知をトレイから削除
          void LocalNotifications.removeAllDeliveredNotifications().catch(() => { /* ignore */ });
        } else {
          // fix7 (b): preview は stopPreview
          stopPreview();
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerDown = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (isAlarm) {
      // fix7 (a): OS 通知キャンセル (Reset と同じ手段) + in-app 音も停止 (Web/Android 両対応)
      // alarmScheduler.cancel() → Android OS 通知音を止める (Reset が行う手段と同じ)
      // stopAlarm() → Web 前面の in-app 音を止める (Android では no-op)
      void alarmScheduler.cancel();
      stopAlarm();
      // fix9 (B-3): delivered 通知をトレイから削除して通知バーをクリアする
      void LocalNotifications.removeAllDeliveredNotifications().catch(() => { /* ignore */ });
    } else {
      // fix7 (b): preview は stopPreview (stopAlarm でなく)
      stopPreview();
    }
    onDismiss();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // alarm は高 z-index で最前面 (モーダル等より上)
        // preview も同様。ただし 1 回タップで unmount される
        zIndex: isAlarm ? 9000 : 8000,
        // 完全透明 — 視覚的には何も見えない
        background: 'transparent',
        // タップイベントを受け取るためにポインターイベントを有効化
        pointerEvents: 'all',
        // touch-action: none でスクロール等のデフォルト動作を防ぐ
        // (音を止めるタップがスクロールを誘発しないように)
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      // PointerEvent が来ない環境 (一部 Android WebView) のフォールバック
      onTouchStart={(e) => {
        // pointerdown と touchstart が両方来る場合は pointerdown 側で処理済みになる
        // dismissedRef で二重発火を防ぐ
        e.preventDefault();
        handlePointerDown();
      }}
    />
  );
}
