import { Square } from 'lucide-react';
import { formatTime } from '@/utils/time';
import type { TimerMode } from '@/types/timer';
import { useI18n } from '@/contexts/I18nContext';

interface BreakModeProps {
  timeLeft: number;
  mode: TimerMode;
  onStop: () => void;
  displayMessage: string;
}

export function BreakMode({ timeLeft, mode, onStop, displayMessage }: BreakModeProps) {
  const { t } = useI18n();
  const label = mode === 'longBreak' ? t.longBreakMode : t.restMode;

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-10">
      {/* Timer display */}
      <div className="text-7xl font-light text-gray-800 dark:text-gray-200 tracking-tight tabular-nums">
        {formatTime(timeLeft)}
      </div>

      {/* Mode label */}
      <div className="text-base text-tiffany font-medium -mt-6">{label}</div>

      {/* Stop button — tiffany circle like the main play button */}
      <button
        onClick={onStop}
        className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
      >
        <Square size={18} fill="white" strokeWidth={0} />
      </button>

      {/* Custom message */}
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center px-6">
        {displayMessage}
      </p>
    </div>
  );
}
