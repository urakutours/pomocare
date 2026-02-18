import { formatTime } from '@/utils/time';
import type { TimerMode } from '@/types/timer';
import { useI18n } from '@/contexts/I18nContext';

interface TimerDisplayProps {
  timeLeft: number;
  mode: TimerMode;
}

export function TimerDisplay({ timeLeft, mode }: TimerDisplayProps) {
  const { t } = useI18n();

  return (
    <div className="text-center mb-8 landscape:mb-3">
      <div className="text-7xl landscape:text-6xl font-light text-gray-800 dark:text-gray-200 tracking-tight">
        {formatTime(timeLeft)}
      </div>
      {mode === 'break' && (
        <div className="text-sm text-tiffany mt-2">{t.restMode}</div>
      )}
      {mode === 'longBreak' && (
        <div className="text-sm text-tiffany mt-2">{t.longBreakMode}</div>
      )}
    </div>
  );
}
