import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimerControlsProps {
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
}

export function TimerControls({ isRunning, onToggle, onReset }: TimerControlsProps) {
  return (
    <div className="flex gap-4 justify-center mb-6">
      <button
        onClick={onToggle}
        className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
      >
        {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
      </button>
      <button
        onClick={onReset}
        className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition-colors"
      >
        <RotateCcw size={24} />
      </button>
    </div>
  );
}
