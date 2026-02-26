import { useEffect, useRef } from 'react';
import { useFeatures } from '@/contexts/FeatureContext';

// ---- Configuration ----
const ADSENSE_CLIENT = 'ca-pub-5675101743750825';
// Replace with your ad slot ID after creating an ad unit in AdSense dashboard
const ADSENSE_SLOT = '0000000000';

interface AdBannerProps {
  /** Hide the banner during focus/break timer */
  hidden?: boolean;
}

export function AdBanner({ hidden }: AdBannerProps) {
  const features = useFeatures();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (features.adFree || hidden) return;
    // Push ad only once per mount
    if (pushed.current) return;
    try {
      const adsbygoogle = (window as any).adsbygoogle;
      if (adsbygoogle && adRef.current) {
        adsbygoogle.push({});
        pushed.current = true;
      }
    } catch {
      // AdSense script not loaded (e.g. ad blocker, localhost)
    }
  }, [features.adFree, hidden]);

  // Don't show for paid users or when hidden
  if (features.adFree || hidden) return null;

  return (
    <div className="flex-shrink-0 bg-gray-100 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700">
      <div className="max-w-sm mx-auto flex items-center justify-center py-2 px-4">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '50px' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="horizontal"
          data-full-width-responsive="false"
        />
      </div>
    </div>
  );
}
