# pomocare 音・通知 ②′リファクタ 実装プラン

> 出典: 親セッション (pomocare-sound-notification-refresh-2026-06 sprint) で plan-architect が作成 (2026-06-05)。
> 確定方針: web版① judgment #2 (②′)。`.claude/judgment-detail/pomocare-sound-notification-refresh-2026-06/2.md`。
> 実機検証 (A)(B) PASS 済 (S22/One UI 8.0): exact-alarm 画面オフ発火 + 30.8秒長尺音フル再生。
> 音源は MP3 軽量化済 (classic/gentle/soft full-length、-94%、Base64削除)。**未コミット**。

## 方針サマリ
Android = exact-alarm 予約通知で画面オフ確実発火 / Web・iOS = フォアグラウンド音1本。`channel` 二軸・silent 多段 fallback・即時/予約二系統を `AlarmScheduler`(schedule/cancel) 薄1IF + Native/Web 2実装へ統合。新経路が通った後に旧経路を**1 atomic commit で一掃**。

## 1. AlarmScheduler インタフェース
新ファイル `src/utils/alarmScheduler.ts`。「未来時刻Tにアラームを予約/取消」だけを閉じ込める。
```ts
export interface AlarmScheduler {
  schedule(fireAtMs: number, sound: AlarmSound): Promise<void>; // 冪等
  cancel(): Promise<void>;
}
export const alarmScheduler = isNative() ? new NativeAlarmScheduler() : new WebAlarmScheduler();
```
- **Native**: `LocalNotifications.schedule({schedule:{at, allowWhileIdle:true}, channelId: channelIdFor(sound)})` 1段のみ (Stage2非exact fallback削除)。cancel 用に id 保持。アプリ内 HTMLAudio 不使用 (OS通知音が長尺MP3をフル再生、(B)実証)。
- **Web**: OS予約不可。内部 setTimeout + フォアグラウンド時のみ再生 (現 playViaMediaChannel の WebAudio/MP3 を1本化)。iOS用 HTMLAudio fallback 1段だけ残す。playViaNotificationChannel fallback は削除 (鳴ったフリ廃止)。
- **useTimer**: timer start で `alarmScheduler.schedule(Date.now()+timeLeft*1000, sound)` を常時呼ぶ (channel分岐撤廃)。pause/reset/complete で cancel。

