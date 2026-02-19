import { Play, Square, RotateCcw } from 'lucide-react';
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

      {/* Mode label – 2× size, weight 400 */}
      <div className="text-2xl text-tiffany font-normal mt-4 mb-10">{label}</div>

      {/* Buttons */}
      <div className="flex items-center gap-4 mb-12">
        {isRunning ? (
          /* Running → gray stop button (matching FocusMode) */
          <button
            onClick={onToggle}
            className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors"
          >
            <Square size={18} />
          </button>
        ) : (
          /* Stopped / Paused → Start + Skip Break (matching normal TimerControls) */
          <>
            <button
              onClick={onToggle}
              className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
            >
              <Play size={24} className="ml-1" />
            </button>
            <button
              onClick={onReset}
              title="Skip break"
              className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
            >
              <RotateCcw size={24} />
            </button>
          </>
        )}
      </div>

      {/* Custom message */}
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center px-6">
        {displayMessage}
      </p>
    </div>
  );
}
