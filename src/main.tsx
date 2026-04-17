import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AdMob } from '@capacitor-community/admob';
import App from './App';
import './index.css';
import { ensureNotificationChannels } from '@/utils/alarm';

// Android 15+ は edge-to-edge が強制される。明示的に overlay: true とし、
// CSS の env(safe-area-inset-*) で content 側にパディングを付けて対処する。
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  StatusBar.setStyle({ style: Style.Default }).catch(() => {});
  // サウンドごとの通知チャンネルを作成（Android 8+ では sound は channel に固定）
  void ensureNotificationChannels();
  // Google AdMob SDK を初期化（テスト広告モード）
  // TODO: 本番リリース時に initializeForTesting を削除
  AdMob.initialize({ initializeForTesting: true }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
