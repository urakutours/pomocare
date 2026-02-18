import { useState, useMemo } from 'react';
import { X, Download } from 'lucide-react';
import type { DayData, MonthDayData } from '@/hooks/useSessions';
import { useI18n } from '@/contexts/I18nContext';
import type { PomodoroSession, LabelDefinition } from '@/types/session';

type StatTab = 'weekly' | 'monthly' | 'yearly';

interface StatsChartProps {
  sessions: PomodoroSession[];
  labels: LabelDefinition[];
  getWeekData: (offset: number) => DayData[];
  getMonthData: (offset: number) => MonthDayData[];
  getYearData: (offset: number) => { month: string; count: number; totalSeconds: number }[];
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

function Bar({
  ratio,
  count,
  totalSeconds,
  color,
}: {
  ratio: number;
  count: number;
  totalSeconds: number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center flex-1 group relative">
      <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
        <div
          className="w-full max-w-[28px] rounded-t transition-all"
          style={{
            height: `${ratio * 100}%`,
            minHeight: count > 0 ? '6px' : '0',
            backgroundColor: color ?? '#0abab5',
          }}
        />
      </div>
      {count > 0 && (
        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
          {count} &middot; {formatDuration(totalSeconds)}
        </div>
      )}
    </div>
  );
}

export function StatsChart({
  sessions,
  labels,
  getWeekData,
  getMonthData,
  getYearData,
  onClose,
}: StatsChartProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<StatTab>('weekly');
  const [offset, setOffset] = useState(0);
  // null = all sessions, string = filter by label id
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  // Filter sessions by label
  const filteredSessions = useMemo(() => {
    if (filterLabel === null) return sessions;
    return sessions.filter((s) => s.label === filterLabel);
  }, [sessions, filterLabel]);

  // For chart data, re-aggregate with filtered sessions
  const weekDataRaw = getWeekData(offset);
  const monthDataRaw = getMonthData(offset);
  const yearDataRaw = getYearData(offset);

  const weekData = useMemo(() => {
    if (filterLabel === null) return weekDataRaw;
    return weekDataRaw.map((d) => {
      const dayString = d.date.toDateString();
      const daySessions = filteredSessions.filter(
        (s) => new Date(s.date).toDateString() === dayString,
      );
      return {
        ...d,
        count: daySessions.length,
        totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLabel, filteredSessions, offset]);

  const monthData = useMemo(() => {
    if (filterLabel === null) return monthDataRaw;
    return monthDataRaw.map((d) => {
      const dayString = d.date.toDateString();
      const daySessions = filteredSessions.filter(
        (s) => new Date(s.date).toDateString() === dayString,
      );
      return {
        ...d,
        count: daySessions.length,
        totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLabel, filteredSessions, offset]);

  const yearData = useMemo(() => {
    if (filterLabel === null) return yearDataRaw;
    const targetYearVal = new Date().getFullYear() - offset;
    return yearDataRaw.map((d, m) => {
      const monthSessions = filteredSessions.filter((s) => {
        const date = new Date(s.date);
        return date.getFullYear() === targetYearVal && date.getMonth() === m;
      });
      return {
        ...d,
        count: monthSessions.length,
        totalSeconds: monthSessions.reduce((sum, s) => sum + s.duration, 0),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLabel, filteredSessions, offset]);

  const weekMaxCount = Math.max(...weekData.map((d) => d.count), 1);
  const weekTotalSeconds = weekData.reduce((s, d) => s + d.totalSeconds, 0);
  const weekTotalSessions = weekData.reduce((s, d) => s + d.count, 0);
  const weekStart = weekData[0].date;
  const weekEnd = weekData[6].date;
  const weekDateRange = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

  const monthMaxCount = Math.max(...monthData.map((d) => d.count), 1);
  const monthTotalSeconds = monthData.reduce((s, d) => s + d.totalSeconds, 0);
  const monthTotalSessions = monthData.reduce((s, d) => s + d.count, 0);
  const monthDate = monthData[0]?.date ?? new Date();
  const monthLabel = `${monthDate.getFullYear()} ${t.months[monthDate.getMonth()]}`;

  const yearMaxCount = Math.max(...yearData.map((d) => d.count), 1);
  const yearTotalSeconds = yearData.reduce((s, d) => s + d.totalSeconds, 0);
  const yearTotalSessions = yearData.reduce((s, d) => s + d.count, 0);
  const targetYear = new Date().getFullYear() - offset;

  const handleTabChange = (next: StatTab) => {
    setTab(next);
    setOffset(0);
  };

  const handleExportCsv = () => {
    const header = 'date,label,note,duration_minutes';
    const rows = filteredSessions.map((s) => {
      const date = new Date(s.date).toISOString().slice(0, 10);
      const label = s.label ?? '';
      const note = (s.note ?? '').replace(/,/g, ' ');
      const mins = Math.round(s.duration / 60);
      return `${date},${label},${note},${mins}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomodoro-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Per-label aggregation (all time, all sessions regardless of chart filter)
  const labelStats = useMemo(() => {
    return labels
      .map((l) => {
        const labelSessions = sessions.filter((s) => s.label === l.id);
        return {
          label: l,
          count: labelSessions.length,
          totalSeconds: labelSessions.reduce((sum, s) => sum + s.duration, 0),
        };
      })
      .filter((ls) => ls.count > 0);
  }, [labels, sessions]);

  const unlabeledSessions = useMemo(
    () => sessions.filter((s) => !s.label),
    [sessions],
  );

  const allTotalSeconds = useMemo(
    () => sessions.reduce((s, sess) => s + sess.duration, 0),
    [sessions],
  );

  const tabClass = (active: boolean) =>
    `flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-tiffany text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
    }`;

  const navButtonClass =
    'flex-1 py-1.5 px-3 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed';

  const totalSessions =
    tab === 'weekly'
      ? weekTotalSessions
      : tab === 'monthly'
        ? monthTotalSessions
        : yearTotalSessions;
  const totalSecs =
    tab === 'weekly' ? weekTotalSeconds : tab === 'monthly' ? monthTotalSeconds : yearTotalSeconds;

  // Bar color: use label color when filtering by a specific label
  const barColor = filterLabel
    ? (labels.find((l) => l.id === filterLabel)?.color ?? '#0abab5')
    : '#0abab5';

  const allText = t.allLabels;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">{t.weeklyStats}</h3>
        <button onClick={onClose}>
          <X size={18} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-3 flex-shrink-0">
        <button className={tabClass(tab === 'weekly')} onClick={() => handleTabChange('weekly')}>
          {t.weekly}
        </button>
        <button className={tabClass(tab === 'monthly')} onClick={() => handleTabChange('monthly')}>
          {t.monthly}
        </button>
        <button className={tabClass(tab === 'yearly')} onClick={() => handleTabChange('yearly')}>
          {t.yearly}
        </button>
      </div>

      {/* Label filter pills */}
      {labels.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3 flex-shrink-0">
          <button
            onClick={() => setFilterLabel(null)}
            className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
              filterLabel === null
                ? 'border-tiffany bg-tiffany text-white'
                : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700'
            }`}
          >
            {allText}
          </button>
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => setFilterLabel(filterLabel === l.id ? null : l.id)}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                filterLabel === l.id
                  ? 'text-white border-transparent'
                  : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700'
              }`}
              style={filterLabel === l.id ? { backgroundColor: l.color } : undefined}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Summary cards */}
        <div className="flex gap-3 mb-3 text-center">
          <div className="flex-1 bg-gray-50 dark:bg-neutral-800 rounded-lg py-2">
            <div className="text-lg font-light text-gray-800 dark:text-gray-200">
              {totalSessions}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.sessions}</div>
          </div>
          <div className="flex-1 bg-gray-50 dark:bg-neutral-800 rounded-lg py-2">
            <div className="text-lg font-light text-gray-800 dark:text-gray-200">
              {formatDuration(totalSecs)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.totalTime}</div>
          </div>
        </div>

        {/* Period label */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
          {tab === 'weekly'
            ? weekDateRange
            : tab === 'monthly'
              ? monthLabel
              : String(targetYear)}
        </div>

        {/* Weekly chart */}
        {tab === 'weekly' && (
          <div>
            <div className="flex justify-between items-end mb-1">
              {weekData.map((data, i) => (
                <Bar
                  key={i}
                  ratio={data.count / weekMaxCount}
                  count={data.count}
                  totalSeconds={data.totalSeconds}
                  color={barColor}
                />
              ))}
            </div>
            <div className="flex justify-between">
              {weekData.map((data, i) => (
                <div
                  key={i}
                  className="flex-1 text-center text-xs text-gray-600 dark:text-gray-400"
                >
                  {data.day}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly chart */}
        {tab === 'monthly' && (
          <div>
            <div className="flex justify-between items-end mb-1 gap-px">
              {monthData.map((data, i) => (
                <Bar
                  key={i}
                  ratio={data.count / monthMaxCount}
                  count={data.count}
                  totalSeconds={data.totalSeconds}
                  color={barColor}
                />
              ))}
            </div>
            <div className="flex justify-between gap-px">
              {monthData.map((_, i) => (
                <div key={i} className="flex-1 text-center" style={{ fontSize: '9px' }}>
                  <span className="text-gray-500 dark:text-gray-500">
                    {(i + 1) % 5 === 1 ? i + 1 : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yearly chart */}
        {tab === 'yearly' && (
          <div>
            <div className="flex justify-between items-end mb-1">
              {yearData.map((data, i) => (
                <Bar
                  key={i}
                  ratio={data.count / yearMaxCount}
                  count={data.count}
                  totalSeconds={data.totalSeconds}
                  color={barColor}
                />
              ))}
            </div>
            <div className="flex justify-between">
              {yearData.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 text-center text-xs text-gray-600 dark:text-gray-400"
                >
                  {t.months[i].slice(0, 1)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-label aggregation section */}
        {(labelStats.length > 0 || unlabeledSessions.length > 0) && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t.labelStats}
            </h4>
            <div className="space-y-2">
              {labelStats.map(({ label, count, totalSeconds }) => {
                const ratio = allTotalSeconds > 0 ? totalSeconds / allTotalSeconds : 0;
                return (
                  <div key={label.id} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                      {label.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 tabular-nums">
                      {count} &middot; {formatDuration(totalSeconds)}
                    </span>
                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${ratio * 100}%`, backgroundColor: label.color }}
                      />
                    </div>
                  </div>
                );
              })}
              {unlabeledSessions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300 dark:bg-neutral-600" />
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">
                    {t.noLabel}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">
                    {unlabeledSessions.length} &middot;{' '}
                    {formatDuration(unlabeledSessions.reduce((s, sess) => s + sess.duration, 0))}
                  </span>
                  <div className="w-16 h-1.5 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full rounded-full bg-gray-300 dark:bg-neutral-600 transition-all"
                      style={{
                        width:
                          allTotalSeconds > 0
                            ? `${(unlabeledSessions.reduce((s, sess) => s + sess.duration, 0) / allTotalSeconds) * 100}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation + Export */}
      <div className="flex-shrink-0 mt-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => setOffset(offset + 1)} className={navButtonClass}>
            {tab === 'weekly'
              ? t.previousWeek
              : tab === 'monthly'
                ? t.previousMonth
                : t.previousYear}
          </button>
          <button
            onClick={() => setOffset(Math.max(0, offset - 1))}
            disabled={offset === 0}
            className={navButtonClass}
          >
            {tab === 'weekly' ? t.nextWeek : tab === 'monthly' ? t.nextMonth : t.nextYear}
          </button>
        </div>

        <button
          onClick={handleExportCsv}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
        >
          <Download size={14} />
          {t.exportCsv}
        </button>
      </div>
    </div>
  );
}
