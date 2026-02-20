import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { X, Download, MoreVertical, Tag, FileText, Trash2 } from 'lucide-react';
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
  onUpdateSession: (date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>) => void;
  onDeleteSession: (date: string) => void;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
}

// ---- Colorful stacked bar (for "all" view) ----
function StackedBar({
  total,
  maxCount,
  segments,
  totalSeconds,
  barHeight,
  onClick,
}: {
  total: number;
  maxCount: number;
  segments: { color: string; count: number }[];
  totalSeconds: number;
  barHeight: number;
  onClick?: () => void;
}) {
  const heightPx = total > 0 ? Math.max((total / maxCount) * barHeight, 6) : 0;
  return (
    <div
      className={`flex flex-col items-center flex-1 group relative ${total > 0 && onClick ? 'cursor-pointer' : ''}`}
      onClick={total > 0 ? onClick : undefined}
    >
      <div className="w-full flex items-end justify-center" style={{ height: `${barHeight}px` }}>
        <div
          className={`w-full max-w-[28px] rounded-t overflow-hidden flex flex-col-reverse ${total > 0 && onClick ? 'hover:opacity-80 transition-opacity' : ''}`}
          style={{ height: `${heightPx}px` }}
        >
          {segments.filter((s) => s.count > 0).map((seg, i) => (
            <div
              key={i}
              style={{
                flex: seg.count,
                backgroundColor: seg.color,
              }}
            />
          ))}
        </div>
      </div>
      {total > 0 && (
        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
          {total} &middot; {formatDuration(totalSeconds)}
        </div>
      )}
    </div>
  );
}

