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
    <div className="flex flex-col items-center justify-center flex-1 gap-8">
      {/* Mode label */}
      <div className="text-sm text-tiffany font-medium tracking-wide">{label}</div>

      {/* Timer display */}
      <div className="text-7xl font-extralight text-gray-700 dark:text-gray-300 tracking-tight tabular-nums">
        {formatTime(timeLeft)}
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-gray-400 dark:text-gray-400 flex items-center justify-center transition-colors"
      >
        <Square size={16} />
      </button>

      {/* Custom message */}
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center px-4">
        {displayMessage}
      </p>
    </div>
  );
}
