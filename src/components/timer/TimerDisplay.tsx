import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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
        {canEdit && (
          <ChevronDown
            size={20}
            className={`text-gray-400 dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {/* Preset dropdown */}
      {open && canEdit && (
        <div className="mt-2 inline-flex flex-wrap gap-2 justify-center">
          {activePresets!.map((min) => (
            <button
              key={min}
              onClick={() => {
                onChangeWorkTime!(min);
                setOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                min === currentWorkTime
                  ? 'bg-tiffany text-white'
                  : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-tiffany/20'
              }`}
            >
              {min}{t.activeTimeLabel.includes('分') ? '分' : 'min'}
            </button>
          ))}
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
