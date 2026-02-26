import type { ReactNode } from 'react';
import { useFeatures } from '@/contexts/FeatureContext';
import { AD_BANNER_HEIGHT } from '@/components/ads/AdBanner';

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, children }: AppShellProps) {
  const features = useFeatures();

  // 広告表示時はビューポートから広告高さを引いた領域をコンテンツに使う
  const shellStyle = !features.adFree
    ? { height: `calc(100% - ${AD_BANNER_HEIGHT}px)` }
    : { height: '100%' };

  return (
    <div className="bg-white dark:bg-neutral-800 flex flex-col" style={shellStyle}>
      <div className="w-full max-w-sm mx-auto flex-1 min-h-0 flex flex-col p-4 landscape:p-3">
        <div className="flex-shrink-0">{header}</div>
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
