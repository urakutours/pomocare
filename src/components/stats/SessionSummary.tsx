import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { getCurrentDayOfWeek } from '@/utils/date';
import { useI18n } from '@/contexts/I18nContext';
import type { PomodoroSession, LabelDefinition } from '@/types/session';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Format date as "2/19（木）" style
function formatDayHeader(date: Date, days: readonly string[]): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
  return `${month}/${day}（${dow}）`;
}

interface SessionSummaryProps {
  todayCount: number;
  weekCount: number;
  todayTotalSeconds: number;
  weekTotalSeconds: number;
  sessions: PomodoroSession[];
  labels: LabelDefinition[];
}

type ModalType = 'today' | 'week' | null;

export function SessionSummary({
  todayCount,
  weekCount,
  todayTotalSeconds,
  weekTotalSeconds,
  sessions,
  labels,
}: SessionSummaryProps) {
  const { t } = useI18n();
  const [modal, setModal] = useState<ModalType>(null);

  const labelMap = useMemo(() => {
    const map: Record<string, LabelDefinition> = {};
    labels.forEach((l) => { map[l.id] = l; });
    return map;
  }, [labels]);

  // Sort ascending (oldest → newest)
  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter((s) => new Date(s.date).toDateString() === today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions]);

  const weekSessions = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessions
      .filter((s) => new Date(s.date) >= weekAgo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions]);

  // Group week sessions by day
  const weekSessionsByDay = useMemo(() => {
    const groups: { dateLabel: string; sessions: PomodoroSession[] }[] = [];
    let currentKey = '';
    for (const s of weekSessions) {
      const d = new Date(s.date);
      const key = d.toDateString();
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ dateLabel: formatDayHeader(d, t.days), sessions: [s] });
      } else {
        groups[groups.length - 1].sessions.push(s);
      }
    }
    return groups;
  }, [weekSessions, t.days]);

  const modalSessions = modal === 'today' ? todaySessions : modal === 'week' ? weekSessions : [];
  const modalTitle = modal === 'today' ? t.today : t.thisWeek;

  // Reusable session row
  const renderRow = (s: PomodoroSession, i: number) => {
    const lbl = s.label ? labelMap[s.label] : null;
    return (
      <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 dark:border-neutral-700 last:border-0">
        {lbl ? (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: lbl.color }} />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 bg-gray-200 dark:bg-neutral-600" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {lbl ? lbl.name : '—'}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap flex-shrink-0">
              {formatTimeOfDay(s.date)} · {formatDuration(s.duration)}
            </span>
          </div>
          {s.note && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-left">{s.note}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="pt-2 flex justify-center">
        <div className="grid grid-cols-2 gap-8 text-center w-full max-w-[200px]">
          <button onClick={() => setModal('today')} className="hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg py-1 -mx-1 transition-colors">
            <div className="text-3xl font-light text-gray-800 dark:text-gray-200">{todayCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.today}</div>
            {todayTotalSeconds > 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {formatDuration(todayTotalSeconds)}
              </div>
            )}
          </button>
          <button onClick={() => setModal('week')} className="hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg py-1 -mx-1 transition-colors">
            <div className="text-3xl font-light text-gray-800 dark:text-gray-200">{weekCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.thisWeek}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {getCurrentDayOfWeek()}/7
              {weekTotalSeconds > 0 && ` · ${formatDuration(weekTotalSeconds)}`}
            </div>
          </button>
        </div>
      </div>

      {/* Detail modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div
            className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-80 max-h-[70vh] mx-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center p-4 pb-2 flex-shrink-0">
              <h4 className="font-semibold text-gray-700 dark:text-gray-200">
                {modalTitle}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {modalSessions.length} · {formatDuration(modalSessions.reduce((s, sess) => s + sess.duration, 0))}
                </span>
              </h4>
              <button onClick={() => setModal(null)}>
                <X size={16} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {modalSessions.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">—</p>
              ) : modal === 'today' ? (
                /* Today: simple list, oldest first */
                <div>{todaySessions.map((s, i) => renderRow(s, i))}</div>
              ) : (
                /* Week: grouped by day with divider, oldest first */
                <div>
                  {weekSessionsByDay.map((group, gi) => (
                    <div key={gi} className="mb-1">
                      {/* Day header */}
                      <div className="flex items-center gap-2 py-1.5 sticky top-0 bg-white dark:bg-neutral-800 z-10">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {group.dateLabel}
                        </span>
                        <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-700" />
                      </div>
                      {/* Sessions */}
                      <div>{group.sessions.map((s, i) => renderRow(s, i))}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
