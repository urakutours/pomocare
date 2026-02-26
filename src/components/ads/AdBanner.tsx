import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
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
  const [dismissed, setDismissed] = useState(false);
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (features.adFree || dismissed || hidden) return;
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
  }, [features.adFree, dismissed, hidden]);

  // Don't show for paid users or when dismissed
  if (features.adFree || dismissed || hidden) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-100 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700">
      <div className="relative max-w-sm mx-auto flex items-center justify-center py-2 px-4">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '50px' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="horizontal"
          data-full-width-responsive="false"
        />
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
