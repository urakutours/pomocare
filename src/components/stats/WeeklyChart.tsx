import { useState } from 'react';
import { X } from 'lucide-react';
import type { DayData } from '@/hooks/useSessions';
import { useI18n } from '@/contexts/I18nContext';

interface WeeklyChartProps {
  getWeekData: (offset: number) => DayData[];
  onClose: () => void;
}

export function WeeklyChart({ getWeekData, onClose }: WeeklyChartProps) {
  const { t } = useI18n();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekData = getWeekData(weekOffset);
  const maxCount = Math.max(...weekData.map((d) => d.count), 1);

  const dateRange = (() => {
    const start = weekData[0].date;
    const end = weekData[6].date;
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  })();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-700">{t.weeklyStats}</h3>
        <button onClick={onClose}>
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="text-center text-sm text-gray-600 mb-4">{dateRange}</div>

      <div className="flex justify-between items-end h-32 mb-4">
        {weekData.map((data, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <div
              className="w-full flex items-end justify-center"
              style={{ height: '100px' }}
            >
              <div
                className="w-8 rounded-t transition-all bg-tiffany"
                style={{
                  height: `${(data.count / maxCount) * 100}%`,
                  minHeight: data.count > 0 ? '8px' : '0',
                }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-2">{data.day}</div>
            <div className="text-xs text-gray-400">{data.count}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          className="flex-1 py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          {t.previousWeek}
        </button>
        <button
          onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
          disabled={weekOffset === 0}
          className="flex-1 py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.nextWeek}
        </button>
      </div>
    </div>
  );
}
