import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { X, Plus, Trash2, Sun, Moon, Play, MoreVertical, Pencil, GripVertical, Upload, Download, Lock } from 'lucide-react';
import type { PomodoroSettings, ThemeMode, AlarmSound } from '@/types/settings';
import { DEFAULT_ACTIVE_PRESETS, DEFAULT_REST_PRESETS } from '@/types/settings';
import type { LabelDefinition, PomodoroSession } from '@/types/session';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeatureContext';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { SUPPORTED_LANGUAGES, getTranslations } from '@/i18n';
import type { Language } from '@/i18n';
import { previewAlarm } from '@/utils/alarm';
import { QuickLabelModal } from '@/App';

interface SettingsPanelProps {
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  onClose: () => void;
  onClearAll: () => void;
  onImportCsv: (sessions: PomodoroSession[]) => Promise<void>;
  sessions: PomodoroSession[];
  labels: LabelDefinition[];
  onSaveLabels?: (labels: LabelDefinition[]) => void;
}

type SettingsTab = 'general' | 'labels' | 'presets';

const selectClass =
  'flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany bg-white dark:bg-neutral-700 dark:text-gray-200';
const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400';
const inputSmClass =
  'w-20 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200';
const labelClass = 'block text-sm text-gray-600 dark:text-gray-400 mb-1';

// Long break options (0 = OFF)
const LONG_BREAK_OPTIONS = [0, 15, 20];
const LONG_BREAK_INTERVAL_OPTIONS = [0, 3, 4];

// ---- Refined color palette (inspired by popular palette sites) ----
const LABEL_COLORS = [
  // Warm pastels / blush
  '#F4A7A0', '#F28B7D', '#E8736A', '#D45C54',
  // Pinks / roses
  '#F4A0C0', '#E87DA8', '#D45C8F', '#C04477',
  // Purples / lavenders
  '#B8A4D8', '#9B87C4', '#7C6BAF', '#6355A0',
  // Blues / periwinkle
  '#A4BAE8', '#7FA0D8', '#5A87C8', '#3B6DB8',
  // Teals / cyans
  '#7FD4CC', '#4DB8B0', '#2A9C94', '#0abab5',
  // Greens / sage
  '#A0D4A0', '#7DBF7D', '#5AAA5A', '#3D943D',
  // Yellows / golds
  '#F4D48A', '#E8BC5A', '#D4A030', '#B88820',
  // Oranges / terracotta
  '#F4B07A', '#E8904A', '#D4702A', '#B85A18',
  // Neutrals / stone
  '#C0B8B0', '#A09890', '#808070', '#606050',
];

function TimeSelector({
  label,
  value,
  presets,
  onChange,
  isRest,
  restOffLabel,
  customLabel,
}: {
  label: string;
  value: number;
  presets: number[];
  onChange: (v: number) => void;
  isRest?: boolean;
  restOffLabel: string;
  customLabel: string;
}) {
  const [isCustom, setIsCustom] = useState(!presets.includes(value));
  const [customValue, setCustomValue] = useState(String(value));

  const formatOption = (v: number) => {
    if (isRest && v === 0) return restOffLabel;
    return `${v}`;
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setIsCustom(true);
      setCustomValue(String(value));
    } else {
      setIsCustom(false);
      onChange(Number(selected));
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const min = isRest ? 0 : 1;
      onChange(Math.max(min, parsed));
    }
  };

  const handleCustomBlur = () => {
    const parsed = parseInt(customValue, 10);
    if (isNaN(parsed) || customValue === '') {
      const fallback = isRest ? 0 : 1;
      setCustomValue(String(fallback));
      onChange(fallback);
    }
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <select
          value={isCustom ? '__custom__' : String(value)}
          onChange={handleSelect}
          className={selectClass}
        >
          {presets.map((p) => (
            <option key={p} value={String(p)}>
              {formatOption(p)}
            </option>
          ))}
          <option value="__custom__">{customLabel}</option>
        </select>
        {isCustom && (
          <input
            type="number"
            value={customValue}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            min={isRest ? 0 : 1}
            className={inputSmClass}
          />
        )}
      </div>
    </div>
  );
}

