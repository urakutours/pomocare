import { Square } from 'lucide-react';
import { formatTime } from '@/utils/time';

interface FocusModeProps {
  timeLeft: number;
  onStop: () => void;
}

export function FocusMode({ timeLeft, onStop }: FocusModeProps) {
  return (
    <div className="h-full bg-gray-50 flex flex-col items-center justify-center gap-10">
      {/* Logo text */}
      <div className="text-2xl font-medium text-tiffany tracking-wide">
        PomoCare
      </div>

      {/* Timer display */}
      <div className="text-7xl font-extralight text-gray-700 tracking-tight tabular-nums">
        {formatTime(timeLeft)}
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 flex items-center justify-center transition-colors"
      >
        <Square size={18} />
      </button>
    </div>
  );
}
