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

// ── Confirmation modal overlay ──────────────────────────────────────────────
interface ConfirmModalProps {
  message: string;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  message,
  confirmLabel,
  confirmIcon,
  confirmClass,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      {/* Dialog */}
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-6 w-72 mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-200 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          {/* Cancel */}
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-600 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          >
            キャンセル
          </button>
          {/* Confirm */}
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-1.5 transition-colors ${confirmClass}`}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
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
    <>
      {/* ── Confirm modals (rendered outside the layout flow) ── */}
      {confirmComplete && (
        <ConfirmModal
          message="セッションを完了しますか？"
          confirmLabel="完了"
          confirmIcon={<Check size={15} strokeWidth={2.5} />}
          confirmClass="bg-tiffany hover:bg-tiffany-hover"
          onConfirm={() => { setConfirmComplete(false); onComplete(); }}
          onCancel={() => setConfirmComplete(false)}
        />
      )}
      {confirmReset && (
        <ConfirmModal
          message="タイマーをリセットしますか？"
          confirmLabel="リセット"
          confirmIcon={<RotateCcw size={14} />}
          confirmClass="bg-gray-500 hover:bg-gray-600 dark:bg-neutral-500 dark:hover:bg-neutral-400"
          onConfirm={() => { setConfirmReset(false); onReset(); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {/* ── Main screen ── */}
      <div className="h-full bg-gray-50 dark:bg-neutral-800 flex flex-col items-center justify-center gap-10">
        {/* Logo text */}
        <div className="text-2xl font-medium text-tiffany tracking-wide">
          PomoCare
        </div>

        {/* Timer display */}
        <div className="text-7xl font-extralight text-gray-700 dark:text-gray-300 tracking-tight tabular-nums">
          {formatTime(timeLeft)}
        </div>

        {/* Buttons — position NEVER changes regardless of confirm state */}
        {isRunning ? (
          /* ---- Running: Stop + Complete ---- */
          <div className="flex items-center gap-4">
            <button
              onClick={onStop}
              className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors"
            >
              <Square size={18} />
            </button>
            <button
              onClick={() => setConfirmComplete(true)}
              className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
            >
              <Check size={24} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          /* ---- Paused: Resume + Reset ---- */
          <div className="flex items-center gap-4">
            <button
              onClick={onResume}
              className="w-16 h-16 rounded-full bg-tiffany hover:bg-tiffany-hover text-white flex items-center justify-center transition-colors shadow-md"
            >
              <Play size={24} className="ml-1" />
            </button>
            <button
              onClick={() => setConfirmReset(true)}
              className="w-16 h-16 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
            >
              <RotateCcw size={22} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
