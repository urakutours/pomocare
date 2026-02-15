import { getCurrentDayOfWeek } from '@/utils/date';
import { useI18n } from '@/contexts/I18nContext';

interface SessionSummaryProps {
  todayCount: number;
  weekCount: number;
}

export function SessionSummary({ todayCount, weekCount }: SessionSummaryProps) {
  const { t } = useI18n();

  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <div className="text-3xl font-light text-gray-800 dark:text-gray-200">{todayCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.today}</div>
        </div>
        <div>
          <div className="text-3xl font-light text-gray-800 dark:text-gray-200">{weekCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.thisWeek}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {getCurrentDayOfWeek()}/7
          </div>
        </div>
      </div>
    </div>
  );
}
