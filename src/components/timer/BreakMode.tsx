import { Play, Pause, RotateCcw } from 'lucide-react';
import { formatTime } from '@/utils/time';
import type { TimerMode } from '@/types/timer';
import { useI18n } from '@/contexts/I18nContext';

interface BreakModeProps {
  timeLeft: number;
  mode: TimerMode;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
  displayMessage: string;
}

export function BreakMode({ timeLeft, mode, isRunning, onToggle, onReset, displayMessage }: BreakModeProps) {
  const { t } = useI18n();
  const label = mode === 'longBreak' ? t.longBreakMode : t.restMode;

  return (
    <div className="flex flex-col items-center justify-center flex-1">
      {/* Timer display */}
      <div className="text-7xl font-light text-gray-800 dark:text-gray-200 tracking-tight tabular-nums">
        {formatTime(timeLeft)}
      </div>

      {/* Mode label */}
      <div className="text-base text-tiffany font-medium mt-2 mb-8">{label}</div>

      {/* Play / Pause + Skip (reset) */}
      <div className="flex items-center gap-4 mb-12">
        <button
          onClick={onToggle}
          className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
        >
          {isRunning
            ? <Pause size={22} fill="white" strokeWidth={0} />
            : <Play size={22} fill="white" strokeWidth={0} className="ml-0.5" />
          }
        </button>
        <button
          onClick={onReset}
          title="Skip break"
          className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Custom message */}
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center px-6">
        {displayMessage}
      </p>
    </div>
  );
}
