import { useState, useRef, useEffect } from 'react';
import { formatTime } from '@/utils/time';
import type { TimerMode } from '@/types/timer';
import { useI18n } from '@/contexts/I18nContext';

interface TimerDisplayProps {
  timeLeft: number;
  mode: TimerMode;
  /** Available work-time presets (minutes) shown in the dropdown */
  activePresets?: number[];
  /** Current work time in minutes (used to highlight active preset) */
  currentWorkTime?: number;
  /** Callback when user picks a new work time from the dropdown */
  onChangeWorkTime?: (min: number) => void;
  /** Whether the dropdown is enabled (false while running / on break) */
  isEditable?: boolean;
}

export function TimerDisplay({
  timeLeft,
  mode,
  activePresets,
  currentWorkTime,
  onChangeWorkTime,
  isEditable = false,
}: TimerDisplayProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const canEdit = isEditable && activePresets && activePresets.length > 0 && onChangeWorkTime;

  return (
    <div className="text-center mb-8 landscape:mb-3" ref={wrapperRef}>
      <div
        className={`text-7xl landscape:text-6xl font-light text-gray-800 dark:text-gray-200 tracking-tight inline-flex items-center gap-1 ${
          canEdit ? 'cursor-pointer hover:text-tiffany transition-colors' : ''
        }`}
        onClick={() => { if (canEdit) setOpen((v) => !v); }}
      >
        {formatTime(timeLeft)}
      </div>

      {/* Preset dropdown */}
      {canEdit && (
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: open ? `${(activePresets!.length * 48) + 16}px` : '0px',
            opacity: open ? 1 : 0,
          }}
        >
          <div className="mt-2 inline-flex flex-wrap gap-2 justify-center">
            {activePresets!.map((min, i) => (
              <button
                key={min}
                onClick={() => {
                  onChangeWorkTime!(min);
                  setOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  min === currentWorkTime
                    ? 'bg-tiffany text-white'
                    : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-tiffany/20'
                }`}
                style={{
                  transitionDelay: open ? `${i * 50}ms` : '0ms',
                  transform: open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.9)',
                  opacity: open ? 1 : 0,
                }}
              >
                {min}{t.activeTimeLabel.includes('分') ? '分' : 'min'}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'break' && (
        <div className="text-sm text-tiffany mt-2">{t.restMode}</div>
      )}
      {mode === 'longBreak' && (
        <div className="text-sm text-tiffany mt-2">{t.longBreakMode}</div>
      )}
    </div>
  );
}
