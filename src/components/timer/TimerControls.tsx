import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimerControlsProps {
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
}

export function TimerControls({ isRunning, onToggle, onReset }: TimerControlsProps) {
  return (
    <div className="flex gap-4 justify-center mb-6 landscape:mb-0">
      <button
        onClick={onToggle}
        className="w-16 h-16 landscape:w-14 landscape:h-14 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
      >
        {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
      </button>
      <button
        onClick={onReset}
        className="w-16 h-16 landscape:w-14 landscape:h-14 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
      >
        <RotateCcw size={24} />
      </button>
    </div>
  );
}
