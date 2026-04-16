import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pomocare.app',
  appName: 'PomoCare',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // WebView を app.pomocare.com 名義にする。ローカル dist アセットを配信しつつ、
    // リクエスト Origin が本番ドメインと一致するため、Neon Auth の redirectTo 検証が通る
    hostname: 'app.pomocare.com',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#0abab5',
      sound: 'bell.wav',
    },
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
