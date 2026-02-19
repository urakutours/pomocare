import { useState } from 'react';
import { Square, Check, Play, RotateCcw } from 'lucide-react';
import { formatTime } from '@/utils/time';

interface FocusModeProps {
  timeLeft: number;
  /** true = timer is actively running; false = paused mid-session */
  isRunning: boolean;
  onStop: () => void;
  onResume: () => void;
  onComplete: () => void;
  onReset: () => void;
}

export function FocusMode({
  timeLeft,
  isRunning,
  onStop,
  onResume,
  onComplete,
  onReset,
}: FocusModeProps) {
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

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
      {isRunning ? (
        /* ---- Running: Stop + Complete ---- */
        <div className="flex items-center gap-4">
          {/* Stop button */}
          <button
            onClick={onStop}
            className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors"
          >
            <Square size={18} />
          </button>

          {/* Complete button → show confirm */}
          {confirmComplete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setConfirmComplete(false); onComplete(); }}
                className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
              >
                <Check size={22} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setConfirmComplete(false)}
                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors text-xs font-medium"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmComplete(true)}
              className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
            >
              <Check size={24} strokeWidth={2.5} />
            </button>
          )}
        </div>
      ) : (
        /* ---- Paused: Resume + Reset ---- */
        <div className="flex items-center gap-4">
          {/* Resume button */}
          <button
            onClick={onResume}
            className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
          >
            <Play size={24} className="ml-1" />
          </button>

          {/* Reset button → show confirm */}
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setConfirmReset(false); onReset(); }}
                className="w-16 h-16 rounded-full bg-gray-400 hover:bg-gray-500 dark:bg-neutral-500 dark:hover:bg-neutral-400 text-white flex items-center justify-center transition-colors"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors text-xs font-medium"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
            >
              <RotateCcw size={22} />
            </button>
          )}
        </div>
      )}

      {/* Confirm labels */}
      {(confirmComplete || confirmReset) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 -mt-6">
          {confirmComplete ? 'セッションを完了しますか？' : 'タイマーをリセットしますか？'}
        </p>
      )}
    </div>
  );
}
