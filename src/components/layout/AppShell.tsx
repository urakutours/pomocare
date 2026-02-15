import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="h-full bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="p-8 flex flex-col" style={{ height: '520px' }}>
          <div className="flex-shrink-0">{header}</div>
          <div className="flex-1 min-h-0 flex flex-col">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
