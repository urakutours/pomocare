import type { ReactNode } from 'react';
import { useFeatures } from '@/contexts/FeatureContext';

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, children }: AppShellProps) {
  const features = useFeatures();

  return (
    <div className="h-full bg-white dark:bg-neutral-800 flex flex-col">
      <div className={`w-full max-w-sm mx-auto flex-1 min-h-0 flex flex-col p-4 landscape:p-3 ${!features.adFree ? 'pb-[70px]' : ''}`}>
        <div className="flex-shrink-0">{header}</div>
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
