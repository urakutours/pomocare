import { useEffect, useRef } from 'react';
import { useFeatures } from '@/contexts/FeatureContext';
import { isNative } from '@/utils/platform';
import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
} from '@capacitor-community/admob';
import { AmazonBanner } from './AmazonBanner';

// ---- Configuration ----

// AdMob (Android native)
// Production Banner Ad Unit ID (PomoCare / App Bottom Banner):
//   ca-app-pub-5675101743750825/4761723348
// During development we keep the Google-provided TEST Ad Unit ID to avoid
// AdMob policy violations (invalid traffic) while iterating. Before release,
// swap ADMOB_BANNER_ID to the production ID above and set isTesting: false.
const ADMOB_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741'; // test ID

/** @deprecated Use flex layout instead of hardcoded height */
export const AD_BANNER_HEIGHT = 67;

interface AdBannerProps {
  /** Hide the banner during focus/break timer */
  hidden?: boolean;
}

// ---------------------------------------------------------------------------
// AdMob banner (Android native) — rendered by the native SDK as an overlay
// ---------------------------------------------------------------------------

function AdMobBanner({ hidden }: AdBannerProps) {
  const features = useFeatures();
  const shown = useRef(false);

  useEffect(() => {
    if (features.adFree || hidden) {
      if (shown.current) {
        AdMob.removeBanner().catch(() => {});
        document.documentElement.style.removeProperty('--admob-banner-height');
        shown.current = false;
      }
      return;
    }

    // Already showing
    if (shown.current) return;

    const showBanner = async () => {
      // Listen for banner size to add bottom padding so content isn't hidden
      await AdMob.addListener(
        BannerAdPluginEvents.SizeChanged,
        (info) => {
          document.documentElement.style.setProperty(
            '--admob-banner-height',
            `${info.height}px`,
          );
        },
      );

      await AdMob.showBanner({
        adId: ADMOB_BANNER_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: true, // TODO: Remove before production release
      });
      shown.current = true;
    };

    showBanner().catch(() => {});

    return () => {
      AdMob.removeBanner().catch(() => {});
      document.documentElement.style.removeProperty('--admob-banner-height');
      shown.current = false;
    };
  }, [features.adFree, hidden]);

  // Native banner is rendered by the SDK outside the WebView — no DOM needed.
  return null;
}

// ---------------------------------------------------------------------------
// Unified entry point — routes to AdMob (native) or AmazonBanner (web)
// ---------------------------------------------------------------------------
//
// Web / PWA 側は AdSense 審査に落ちたため、Amazon アソシエイトによる
// アフィリエイトバナー (AmazonBanner) を採用。将来 AdSense が承認されたら
// AmazonBanner と並行 or 置き換えで AdSenseBanner を復活させる可能性あり。
// AdSense 実装は git 履歴に残っている。

export function AdBanner({ hidden }: AdBannerProps) {
  const features = useFeatures();

  // Paid users never see ads
  if (features.adFree || hidden) {
    // Still need to ensure AdMob banner is removed on native
    if (isNative()) return <AdMobBanner hidden />;
    return null;
  }

  if (isNative()) return <AdMobBanner hidden={false} />;
  return <AmazonBanner />;
}
