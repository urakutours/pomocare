import { Square, Check } from 'lucide-react';
import { formatTime } from '@/utils/time';

interface FocusModeProps {
  timeLeft: number;
  onStop: () => void;
  onComplete: () => void;
}

export function FocusMode({ timeLeft, onStop, onComplete }: FocusModeProps) {
  return (
    <div className="h-full bg-gray-50 dark:bg-neutral-800 flex flex-col items-center justify-center gap-10">
      {/* Logo text */}
      <div className="text-2xl font-medium text-tiffany tracking-wide">
        PomoCare
      </div>

      {/* Timer display */}
      <div className="text-7xl font-extralight text-gray-700 dark:text-gray-300 tracking-tight tabular-nums">
        {formatTime(timeLeft)}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-4">
        {/* Stop button */}
        <button
          onClick={onStop}
          className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors"
        >
          <Square size={18} />
        </button>

        {/* Complete button */}
        <button
          onClick={onComplete}
          className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
        >
          <Check size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
