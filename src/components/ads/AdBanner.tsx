import { useState } from 'react';
import { X } from 'lucide-react';
import { useFeatures } from '@/contexts/FeatureContext';

interface AdBannerProps {
  /** Hide the banner during focus/break timer */
  hidden?: boolean;
}

export function AdBanner({ hidden }: AdBannerProps) {
  const features = useFeatures();
  const [dismissed, setDismissed] = useState(false);

  // Don't show for paid users or when dismissed
  if (features.adFree || dismissed || hidden) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-100 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700">
      <div className="relative max-w-sm mx-auto flex items-center justify-center py-2 px-4">
        {/* Placeholder for Google AdSense — replace with <ins> tag in Phase 2 */}
        <div className="w-full h-[50px] bg-gray-200 dark:bg-neutral-700 rounded flex items-center justify-center">
          <span className="text-xs text-gray-400 dark:text-gray-500">Ad</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
