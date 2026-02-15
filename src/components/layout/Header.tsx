import { BarChart3, Settings } from 'lucide-react';
import logoSvg from '/icons/logo.svg';
import logoDarkSvg from '/icons/logo_dark.svg';

interface HeaderProps {
  onLogoClick: () => void;
  onStatsClick: () => void;
  onSettingsClick: () => void;
}

export function Header({ onLogoClick, onStatsClick, onSettingsClick }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-8 titlebar-drag">
      <button onClick={onLogoClick} className="hover:opacity-70 transition-opacity titlebar-no-drag">
        <img src={logoSvg} alt="PomoCare" className="h-6 dark:hidden" />
        <img src={logoDarkSvg} alt="PomoCare" className="h-6 hidden dark:block" />
      </button>
      <div className="flex gap-2">
        <button
          onClick={onStatsClick}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors titlebar-no-drag"
        >
          <BarChart3 size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors titlebar-no-drag"
        >
          <Settings size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
}