## 2. 振る舞い表 (②′仕様の正本)
| 状態 | Android (native) | Web/PWA | iOS |
|---|---|---|---|
| アプリ前面(画面オン) | 終了時アラーム (未決#1) | in-app音 (volume連動) | in-app音 (HTMLAudio fallback) |
| バックグラウンド | **OS予約通知で発火 ✅** | 鳴らない(仕様) | 鳴らない(仕様) |
| 画面オフ/kill | **OS予約通知で定刻発火 ✅** (~5秒ラグ許容) | 鳴らない(仕様) | 鳴らない(仕様) |
| 復帰時 | wall-clock再計算で状態同期 (音は予約通知が発火済) | 跨いだ終了は鳴らさず状態のみ fast-forward | 同左 |

## 3. 既定変更 + 後方互換
- `DEFAULT_SETTINGS.alarm.channel = 'media'` を削除。channel廃止で Android は常に native予約通知 = 既定で画面オフ発火。
- localStorage/Neon に旧 `channel`/`repeat` が残っても新コードが読まないので無害。**能動マイグレーション不要** (JSONB、スキーマ変更なし)。

## 4. repeat deprecate
- `AlarmSettings.repeat` を `@deprecated`、AlarmScheduler は repeat 不使用 (長尺音1回再生)。旧 `repeat:N` 保存値は無視 (1:1置換)。完全削除は次sprint。UI repeat ボタンの扱いは未決#2。

## 5. vibration
- 予約通知 channel の vibration に一本化 (画面オフは OS側で振動)。`'silent'` は通知方式で表現しづらい → off/always 2択化を提案 (未決#3)。

## 6. 音源
- 7本維持 (synth4 WAV + classic/gentle/soft MP3)。sound毎 channelId (immutable回避) は維持。
- **⚠️最重要技術リスク**: Android channel sound は immutable。既存ユーザー端末に短尺WAVの旧channelが残ると新MP3が鳴らない → **channelId バージョニング (例 pomocare-gentle-v2) or deleteChannel→再作成 が必須** (T2d AC)。
- 本数削減するかは未決#2。

## 7. 旧経路 atomic 一掃対象 (新経路が 2f PASS 後に1コミット)
`alarm.ts`: playAlarm の channel分岐 / playViaNotificationChannel / playViaMediaChannel多段 / playAlarmNative即時 / scheduleNativeAlarm Stage2 / sendTimerNotification / AlarmChannel参照 / previewAlarm channel引数
`types/settings.ts`: AlarmChannel型 / AlarmSettings.channel / DEFAULT_SETTINGS.channel
`useTimer.ts`: scheduleNativeAlarm/cancelNativeAlarm import / channel参照 / notification分岐
`SettingsPanel.tsx`: channel UI(L1541-1571) / channel props/state / volume/repeat の notificationロック表示
`i18n`: alarmChannel* 4キー × 7言語

## 8. 2c 仕様明文化 (projects/pomocare.md + CLAUDE.md §8)
振る舞い表 + 「Android=画面オフ確実 / Web・iOS=フォアグラウンド限定 (画面オフ通知は技術的に不可、握り潰さず仕様明示=品質の表明)」を明記。

## 9. サブタスク (着手順 T2c→T2d→T2e→T2f、agent=code-implementer)
| 順 | サブ | execution | スコープ核 | 主要AC | 依存 |
|---|---|---|---|---|---|
| 1 | T2c | 並列可 | ②′仕様を doc2本に明文化 | 振る舞い表掲載 + 前面限定仕様明記 | なし |
| 2 | T2d | sequential | AlarmScheduler IF + Native(exact-alarm) + channel再作成対処、useTimer に schedule/cancel 追加(旧経路並走) | tsc/build green + 実機(A)(B)同等再現 + 旧channel端末で新MP3発火 | T2c |
| 3 | T2e | sequential | Web実装1本 + useTimer完全切替 + 旧経路atomic一掃 + channel/repeat/vibration整理 + i18n | tsc/lint/build green + grep で旧シンボル消失 + code-reviewer Critical 0 + 後方互換 | T2d |
| 4 | T2f | sequential | Web/PWA+Android実機回帰 + 認証/ストレージ/エッジ + security監査 | 振る舞い表全セル仕様通り + 二重発火なし + 許可拒否fallback + security-reviewer Critical 0 | T2e |

> T2d→T2e は同一ファイル群 (alarm.ts/useTimer/settings/SettingsPanel) を触るため**厳密 sequential**。T2c は doc 独立で並列可。全 sonnet (Opus 0)。

## 10. リスク
- **channel再作成 (最重要)**: 上記§6。検証漏れると「更新後に音が変わらない」苦情源。
- タブ復帰二重発火: alarmFiredRef + visibilitychange ガード維持。
- 通知許可拒否 (Android13+ POST_NOTIFICATIONS): 拒否なら画面オフで鳴らない → 本sprintは仕様化(最小)、UX強化は別タスク。
- One UI バッテリー最適化 (~5秒ラグ): USE_EXACT_ALARM格上げ/setAlarmClock/最適化除外オンボは精度チューニング=未決#4 (focus timerでは許容、別タスク推奨)。
- initializeForTesting (main.tsx): 本番リリース前に削除必須 (テスト広告)。
- capacitor.config.ts LocalNotifications.sound:'bell.wav': 長尺MP3既定と整合するか T2e で確認。

## 11. 未決事項 (Daisuke 判断、boundary内=②実装範囲)
- **#1 前面終了音**: アプリ前面で0到達時、AlarmScheduler内に隠す(Native=OS通知/Web=in-app) か useTimer明示再生か。Native前面の二重発火回避に直結。
- **#2 音の本数 + repeat UI**: 7音維持か削減か / repeat ボタン残すか消すか。
- **#3 vibration**: 3択維持か 2択(off/always)簡素化か。
- **#4 Android精度チューニング**: ~5秒ラグ対策を本sprintに含めるか別タスクか (別タスク推奨)。

→ **① 再escalate 候補: 現時点なし** (全て ②′ boundary 内)。ただし #4 で精度チューニングを本sprintに含める/#2 で音源を大幅削減する場合のみ ① 確認候補。

## Definition of Done
- T2c〜T2f 全AC / grep で channel・AlarmChannel・playViaNotificationChannel・scheduleNativeAlarm・playAlarmNative が src から消滅 / tsc・lint・build green / code-reviewer・security-reviewer Critical 0 / Android実機 画面オフ発火+長尺音+channel再作成後も新MP3 / Web・iOS フォアグラウンド音+背景は明示挙動 / doc明文化 / 後方互換。