// ---- Single-color bar ----
function Bar({
  ratio,
  count,
  totalSeconds,
  color,
  barHeight,
  onClick,
}: {
  ratio: number;
  count: number;
  totalSeconds: number;
  color?: string;
  barHeight: number;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center flex-1 group relative ${count > 0 && onClick ? 'cursor-pointer' : ''}`}
      onClick={count > 0 ? onClick : undefined}
    >
      <div className="w-full flex items-end justify-center" style={{ height: `${barHeight}px` }}>
        <div
          className={`w-full max-w-[28px] rounded-t transition-all ${count > 0 && onClick ? 'hover:opacity-80' : ''}`}
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

// Format date as "2/19（木）" style for day headers
function formatDayHeader(date: Date, days: readonly string[]): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
  return `${month}/${day}（${dow}）`;
}

// ---- Bar detail modal (same look as SessionSummary modal) ----
function BarDetailModal({
  title,
  modalSessions,
  labels,
  onClose,
  onUpdateSession,
  onDeleteSession,
  groupByDay = false,
}: {
  title: string;
  modalSessions: PomodoroSession[];
  labels: LabelDefinition[];
  onClose: () => void;
  onUpdateSession: (date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>) => void;
  onDeleteSession: (date: string) => void;
  groupByDay?: boolean;
}) {
  const { t } = useI18n();
  const [openMenuDate, setOpenMenuDate] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'label' | 'note' | 'delete' | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftLabel, setDraftLabel] = useState<string | undefined>(undefined);
  const [editingSession, setEditingSession] = useState<PomodoroSession | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editModeRef = useRef(editMode);
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);

  const labelMap = useMemo(() => {
    const map: Record<string, LabelDefinition> = {};
    labels.forEach((l) => { map[l.id] = l; });
    return map;
  }, [labels]);

  const closeMenu = () => {
    setOpenMenuDate(null);
    setEditMode(null);
    setEditingSession(null);
  };

  useEffect(() => {
    if (!openMenuDate) return;
    const handler = (e: MouseEvent) => {
      if (editModeRef.current !== null) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuDate]);

  const handleStartEditLabel = (s: PomodoroSession) => {
    setDraftLabel(s.label);
    setEditMode('label');
    setEditingSession(s);
  };

  const handleStartEditNote = (s: PomodoroSession) => {
    setDraftNote(s.note ?? '');
    setEditMode('note');
    setEditingSession(s);
  };

  const handleCommitLabel = (date: string) => {
    onUpdateSession(date, { label: draftLabel || undefined });
    closeMenu();
  };

  const handleCommitNote = (date: string) => {
    onUpdateSession(date, { note: draftNote.trim() || undefined });
    closeMenu();
  };

  const handleDelete = (date: string) => {
    onDeleteSession(date);
    closeMenu();
  };

  const sorted = [...modalSessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group sessions by day for day-grouped display
  const sessionsByDay = useMemo(() => {
    if (!groupByDay) return null;
    const groups: { dateLabel: string; sessions: PomodoroSession[] }[] = [];
    let currentKey = '';
    for (const s of sorted) {
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
  }, [sorted, groupByDay, t.days]);

  const renderRow = (s: PomodoroSession, i: number) => {
    const lbl = s.label ? labelMap[s.label] : null;
    const isMenuOpen = openMenuDate === s.date;
    return (
      <div key={i} className="relative group flex items-start gap-2 py-1.5 border-b border-gray-50 dark:border-neutral-700 last:border-0">
        {lbl ? (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: lbl.color }} />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 bg-gray-200 dark:bg-neutral-600" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{lbl ? lbl.name : '—'}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap flex-shrink-0">
              {`${String(new Date(s.date).getHours()).padStart(2,'0')}:${String(new Date(s.date).getMinutes()).padStart(2,'0')}`} · {formatDuration(s.duration)}
            </span>
          </div>
          {s.note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-left">{s.note}</p>}
        </div>
        <div ref={isMenuOpen ? menuRef : undefined} className="relative flex-shrink-0">
          <button
            onClick={() => {
              if (openMenuDate === s.date) { setOpenMenuDate(null); setEditMode(null); }
              else { setOpenMenuDate(s.date); setEditMode(null); }
            }}
            className={`p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-opacity opacity-100 ${isMenuOpen ? 'text-gray-500 dark:text-gray-400' : ''}`}
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen && editMode === null && (
            <div className="absolute right-0 bottom-full mb-1 z-30 bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-lg w-40 overflow-hidden">
              <button onClick={() => handleStartEditLabel(s)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600 text-left">
                <Tag size={13} className="flex-shrink-0" /><span>{t.sessionChangeLabel}</span>
              </button>
              <button onClick={() => handleStartEditNote(s)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600 text-left">
                <FileText size={13} className="flex-shrink-0" /><span>{t.sessionEditNote}</span>
              </button>
              <button onClick={() => { setEditMode('delete'); setEditingSession(s); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 text-left">
                <Trash2 size={13} className="flex-shrink-0" /><span>{t.sessionDelete}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-80 max-h-[70vh] mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 pb-2 flex-shrink-0">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200">
            {title}
            <span className="ml-2 text-sm font-normal text-gray-400">
              {modalSessions.length} · {formatDuration(modalSessions.reduce((s, sess) => s + sess.duration, 0))}
            </span>
          </h4>
          <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">—</p>
          ) : groupByDay && sessionsByDay ? (
            /* Day-grouped display */
            <div>
              {sessionsByDay.map((group, gi) => (
                <div key={gi} className="mb-1">
                  <div className="flex items-center gap-2 py-1.5 sticky top-0 bg-white dark:bg-neutral-800 z-10">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {group.dateLabel}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-700" />
                  </div>
                  <div>{group.sessions.map((s, i) => renderRow(s, i))}</div>
                </div>
              ))}
            </div>
          ) : (
            /* Simple list display */
            <div>{sorted.map((s, i) => renderRow(s, i))}</div>
          )}
        </div>
        {editingSession && editMode === 'label' && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-neutral-700 flex-shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t.sessionChangeLabel}</p>
            <select
              autoFocus
              value={draftLabel ?? ''}
              onChange={(e) => setDraftLabel(e.target.value === '' ? undefined : e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 mb-2"
            >
              <option value="">{t.noLabel}</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="flex gap-1.5">
              <button onClick={() => handleCommitLabel(editingSession.date)} className="flex-1 py-1.5 text-xs text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors">適用</button>
              <button onClick={closeMenu} className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-neutral-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors">キャンセル</button>
            </div>
          </div>
        )}
        {editingSession && editMode === 'note' && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-neutral-700 flex-shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t.sessionEditNote}</p>
            <input
              autoFocus
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCommitNote(editingSession.date); if (e.key === 'Escape') closeMenu(); }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 mb-2"
            />
            <div className="flex gap-1.5">
              <button onClick={() => handleCommitNote(editingSession.date)} className="flex-1 py-1.5 text-xs text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors">適用</button>
              <button onClick={closeMenu} className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-neutral-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors">キャンセル</button>
            </div>
          </div>
        )}
        {editingSession && editMode === 'delete' && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-neutral-700 flex-shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">{t.sessionDelete}しますか？</p>
            <div className="flex gap-1.5">
              <button onClick={() => handleDelete(editingSession.date)} className="flex-1 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">{t.sessionDelete}</button>
              <button onClick={closeMenu} className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-neutral-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors">キャンセル</button>
            </div>
          </div>
        )}
      </div>
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
  onUpdateSession,
  onDeleteSession,
}: StatsChartProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<StatTab>('weekly');
  const [offset, setOffset] = useState(0);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  // Bar detail modal state
  const [barModal, setBarModal] = useState<{ title: string; sessions: PomodoroSession[]; groupByDay?: boolean } | null>(null);

  // Label stat modal state (label name/bar click)
  const [labelModal, setLabelModal] = useState<{ title: string; sessions: PomodoroSession[] } | null>(null);

  // Resizable bar chart height
  const [barHeight, setBarHeight] = useState(80);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: barHeight };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientY - dragRef.current.startY;
      setBarHeight(Math.max(40, Math.min(300, dragRef.current.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [barHeight]);

  const isAllMode = filterLabel === null;

  const filteredSessions = useMemo(() => {
    if (isAllMode) return sessions;
    return sessions.filter((s) => s.label === filterLabel);
  }, [sessions, filterLabel, isAllMode]);

  const weekDataRaw = getWeekData(offset);
  const monthDataRaw = getMonthData(offset);
  const yearDataRaw = getYearData(offset);

  const labelColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    labels.forEach((l) => { map[l.id] = l.color; });
    return map;
  }, [labels]);

  // Build per-label stacked segments for a set of sessions
  const buildSegments = (daySessions: PomodoroSession[]) => {
    const byLabel: Record<string, number> = {};
    daySessions.forEach((s) => {
      const key = s.label ?? '__none__';
      byLabel[key] = (byLabel[key] ?? 0) + 1;
    });
    const segs: { color: string; count: number }[] = [];
    labels.forEach((l) => {
      if (byLabel[l.id]) segs.push({ color: l.color, count: byLabel[l.id] });
    });
    if (byLabel['__none__']) segs.push({ color: '#9ca3af', count: byLabel['__none__'] });
    // flex-col-reverse renders last element at top, so reverse to match label list order (first label = top)
    return segs.reverse();
  };

  // Filtered week data (for single-label mode)
  const weekData = useMemo(() => {
    if (isAllMode) return weekDataRaw;
    return weekDataRaw.map((d) => {
      const dayString = d.date.toDateString();
      const daySessions = filteredSessions.filter(
        (s) => new Date(s.date).toDateString() === dayString,
      );
      return { ...d, count: daySessions.length, totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLabel, filteredSessions, offset]);

  // Stacked week data (for all mode)
  const weekStackedData = useMemo(() => {
    if (!isAllMode) return null;
    return weekDataRaw.map((d) => {
      const dayString = d.date.toDateString();
      const daySessions = sessions.filter((s) => new Date(s.date).toDateString() === dayString);
      return { ...d, segments: buildSegments(daySessions), totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0), count: daySessions.length };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllMode, sessions, offset, labels]);

  const monthData = useMemo(() => {
    if (isAllMode) return monthDataRaw;
    return monthDataRaw.map((d) => {
      const dayString = d.date.toDateString();
      const daySessions = filteredSessions.filter((s) => new Date(s.date).toDateString() === dayString);
      return { ...d, count: daySessions.length, totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLabel, filteredSessions, offset]);

  const monthStackedData = useMemo(() => {
    if (!isAllMode) return null;
    return monthDataRaw.map((d) => {
      const dayString = d.date.toDateString();
      const daySessions = sessions.filter((s) => new Date(s.date).toDateString() === dayString);
      return { ...d, segments: buildSegments(daySessions), totalSeconds: daySessions.reduce((sum, s) => sum + s.duration, 0), count: daySessions.length };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllMode, sessions, offset, labels]);

  const yearData = useMemo(() => {
    if (isAllMode) return yearDataRaw;
    const targetYearVal = new Date().getFullYear() - offset;
    return yearDataRaw.map((d, m) => {
      const monthSessions = filteredSessions.filter((s) => {
        const date = new Date(s.date);
        return date.getFullYear() === targetYearVal && date.getMonth() === m;
      });
      return { ...d, count: monthSessions.length, totalSeconds: monthSessions.reduce((sum, s) => sum + s.duration, 0) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLabel, filteredSessions, offset]);

  const yearStackedData = useMemo(() => {
    if (!isAllMode) return null;
    const targetYearVal = new Date().getFullYear() - offset;
    return yearDataRaw.map((d, m) => {
      const monthSessions = sessions.filter((s) => {
        const date = new Date(s.date);
        return date.getFullYear() === targetYearVal && date.getMonth() === m;
      });
      return { ...d, segments: buildSegments(monthSessions), totalSeconds: monthSessions.reduce((sum, s) => sum + s.duration, 0), count: monthSessions.length };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllMode, sessions, offset, labels]);

  // Use stacked data in all-mode, filtered data otherwise
  const effectiveWeekData  = (isAllMode && weekStackedData)  ? weekStackedData  : weekData;
  const effectiveMonthData = (isAllMode && monthStackedData) ? monthStackedData : monthData;
  const effectiveYearData  = (isAllMode && yearStackedData)  ? yearStackedData  : yearData;

  const weekMaxCount    = Math.max(...effectiveWeekData.map((d) => d.count), 1);
  const weekTotalSecs   = effectiveWeekData.reduce((s, d) => s + d.totalSeconds, 0);
  const weekTotalSessions = effectiveWeekData.reduce((s, d) => s + d.count, 0);
  const weekStart = weekDataRaw[0].date;
  const weekEnd   = weekDataRaw[6].date;
  const weekDateRange = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

  const monthMaxCount     = Math.max(...effectiveMonthData.map((d) => d.count), 1);
  const monthTotalSecs    = effectiveMonthData.reduce((s, d) => s + d.totalSeconds, 0);
  const monthTotalSessions = effectiveMonthData.reduce((s, d) => s + d.count, 0);
  const monthDate  = monthDataRaw[0]?.date ?? new Date();
  const monthLabel = `${monthDate.getFullYear()} ${t.months[monthDate.getMonth()]}`;

  const yearMaxCount     = Math.max(...effectiveYearData.map((d) => d.count), 1);
  const yearTotalSecs    = effectiveYearData.reduce((s, d) => s + d.totalSeconds, 0);
  const yearTotalSessions = effectiveYearData.reduce((s, d) => s + d.count, 0);
  const targetYear = new Date().getFullYear() - offset;

  const handleTabChange = (next: StatTab) => { setTab(next); setOffset(0); };

  const handleExportCsv = () => {
    const header = 'date,time,label,note,duration_minutes';
    const rows = filteredSessions.map((s) => {
      const d = new Date(s.date);
      const date = d.toISOString().slice(0, 10);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const labelDef = s.label ? labels.find((l) => l.id === s.label) : null;
      const label = labelDef ? labelDef.name : '';
      const note = (s.note ?? '').replace(/,/g, ' ');
      const mins = Math.round(s.duration / 60);
      return `${date},${time},${label},${note},${mins}`;
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

  const labelStats = useMemo(() => {
    return labels
      .map((l) => {
        const ls = sessions.filter((s) => s.label === l.id);
        return { label: l, count: ls.length, totalSeconds: ls.reduce((sum, s) => sum + s.duration, 0) };
      })
      .filter((ls) => ls.count > 0);
  }, [labels, sessions]);

  const unlabeledSessions = useMemo(() => sessions.filter((s) => !s.label), [sessions]);
  const allTotalSeconds = useMemo(() => sessions.reduce((s, sess) => s + sess.duration, 0), [sessions]);

  const tabClass = (active: boolean) =>
    `flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-tiffany text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
    }`;

  const navButtonClass = 'flex-1 py-1.5 px-3 bg-white dark:bg-neutral-700 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed';

  const totalSessions = tab === 'weekly' ? weekTotalSessions : tab === 'monthly' ? monthTotalSessions : yearTotalSessions;
  const totalSecs     = tab === 'weekly' ? weekTotalSecs     : tab === 'monthly' ? monthTotalSecs     : yearTotalSecs;

  const barColor = filterLabel ? (labelColorMap[filterLabel] ?? '#0abab5') : '#0abab5';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">{t.weeklyStats}</h3>
        <button onClick={onClose}><X size={18} className="text-gray-500 dark:text-gray-400" /></button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-3 flex-shrink-0">
        <button className={tabClass(tab === 'weekly')}  onClick={() => handleTabChange('weekly')}>{t.weekly}</button>
        <button className={tabClass(tab === 'monthly')} onClick={() => handleTabChange('monthly')}>{t.monthly}</button>
        <button className={tabClass(tab === 'yearly')}  onClick={() => handleTabChange('yearly')}>{t.yearly}</button>
      </div>

      {/* Label filter dropdown */}
      {labels.length > 0 && (
        <div className="mb-3 flex-shrink-0">
          <div className="relative inline-block">
            {filterLabel && (
              <span
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
                style={{ backgroundColor: labelColorMap[filterLabel] }}
              />
            )}
            <select
              value={filterLabel ?? ''}
              onChange={(e) => setFilterLabel(e.target.value === '' ? null : e.target.value)}
              className={`pr-6 py-1 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 appearance-none ${filterLabel ? 'pl-6' : 'pl-2.5'}`}
            >
              <option value="">{t.allLabels}</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Summary cards */}
        <div className="flex gap-3 mb-3 text-center">
          <div className="flex-1 bg-gray-50 dark:bg-neutral-800 rounded-lg py-2">
            <div className="text-lg font-light text-gray-800 dark:text-gray-200">{totalSessions}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.sessions}</div>
          </div>
          <div className="flex-1 bg-gray-50 dark:bg-neutral-800 rounded-lg py-2">
            <div className="text-lg font-light text-gray-800 dark:text-gray-200">{formatDuration(totalSecs)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.totalTime}</div>
          </div>
        </div>

        {/* Period label */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-3">
          {tab === 'weekly' ? weekDateRange : tab === 'monthly' ? monthLabel : String(targetYear)}
        </div>

        {/* Weekly chart */}
        {tab === 'weekly' && (
          <div>
            <div className="flex justify-between items-end mb-1">
              {effectiveWeekData.map((data, i) => {
                const dayDate = weekDataRaw[i].date;
                const daySessions = filteredSessions.filter((s) => new Date(s.date).toDateString() === dayDate.toDateString());
                const title = `${dayDate.getMonth() + 1}/${dayDate.getDate()}（${weekDataRaw[i].day}）`;
                const handleClick = () => setBarModal({ title, sessions: daySessions });
                return isAllMode && weekStackedData ? (
                  <StackedBar key={i} total={data.count} maxCount={weekMaxCount} segments={(data as typeof weekStackedData[0]).segments} totalSeconds={data.totalSeconds} barHeight={barHeight} onClick={handleClick} />
                ) : (
                  <Bar key={i} ratio={data.count / weekMaxCount} count={data.count} totalSeconds={data.totalSeconds} color={barColor} barHeight={barHeight} onClick={handleClick} />
                );
              })}
            </div>
            <div className="flex justify-between">
              {weekDataRaw.map((data, i) => (
                <div key={i} className="flex-1 text-center text-xs text-gray-600 dark:text-gray-400">{data.day}</div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly chart */}
        {tab === 'monthly' && (
          <div>
            <div className="flex justify-between items-end mb-1 gap-px">
              {effectiveMonthData.map((data, i) => {
                const dayDate = monthDataRaw[i].date;
                const daySessions = filteredSessions.filter((s) => new Date(s.date).toDateString() === dayDate.toDateString());
                const title = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;
                const handleClick = () => setBarModal({ title, sessions: daySessions });
                return isAllMode && monthStackedData ? (
                  <StackedBar key={i} total={data.count} maxCount={monthMaxCount} segments={(data as typeof monthStackedData[0]).segments} totalSeconds={data.totalSeconds} barHeight={barHeight} onClick={handleClick} />
                ) : (
                  <Bar key={i} ratio={data.count / monthMaxCount} count={data.count} totalSeconds={data.totalSeconds} color={barColor} barHeight={barHeight} onClick={handleClick} />
                );
              })}
            </div>
            <div className="flex justify-between gap-px">
              {monthDataRaw.map((_, i) => (
                <div key={i} className="flex-1 text-center" style={{ fontSize: '9px' }}>
                  <span className="text-gray-500 dark:text-gray-500">{(i + 1) % 5 === 1 ? i + 1 : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yearly chart */}
        {tab === 'yearly' && (
          <div>
            <div className="flex justify-between items-end mb-1">
              {effectiveYearData.map((data, i) => {
                const monthSessions = filteredSessions.filter((s) => {
                  const d = new Date(s.date);
                  return d.getFullYear() === targetYear && d.getMonth() === i;
                });
                const title = `${targetYear} ${t.months[i]}`;
                const handleClick = () => setBarModal({ title, sessions: monthSessions, groupByDay: true });
                return isAllMode && yearStackedData ? (
                  <StackedBar key={i} total={data.count} maxCount={yearMaxCount} segments={(data as typeof yearStackedData[0]).segments} totalSeconds={data.totalSeconds} barHeight={barHeight} onClick={handleClick} />
                ) : (
                  <Bar key={i} ratio={data.count / yearMaxCount} count={data.count} totalSeconds={data.totalSeconds} color={barColor} barHeight={barHeight} onClick={handleClick} />
                );
              })}
            </div>
            <div className="flex justify-between">
              {yearDataRaw.map((_, i) => (
                <div key={i} className="flex-1 text-center text-xs text-gray-600 dark:text-gray-400">
                  {t.months[i].slice(0, 1)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drag handle to resize chart height */}
        <div
          onPointerDown={handleDragStart}
          className="flex justify-center items-center py-2 cursor-ns-resize touch-none select-none group"
        >
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-neutral-600 group-hover:bg-gray-300 dark:group-hover:bg-neutral-500 transition-colors" />
        </div>

        {/* Per-label aggregation section */}
        {(labelStats.length > 0 || unlabeledSessions.length > 0) && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t.labelStats}</h4>
            <div className="space-y-2.5">
              {labelStats.map(({ label, count, totalSeconds }) => {
                const ratio = allTotalSeconds > 0 ? totalSeconds / allTotalSeconds : 0;
                const labelSessions = sessions.filter((s) => s.label === label.id);
                const handleLabelClick = () => setLabelModal({ title: label.name, sessions: labelSessions });
                return (
                  <button
                    key={label.id}
                    className="w-full text-left hover:bg-gray-50 dark:hover:bg-neutral-700/50 rounded-lg px-1 py-0.5 -mx-1 transition-colors cursor-pointer"
                    onClick={handleLabelClick}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{label.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{count} &middot; {formatDuration(totalSeconds)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, backgroundColor: label.color }} />
                    </div>
                  </button>
                );
              })}
              {unlabeledSessions.length > 0 && (() => {
                const unlabeledTotal = unlabeledSessions.reduce((s, sess) => s + sess.duration, 0);
                const unlabeledRatio = allTotalSeconds > 0 ? unlabeledTotal / allTotalSeconds : 0;
                return (
                  <button
                    className="w-full text-left hover:bg-gray-50 dark:hover:bg-neutral-700/50 rounded-lg px-1 py-0.5 -mx-1 transition-colors cursor-pointer"
                    onClick={() => setLabelModal({ title: t.noLabel, sessions: unlabeledSessions })}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300 dark:bg-neutral-600" />
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{t.noLabel}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                        {unlabeledSessions.length} &middot; {formatDuration(unlabeledTotal)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-300 dark:bg-neutral-600 transition-all"
                        style={{ width: `${unlabeledRatio * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Navigation + Export */}
      <div className="flex-shrink-0 mt-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => setOffset(offset + 1)} className={navButtonClass}>
            {tab === 'weekly' ? t.previousWeek : tab === 'monthly' ? t.previousMonth : t.previousYear}
          </button>
          <button onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} className={navButtonClass}>
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

      {/* Bar detail modal */}
      {barModal && (
        <BarDetailModal
          title={barModal.title}
          modalSessions={barModal.sessions}
          labels={labels}
          onClose={() => setBarModal(null)}
          onUpdateSession={onUpdateSession}
          onDeleteSession={onDeleteSession}
          groupByDay={barModal.groupByDay ?? false}
        />
      )}

      {/* Label stat modal (label name / bar click) */}
      {labelModal && (
        <BarDetailModal
          title={labelModal.title}
          modalSessions={labelModal.sessions}
          labels={labels}
          onClose={() => setLabelModal(null)}
          onUpdateSession={onUpdateSession}
          onDeleteSession={onDeleteSession}
          groupByDay={true}
        />
      )}
    </div>
  );
}