function PresetEditor({
  label,
  presets,
  onChange,
  isRest,
  restOffLabel,
  addLabel,
}: {
  label: string;
  presets: number[];
  onChange: (presets: number[]) => void;
  isRest?: boolean;
  restOffLabel: string;
  addLabel: string;
}) {
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    const parsed = parseInt(newValue, 10);
    if (isNaN(parsed) || parsed < 0) return;
    if (presets.includes(parsed)) return;
    const updated = [...presets, parsed].sort((a, b) => a - b);
    onChange(updated);
    setNewValue('');
  };

  const handleRemove = (val: number) => {
    onChange(presets.filter((p) => p !== val));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-neutral-700 rounded text-sm text-gray-700 dark:text-gray-300"
          >
            {isRest && p === 0 ? restOffLabel : `${p}`}
            <button
              onClick={() => handleRemove(p)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          min={isRest ? 0 : 1}
          placeholder="min"
          className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200"
        />
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 text-gray-700 dark:text-gray-300 flex items-center gap-1"
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function ThemeToggle({
  label,
  value,
  onChange,
  lightLabel,
  grayLabel,
  darkLabel,
}: {
  label: string;
  value: ThemeMode;
  onChange: (v: ThemeMode) => void;
  lightLabel: string;
  grayLabel: string;
  darkLabel: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('light')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ${
            value === 'light'
              ? 'border-tiffany bg-white text-tiffany font-medium ring-2 ring-tiffany'
              : 'border-gray-300 dark:border-neutral-500 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Sun size={14} />
          {lightLabel}
        </button>
        <button
          onClick={() => onChange('gray')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ${
            value === 'gray'
              ? 'border-tiffany bg-neutral-700 text-tiffany font-medium ring-2 ring-tiffany'
              : 'border-gray-300 dark:border-neutral-600 bg-neutral-700 text-gray-300 hover:bg-neutral-600'
          }`}
        >
          <Moon size={14} />
          {grayLabel}
        </button>
        <button
          onClick={() => onChange('dark')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ${
            value === 'dark'
              ? 'border-tiffany text-gray-400 font-medium ring-2 ring-tiffany'
              : 'border-gray-300 dark:border-neutral-600 text-gray-400 hover:bg-neutral-600'
          }`}
          style={{ backgroundColor: value === 'dark' ? 'rgb(44, 47, 50)' : 'rgb(30, 33, 37)' }}
        >
          <Moon size={14} />
          {darkLabel}
        </button>
      </div>
    </div>
  );
}

// ---- Color Picker with custom color support ----
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform flex-shrink-0 ${value === c ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-300 scale-110' : 'hover:scale-105'}`}
          style={{ backgroundColor: c }}
        />
      ))}
      {/* Custom color button */}
      <button
        onClick={() => fileRef.current?.click()}
        title="Custom color"
        className="w-5 h-5 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center hover:border-tiffany transition-colors flex-shrink-0"
        style={!LABEL_COLORS.includes(value) ? { backgroundColor: value, borderStyle: 'solid', borderColor: '#6b7280' } : {}}
      >
        {LABEL_COLORS.includes(value) && <Plus size={10} className="text-gray-400" />}
      </button>
      <input
        ref={fileRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}

// ---- Add Label Modal ----
function AddLabelModal({
  onAdd,
  onClose,
  addLabel,
}: {
  onAdd: (label: LabelDefinition) => void;
  onClose: () => void;
  addLabel: string;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[19]); // tiffany default
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ id: Date.now().toString(36), name: trimmed, color });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-5 w-72 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{addLabel}</h4>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Label name"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 mb-3"
        />
        <ColorPicker value={color} onChange={setColor} />
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="mt-4 w-full py-2 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg disabled:opacity-40 transition-colors"
        >
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

