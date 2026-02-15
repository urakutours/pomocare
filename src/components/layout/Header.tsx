import { BarChart3, Settings } from 'lucide-react';
import logoSvg from '/icons/logo.svg';

interface HeaderProps {
  onLogoClick: () => void;
  onStatsClick: () => void;
  onSettingsClick: () => void;
}

export function Header({ onLogoClick, onStatsClick, onSettingsClick }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-8">
      <button onClick={onLogoClick} className="hover:opacity-70 transition-opacity">
        <img src={logoSvg} alt="PomoCare" className="h-6" />
      </button>
      <div className="flex gap-2">
        <button
          onClick={onStatsClick}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <BarChart3 size={20} className="text-gray-600" />
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Settings size={20} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}
