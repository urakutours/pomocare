import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="h-full bg-white dark:bg-neutral-800 flex flex-col">
      <div className="w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col p-4 landscape:p-3">
        <div className="flex-shrink-0">{header}</div>
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