// ---- CSV Import Modal ----
function CsvImportModal({
  onImport,
  onClose,
}: {
  onImport: (file: File) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return;
    onImport(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-6 w-80 mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-200">{t.csvImportTitle}</h4>
          <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" /></button>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 px-4 transition-colors cursor-default select-none ${
            isDragOver
              ? 'border-tiffany bg-tiffany/5'
              : 'border-gray-300 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-700/40'
          }`}
        >
          <Upload size={28} className={isDragOver ? 'text-tiffany' : 'text-gray-300 dark:text-gray-500'} />
          <p className={`text-sm text-center ${isDragOver ? 'text-tiffany font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            {t.csvImportModalDropzone}
          </p>
          <p className="text-xs text-gray-300 dark:text-gray-600">{t.csvImportModalOr}</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors"
          >
            {t.csvImportModalSelectFile}
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="sr-only"
        />

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl border border-gray-200 dark:border-neutral-600 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        >
          {t.csvImportModalCancel}
        </button>
      </div>
    </div>
  );
}

// ---- Shared confirm modal (same style as FocusMode) ----
function ConfirmModal({
  message,
  confirmLabel,
  confirmClass,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-6 w-72 mx-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm font-medium text-gray-700 dark:text-gray-200 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-600 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm text-white font-medium transition-colors ${confirmClass ?? 'bg-red-500 hover:bg-red-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Label dot menu (edit / delete) ----
function LabelDotMenu({
  label,
  onEdit,
  onDelete,
  renameLabel,
  deleteLabel,
  cancelLabel,
  labelNamePlaceholder,
  saveLabel,
}: {
  label: LabelDefinition;
  onEdit: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  renameLabel: string;
  deleteLabel: string;
  cancelLabel: string;
  labelNamePlaceholder: string;
  saveLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => { setOpen(false); };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          message={`${label.name}`}
          confirmLabel={deleteLabel}
          confirmClass="bg-red-500 hover:bg-red-600"
          cancelLabel={cancelLabel}
          onConfirm={() => { setShowDeleteConfirm(false); onDelete(label.id); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Edit label modal (QuickLabelModal in edit mode) */}
      {showEditModal && (
        <QuickLabelModal
          onAdd={(edited) => { onEdit(edited.id, edited.name, edited.color); setShowEditModal(false); }}
          onClose={() => setShowEditModal(false)}
          addNewLabel=""
          labelNamePlaceholder={labelNamePlaceholder}
          addButtonText=""
          initialName={label.name}
          initialColor={label.color}
          editId={label.id}
          title={renameLabel}
          buttonText={saveLabel}
        />
      )}

      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <MoreVertical size={14} />
        </button>

        {open && (
          <div className="absolute right-0 top-6 z-30 bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-lg w-44 overflow-hidden">
            <button
              onClick={() => { close(); setShowEditModal(true); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600"
            >
              <Pencil size={13} /> {renameLabel}
            </button>
            <button
              onClick={() => { close(); setShowDeleteConfirm(true); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Trash2 size={13} /> {deleteLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---- Label Manager (redesigned with drag-to-reorder) ----
function LabelManager({
  labels,
  onChange,
  addLabel,
  renameLabel,
  deleteLabel,
  cancelLabel,
  noLabelsText,
  labelNamePlaceholder,
  saveLabel,
  maxLabels,
  limitMessage,
  onUpgrade,
}: {
  labels: LabelDefinition[];
  onChange: (labels: LabelDefinition[]) => void;
  addLabel: string;
  renameLabel: string;
  deleteLabel: string;
  cancelLabel: string;
  noLabelsText: string;
  labelNamePlaceholder: string;
  saveLabel: string;
  maxLabels: number;
  limitMessage?: string;
  onUpgrade?: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const atLimit = labels.length >= maxLabels;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Refs (declared early so all callbacks can access them)
  const touchStartIdx = useRef<number | null>(null);
  const touchCurrentIdx = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // FLIP animation refs
  const prevRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const isAnimatingRef = useRef(false);

  const handleAdd = (label: LabelDefinition) => {
    onChange([...labels, label]);
  };

  const handleEdit = (id: string, name: string, color: string) => {
    onChange(labels.map((l) => l.id === id ? { ...l, name, color } : l));
  };

  const handleDelete = (id: string) => {
    onChange(labels.filter((l) => l.id !== id));
  };

  // ── FLIP: capture current bounding rects keyed by label id ──
  const capturePositions = useCallback((): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>();
    labels.forEach((l, i) => {
      const el = rowRefs.current[i];
      if (el) rects.set(l.id, el.getBoundingClientRect());
    });
    return rects;
  }, [labels]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    // FLIP: capture positions before React re-renders
    prevRectsRef.current = capturePositions();
    const reordered = [...labels];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    onChange(reordered);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, labels, onChange, capturePositions]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // --- Touch-based reorder ---
  const handleTouchStart = useCallback((idx: number) => {
    touchStartIdx.current = idx;
    setDragIdx(idx);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const rowEl = el.closest('[data-label-idx]') as HTMLElement | null;
    if (rowEl) {
      const idx = Number(rowEl.dataset.labelIdx);
      touchCurrentIdx.current = idx;
      setOverIdx(idx);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const from = touchStartIdx.current;
    const to = touchCurrentIdx.current;
    if (from !== null && to !== null && from !== to) {
      // FLIP: capture positions before React re-renders
      prevRectsRef.current = capturePositions();
      const reordered = [...labels];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      onChange(reordered);
    }
    touchStartIdx.current = null;
    touchCurrentIdx.current = null;
    setDragIdx(null);
    setOverIdx(null);
  }, [labels, onChange, capturePositions]);

  // ── FLIP animation: runs after React re-renders with new label order ──
  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    if (!prevRects) return;
    prevRectsRef.current = null;

    // If already animating, snap previous animation to end instantly
    if (isAnimatingRef.current) {
      labels.forEach((_, i) => {
        const el = rowRefs.current[i];
        if (el) { el.style.transition = ''; el.style.transform = ''; }
      });
    }

    isAnimatingRef.current = true;
    const animatingEls: HTMLDivElement[] = [];

    labels.forEach((l, i) => {
      const el = rowRefs.current[i];
      if (!el) return;
      const prevRect = prevRects.get(l.id);
      if (!prevRect) return;

      const newRect = el.getBoundingClientRect();
      const deltaY = prevRect.top - newRect.top;
      if (Math.abs(deltaY) < 1) return;

      // Invert: place element at its old visual position
      el.style.transition = '';
      el.style.transform = `translateY(${deltaY}px)`;
      animatingEls.push(el);
    });

    if (animatingEls.length === 0) { isAnimatingRef.current = false; return; }

    // Force reflow so the browser registers the transforms
    void document.body.offsetHeight;

    // Play: animate to final position
    const duration = 250;
    let done = 0;
    const onEnd = (e: TransitionEvent) => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transition = '';
      el.style.transform = '';
      el.removeEventListener('transitionend', onEnd);
      if (++done >= animatingEls.length) isAnimatingRef.current = false;
    };

    animatingEls.forEach((el) => {
      el.addEventListener('transitionend', onEnd);
      el.style.transition = `transform ${duration}ms cubic-bezier(0.25,0.1,0.25,1)`;
      el.style.transform = '';
    });

    // Safety cleanup
    const timer = setTimeout(() => {
      animatingEls.forEach((el) => {
        el.style.transition = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', onEnd);
      });
      isAnimatingRef.current = false;
    }, duration + 100);

    return () => clearTimeout(timer);
  }, [labels]);

  return (
    <div>
      {/* Add button at top */}
      {atLimit ? (
        <div className="mb-4">
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-neutral-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
          >
            <Lock size={14} />
            {addLabel}
          </button>
          {limitMessage && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{limitMessage}</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 mb-4 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors"
        >
          <Plus size={14} />
          {addLabel}
        </button>
      )}

      {/* Label list */}
      <div className="space-y-1">
        {labels.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">{noLabelsText}</p>
        )}
        {labels.map((l, i) => (
          <div
            key={l.id}
            data-label-idx={i}
            ref={(el) => { rowRefs.current[i] = el; }}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            onTouchStart={() => handleTouchStart(i)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`flex items-center gap-2 py-2 px-1 border-b border-gray-100 dark:border-neutral-700 transition-colors select-none ${
              dragIdx === i ? 'opacity-40' : ''
            } ${overIdx === i && dragIdx !== i ? 'bg-tiffany/10' : ''}`}
          >
            <span className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-500 flex-shrink-0 touch-none">
              <GripVertical size={14} />
            </span>
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: l.color }}
            />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">{l.name}</span>
            <LabelDotMenu
              label={l}
              onEdit={handleEdit}
              onDelete={handleDelete}
              renameLabel={renameLabel}
              deleteLabel={deleteLabel}
              cancelLabel={cancelLabel}
              labelNamePlaceholder={labelNamePlaceholder}
              saveLabel={saveLabel}
            />
          </div>
        ))}
      </div>

      {showAddModal && (
        <AddLabelModal
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
          addLabel={addLabel}
        />
      )}
    </div>
  );
}

// ---- Alarm Settings ----
function AlarmSettingsPanel({
  sound,
  repeat,
  onSoundChange,
  onRepeatChange,
  alarmLabel,
  repeatLabel,
  bellLabel,
  digitalLabel,
  chimeLabel,
  kitchenLabel,
  classicLabel,
  gentleLabel,
  softLabel,
  noneLabel,
}: {
  sound: AlarmSound;
  repeat: number;
  onSoundChange: (s: AlarmSound) => void;
  onRepeatChange: (n: number) => void;
  alarmLabel: string;
  repeatLabel: string;
  bellLabel: string;
  digitalLabel: string;
  chimeLabel: string;
  kitchenLabel: string;
  classicLabel: string;
  gentleLabel: string;
  softLabel: string;
  noneLabel: string;
}) {
  const sounds: { value: AlarmSound; label: string }[] = [
    { value: 'bell', label: bellLabel },
    { value: 'digital', label: digitalLabel },
    { value: 'chime', label: chimeLabel },
    { value: 'kitchen', label: kitchenLabel },
    { value: 'classic', label: classicLabel },
    { value: 'gentle', label: gentleLabel },
    { value: 'soft', label: softLabel },
    { value: 'none', label: noneLabel },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>{alarmLabel}</label>
        <div className="flex gap-2 items-center">
          <select
            value={sound}
            onChange={(e) => onSoundChange(e.target.value as AlarmSound)}
            className={selectClass}
          >
            {sounds.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {sound !== 'none' && (
            <button
              onClick={() => previewAlarm(sound, repeat)}
              className="p-2 rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 text-gray-600 dark:text-gray-400"
              title="Preview"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </div>

      {sound !== 'none' && (
        <div>
          <label className={labelClass}>{repeatLabel}</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => onRepeatChange(n)}
                className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                  repeat === n
                    ? 'border-tiffany bg-tiffany text-white'
                    : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// UTF-8 優先でデコード。不正バイト列があれば Shift-JIS にフォールバック
function readFileWithEncoding(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      try {
        // fatal: true → 不正な UTF-8 バイト列があれば例外を投げる
        resolve(new TextDecoder('utf-8', { fatal: true }).decode(buf));
      } catch {
        // UTF-8 でなければ Shift-JIS として読む
        resolve(new TextDecoder('shift-jis').decode(buf));
      }
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsArrayBuffer(file);
  });
}

export function SettingsPanel({ settings, onSave, onClose, onClearAll, onImportCsv, sessions, labels: externalLabels, onSaveLabels }: SettingsPanelProps) {
  const { t } = useI18n();
  const { user, deleteAccount } = useAuth();
  const features = useFeatures();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [workTime, setWorkTime] = useState(settings.workTime);
  const [breakTime, setBreakTime] = useState(settings.breakTime);
  const [longBreakTime, setLongBreakTime] = useState(settings.longBreakTime ?? 0);
  const [longBreakInterval, setLongBreakInterval] = useState(settings.longBreakInterval ?? 0);
  const [customMessage, setCustomMessage] = useState(settings.customMessage);
  const [language, setLanguage] = useState<Language>(settings.language);
  const [theme, setTheme] = useState<ThemeMode>(settings.theme ?? 'light');
  const [activePresets, setActivePresets] = useState(
    settings.activePresets ?? DEFAULT_ACTIVE_PRESETS,
  );
  const [restPresets, setRestPresets] = useState(
    settings.restPresets ?? DEFAULT_REST_PRESETS,
  );
  const [alarmSound, setAlarmSound] = useState<AlarmSound>(settings.alarm?.sound ?? 'bell');
  const [alarmRepeat, setAlarmRepeat] = useState(settings.alarm?.repeat ?? 1);
  const [labels, setLabels] = useState<LabelDefinition[]>(settings.labels ?? []);
  const [tab, setTab] = useState<SettingsTab>('general');

  // Data reset confirmation modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Account delete
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  // CSV import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<{ count: number; error?: string } | null>(null);

  // Immediately persist label changes
  const handleLabelsChange = (newLabels: LabelDefinition[]) => {
    setLabels(newLabels);
    if (onSaveLabels) {
      onSaveLabels(newLabels);
    }
  };

  const handleImportFile = async (file: File) => {
    setShowImportModal(false);
    setImportStatus(null);
    try {
      const text = await readFileWithEncoding(file);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setImportStatus({ count: 0, error: t.csvImportModalCancel }); return; }
      const dataLines = lines.slice(1);
      const currentLabels = [...externalLabels];
      const labelByName: Record<string, string> = {};
      currentLabels.forEach((l) => { labelByName[l.name] = l.id; });
      const newLabelsToCreate: LabelDefinition[] = [];
      const imported: PomodoroSession[] = [];
      for (const line of dataLines) {
        const cols = line.split(',');
        if (cols.length < 5) continue;
        const [date, time, labelName, note, durationMinutes] = cols;
        if (!date || !time) continue;
        const dateStr = `${date}T${time}:00`;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) continue;
        const mins = parseFloat(durationMinutes);
        if (isNaN(mins)) continue;
        let labelId: string | undefined;
        if (labelName) {
          if (labelByName[labelName]) {
            labelId = labelByName[labelName];
          } else {
            // Auto-create missing label
            const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const newLabel: LabelDefinition = { id: newId, name: labelName, color: LABEL_COLORS[(currentLabels.length + newLabelsToCreate.length) % LABEL_COLORS.length] };
            newLabelsToCreate.push(newLabel);
            labelByName[labelName] = newId;
            labelId = newId;
          }
        }
        imported.push({
          date: d.toISOString(),
          duration: Math.round(mins * 60),
          label: labelId,
          note: note || undefined,
        });
      }
      // Add auto-created labels
      if (newLabelsToCreate.length > 0) {
        const updatedLabels = [...currentLabels, ...newLabelsToCreate];
        setLabels(updatedLabels);
        if (onSaveLabels) {
          onSaveLabels(updatedLabels);
        }
      }
      await onImportCsv(imported);
      setImportStatus({ count: imported.length });
    } catch {
      setImportStatus({ count: 0, error: t.authErrorLoginFailed });
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteAccountConfirm(false);
    try {
      await deleteAccount();
    } catch {
      // ignore
    }
  };

  const handleExportCsv = () => {
    const header = 'date,time,label,note,duration_minutes';
    const rows = sessions.map((s) => {
      const d = new Date(s.date);
      const date = d.toISOString().slice(0, 10);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const labelDef = s.label ? externalLabels.find((l) => l.id === s.label) : null;
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

  const handleApply = () => {
    onSave({
      workTime,
      breakTime,
      longBreakTime,
      longBreakInterval,
      customMessage,
      language,
      activePresets,
      restPresets,
      theme,
      alarm: { sound: alarmSound, repeat: alarmRepeat },
      labels,
      activeLabel: settings.activeLabel,
    });
  };

  const tabClass = (active: boolean) =>
    `flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-tiffany text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
    }`;

  return (
    <div className="flex flex-col h-full relative">
      {/* Close button - fixed */}
      <button onClick={onClose} className="absolute top-0 right-0 z-10">
        <X size={18} className="text-gray-500 dark:text-gray-400" />
      </button>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Title */}
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 pr-6">{t.settings}</h3>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1 mb-3">
          <button className={tabClass(tab === 'general')} onClick={() => setTab('general')}>{t.settingsTabGeneral}</button>
          <button className={tabClass(tab === 'labels')} onClick={() => setTab('labels')}>{t.settingsTabLabels}</button>
          <button className={tabClass(tab === 'presets')} onClick={() => setTab('presets')}>{t.settingsTabPresets}</button>
        </div>
        {/* General tab */}
        {tab === 'general' && (
          <div className="space-y-4 p-1">
            <TimeSelector
              label={t.activeTimeLabel}
              value={workTime}
              presets={activePresets}
              onChange={setWorkTime}
              restOffLabel={t.restOffLabel}
              customLabel={t.customInput}
            />
            <TimeSelector
              label={t.restTimeLabel}
              value={breakTime}
              presets={restPresets}
              onChange={setBreakTime}
              isRest
              restOffLabel={t.restOffLabel}
              customLabel={t.customInput}
            />
            <TimeSelector
              label={t.longBreakTimeLabel}
              value={longBreakTime}
              presets={LONG_BREAK_OPTIONS}
              onChange={setLongBreakTime}
              isRest
              restOffLabel={t.restOffLabel}
              customLabel={t.customInput}
            />
            {longBreakTime > 0 && (
              <TimeSelector
                label={t.longBreakIntervalLabel}
                value={longBreakInterval}
                presets={LONG_BREAK_INTERVAL_OPTIONS}
                onChange={setLongBreakInterval}
                isRest
                restOffLabel={t.restOffLabel}
                customLabel={t.customInput}
              />
            )}
            <AlarmSettingsPanel
              sound={alarmSound}
              repeat={alarmRepeat}
              onSoundChange={setAlarmSound}
              onRepeatChange={setAlarmRepeat}
              alarmLabel={t.alarmLabel}
              repeatLabel={t.alarmRepeatLabel}
              bellLabel={t.alarmSoundBell}
              digitalLabel={t.alarmSoundDigital}
              chimeLabel={t.alarmSoundChime}
              kitchenLabel={t.alarmSoundKitchen}
              classicLabel={t.alarmSoundClassic}
              gentleLabel={t.alarmSoundGentle}
              softLabel={t.alarmSoundSoft}
              noneLabel={t.alarmSoundNone}
            />
            <ThemeToggle
              label={t.themeLabel}
              value={theme}
              onChange={setTheme}
              lightLabel={t.themeLight}
              grayLabel={t.themeGray}
              darkLabel={t.themeDark}
            />
            <div>
              <label className={labelClass}>{t.customMessageLabel}</label>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t.defaultCustomMessage}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t.languageLabel}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className={selectClass + ' w-full'}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {getTranslations(lang).languageName}
                  </option>
                ))}
              </select>
            </div>

            {/* CSV import */}
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                {t.csvImportTitle}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                {t.csvImportDescription}
              </p>
              <button
                onClick={() => { setImportStatus(null); setShowImportModal(true); }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <Upload size={14} />
                {t.csvImportButton}
              </button>
              {importStatus && (
                <p className={`mt-2 text-xs text-center ${importStatus.error ? 'text-red-500' : 'text-tiffany'}`}>
                  {importStatus.error ?? `${importStatus.count} ${t.sessions}`}
                </p>
              )}
            </div>

            {/* CSV export */}
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                {t.csvExportTitle}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                {t.csvExportDescription}
              </p>
              <button
                onClick={features.exportData ? handleExportCsv : () => setShowUpgrade(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                {features.exportData ? <Download size={14} /> : <Lock size={14} />}
                {t.exportCsv}
              </button>
            </div>

            {/* Data reset — at the bottom of General tab */}
            <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                {t.dataResetTitle}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                {t.dataResetDescription}
              </p>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t.dataResetButton}
              </button>
            </div>

            {/* Account deletion (only for logged-in users) */}
            {user && (
              <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
                <button
                  onClick={() => setShowDeleteAccountConfirm(true)}
                  className="w-full py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t.authDeleteAccount}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Labels tab */}
        {tab === 'labels' && (
          <div className="p-1">
            <LabelManager
              labels={labels}
              onChange={handleLabelsChange}
              addLabel={t.addLabel}
              renameLabel={t.labelRename}
              deleteLabel={t.labelDelete}
              cancelLabel={t.dataResetCancel}
              noLabelsText={t.noLabel}
              labelNamePlaceholder={t.labelNamePlaceholder}
              saveLabel="OK"
              maxLabels={features.maxLabels}
              limitMessage={!features.unlimitedLabels ? t.freeLabelLimit : undefined}
              onUpgrade={() => setShowUpgrade(true)}
            />
          </div>
        )}

        {/* Presets tab */}
        {tab === 'presets' && (
          <div className="space-y-5 p-1">
            <PresetEditor
              label={t.activePresetsLabel}
              presets={activePresets}
              onChange={setActivePresets}
              restOffLabel={t.restOffLabel}
              addLabel={t.addPreset}
            />
            <PresetEditor
              label={t.restPresetsLabel}
              presets={restPresets}
              onChange={setRestPresets}
              isRest
              restOffLabel={t.restOffLabel}
              addLabel={t.addPreset}
            />
          </div>
        )}
      </div>

      {/* Apply button */}
      <div className="flex-shrink-0 pt-4">
        <button
          onClick={handleApply}
          className="w-full py-2 rounded-lg text-white font-medium bg-tiffany hover:bg-tiffany-hover transition-colors"
        >
          {t.applySettings}
        </button>
      </div>

      {/* Data reset confirm modal */}
      {showResetConfirm && (
        <ConfirmModal
          message={t.dataResetConfirm1}
          confirmLabel={t.dataResetConfirm2}
          confirmClass="bg-red-500 hover:bg-red-600"
          cancelLabel={t.dataResetCancel}
          onConfirm={() => { setShowResetConfirm(false); onClearAll(); }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {/* Account delete confirm modal */}
      {showDeleteAccountConfirm && (
        <ConfirmModal
          message={t.authDeleteAccountConfirm}
          confirmLabel={t.authDeleteAccount}
          confirmClass="bg-red-500 hover:bg-red-600"
          cancelLabel={t.dataResetCancel}
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteAccountConfirm(false)}
        />
      )}

      {/* CSV import modal */}
      {showImportModal && (
        <CsvImportModal
          onImport={handleImportFile}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Upgrade prompt modal */}
      {showUpgrade && <UpgradePrompt onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
