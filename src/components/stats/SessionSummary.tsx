import { useState, useMemo, useRef, useEffect } from 'react';
import { X, MoreVertical, Tag, FileText, Trash2 } from 'lucide-react';
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
  onUpdateSession: (date: string, patch: Partial<Pick<PomodoroSession, 'label' | 'note'>>) => void;
  onDeleteSession: (date: string) => void;
}

type ModalType = 'today' | 'week' | null;
type EditMode = 'label' | 'note' | 'delete' | null;

export function SessionSummary({
  todayCount,
  weekCount,
  todayTotalSeconds,
  weekTotalSeconds,
  sessions,
  labels,
  onUpdateSession,
  onDeleteSession,
}: SessionSummaryProps) {
  const { t } = useI18n();
  const [modal, setModal] = useState<ModalType>(null);

  // Three-dot menu state
  const [openMenuDate, setOpenMenuDate] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftLabel, setDraftLabel] = useState<string | undefined>(undefined);
  // Track the session being edited (for footer panel)
  const [editingSession, setEditingSession] = useState<PomodoroSession | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on outside click (only when dropdown is open, not when editing)
  const editModeRef = useRef(editMode);
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);

  useEffect(() => {
    if (!openMenuDate) return;
    const handler = (e: MouseEvent) => {
      // Don't close if we're in an edit mode (label/note/delete panel is shown)
      if (editModeRef.current !== null) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuDate(null);
        setEditMode(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuDate]);

  // Reset menu state when modal closes
  useEffect(() => {
    if (!modal) {
      setOpenMenuDate(null);
      setEditMode(null);
    }
  }, [modal]);

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

  // Menu handlers
  const handleOpenMenu = (date: string) => {
    if (openMenuDate === date) {
      setOpenMenuDate(null);
      setEditMode(null);
    } else {
      setOpenMenuDate(date);
      setEditMode(null);
    }
  };

  const handleStartEditNote = (s: PomodoroSession) => {
    setDraftNote(s.note ?? '');
    setEditMode('note');
    setEditingSession(s);
  };

  const handleStartEditLabel = (s: PomodoroSession) => {
    setDraftLabel(s.label);
    setEditMode('label');
    setEditingSession(s);
  };

  const handleCommitNote = (date: string) => {
    onUpdateSession(date, { note: draftNote.trim() || undefined });
    setOpenMenuDate(null);
    setEditMode(null);
    setEditingSession(null);
  };

  const handleCommitLabel = (date: string) => {
    onUpdateSession(date, { label: draftLabel || undefined });
    setOpenMenuDate(null);
    setEditMode(null);
    setEditingSession(null);
  };

  const handleDelete = (date: string) => {
    onDeleteSession(date);
    setOpenMenuDate(null);
    setEditMode(null);
    setEditingSession(null);
  };

  const closeMenu = () => {
    setOpenMenuDate(null);
    setEditMode(null);
    setEditingSession(null);
  };

  // Reusable session row with three-dot menu
  const renderRow = (s: PomodoroSession, i: number) => {
    const lbl = s.label ? labelMap[s.label] : null;
    const isMenuOpen = openMenuDate === s.date;

    return (
      <div
        key={i}
        className="relative group flex items-start gap-2 py-1.5 border-b border-gray-50 dark:border-neutral-700 last:border-0"
      >
        {/* Color dot */}
        {lbl ? (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: lbl.color }} />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 bg-gray-200 dark:bg-neutral-600" />
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {lbl ? lbl.name : '—'}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap flex-shrink-0">
              {formatTimeOfDay(s.date)} · {formatDuration(s.duration)}
            </span>
          </div>

          {/* Note */}
          {s.note && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 text-left">{s.note}</p>
          )}
        </div>

        {/* Three-dot menu button + dropdown */}
        <div
          ref={isMenuOpen ? menuRef : undefined}
          className="relative flex-shrink-0"
        >
          <button
            onClick={() => handleOpenMenu(s.date)}
            className={`p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-opacity
              md:opacity-0 md:group-hover:opacity-100
              ${isMenuOpen ? 'md:opacity-100 text-gray-500 dark:text-gray-400' : ''}`}
          >
            <MoreVertical size={14} />
          </button>

          {/* Dropdown menu (shown only when no inline edit is active) */}
          {isMenuOpen && editMode === null && (
            <div className="absolute right-0 top-6 z-30 bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-lg w-40 overflow-hidden">
              <button
                onClick={() => handleStartEditLabel(s)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600 text-left"
              >
                <Tag size={13} className="flex-shrink-0" />
                <span>{t.sessionChangeLabel}</span>
              </button>
              <button
                onClick={() => handleStartEditNote(s)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600 text-left"
              >
                <FileText size={13} className="flex-shrink-0" />
                <span>{t.sessionEditNote}</span>
              </button>
              <button
                onClick={() => { setEditMode('delete'); setEditingSession(s); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 text-left"
              >
                <Trash2 size={13} className="flex-shrink-0" />
                <span>{t.sessionDelete}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="pt-2 flex justify-center">
        <div className="grid grid-cols-2 gap-8 text-center w-full max-w-[200px] items-start">
          <button onClick={() => setModal('today')} className="hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg py-1 -mx-1 transition-colors flex flex-col items-center">
            <div className="text-3xl font-light text-gray-800 dark:text-gray-200">{todayCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.today}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 min-h-[1em]">
              {todayTotalSeconds > 0 ? formatDuration(todayTotalSeconds) : ''}
            </div>
          </button>
          <button onClick={() => setModal('week')} className="hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg py-1 -mx-1 transition-colors flex flex-col items-center">
            <div className="text-3xl font-light text-gray-800 dark:text-gray-200">{weekCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.thisWeek}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 min-h-[1em]">
              {getCurrentDayOfWeek()}/7
              {weekTotalSeconds > 0 && ` · ${formatDuration(weekTotalSeconds)}`}
            </div>
          </button>
        </div>
      </div>

      {/* Detail modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setModal(null); closeMenu(); }}>
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
              <button onClick={() => { setModal(null); closeMenu(); }}>
                <X size={16} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

            {/* Edit panel — rendered outside scroll area to avoid overflow clipping */}
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
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleCommitLabel(editingSession.date)}
                    className="flex-1 py-1.5 text-xs text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors"
                  >
                    適用
                  </button>
                  <button
                    onClick={closeMenu}
                    className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-neutral-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                  >
                    キャンセル
                  </button>
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitNote(editingSession.date);
                    if (e.key === 'Escape') closeMenu();
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200 mb-2"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleCommitNote(editingSession.date)}
                    className="flex-1 py-1.5 text-xs text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors"
                  >
                    適用
                  </button>
                  <button
                    onClick={closeMenu}
                    className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-neutral-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {editingSession && editMode === 'delete' && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-neutral-700 flex-shrink-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">{t.sessionDelete}しますか？</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleDelete(editingSession.date)}
                    className="flex-1 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    {t.sessionDelete}
                  </button>
                  <button
                    onClick={closeMenu}
                    className="flex-1 py-1.5 text-xs border border-gray-300 dark:border-neutral-500 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
