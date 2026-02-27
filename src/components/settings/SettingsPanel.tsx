import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { X, Plus, Trash2, Sun, Moon, Play, MoreVertical, Pencil, GripVertical, Upload, Download, Lock } from 'lucide-react';
import type { PomodoroSettings, ThemeMode, AlarmSound, VibrationMode } from '@/types/settings';
import { DEFAULT_ACTIVE_PRESETS, DEFAULT_REST_PRESETS } from '@/types/settings';
import type { LabelDefinition, PomodoroSession } from '@/types/session';
import { LABEL_COLORS } from '@/config/colors';
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
  onSaveCustomColors?: (customColors: string[], labels?: LabelDefinition[]) => void;
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


function TimeSelector({
  label,
  value,
  presets,
  onChange,
  isRest,
  restOffLabel,
  customLabel,
  unit,
}: {
  label: string;
  value: number;
  presets: number[];
  onChange: (v: number) => void;
  isRest?: boolean;
  restOffLabel: string;
  customLabel: string;
  unit?: string;
}) {
  const [isCustom, setIsCustom] = useState(!presets.includes(value));
  const [customValue, setCustomValue] = useState(String(value));

  const formatOption = (v: number) => {
    if (isRest && v === 0) return restOffLabel;
    return unit ? `${v}${unit}` : `${v}`;
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

// ---- Custom Color Picker Modal (touch-friendly, replaces native <input type="color">) ----
import { hsvToHex, hexToHsv, isValidHex, normalizeHex, hueToHex } from '@/utils/color';

function CustomColorPickerModal({
  initialColor,
  onConfirm,
  onCancel,
}: {
  initialColor: string;
  onConfirm: (color: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const initial = hexToHsv(initialColor);
  const [hue, setHue] = useState(initial.h);
  const [sat, setSat] = useState(initial.s);
  const [val, setVal] = useState(initial.v);
  const [hexInput, setHexInput] = useState(initialColor.toLowerCase());

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [draggingSV, setDraggingSV] = useState(false);
  const [draggingHue, setDraggingHue] = useState(false);

  const currentHex = hsvToHex(hue, sat, val);

  // Sync hex input when HSV changes (but not when user is typing)
  const hexInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== hexInputRef.current) {
      setHexInput(currentHex);
    }
  }, [currentHex]);

  // ---- SV panel pointer handling ----
  const updateSV = useCallback((clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    setSat(x / rect.width);
    setVal(1 - y / rect.height);
  }, []);

  const onSVPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingSV(true);
    updateSV(e.clientX, e.clientY);
  }, [updateSV]);

  const onSVPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingSV) return;
    updateSV(e.clientX, e.clientY);
  }, [draggingSV, updateSV]);

  const onSVPointerUp = useCallback(() => {
    setDraggingSV(false);
  }, []);

  // ---- Hue slider pointer handling ----
  const updateHue = useCallback((clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setHue((x / rect.width) * 360);
  }, []);

  const onHuePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingHue(true);
    updateHue(e.clientX);
  }, [updateHue]);

  const onHuePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingHue) return;
    updateHue(e.clientX);
  }, [draggingHue, updateHue]);

  const onHuePointerUp = useCallback(() => {
    setDraggingHue(false);
  }, []);

  // ---- HEX input handling ----
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    const normalized = v.startsWith('#') ? v : `#${v}`;
    if (isValidHex(normalized)) {
      const full = normalizeHex(normalized);
      const hsv = hexToHsv(full);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-4 w-72 mx-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t.colorPickerTitle}
          </span>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* SV panel */}
        <div
          ref={svRef}
          className="relative w-full h-40 rounded-lg cursor-crosshair select-none"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueToHex(hue)})`,
            touchAction: 'none',
          }}
          onPointerDown={onSVPointerDown}
          onPointerMove={onSVPointerMove}
          onPointerUp={onSVPointerUp}
        >
          {/* Cursor */}
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{
              left: `${sat * 100}%`,
              top: `${(1 - val) * 100}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: currentHex,
            }}
          />
        </div>

        {/* Hue slider */}
        <div
          ref={hueRef}
          className="relative w-full h-4 rounded-full cursor-pointer select-none"
          style={{
            background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
            touchAction: 'none',
          }}
          onPointerDown={onHuePointerDown}
          onPointerMove={onHuePointerMove}
          onPointerUp={onHuePointerUp}
        >
          {/* Hue thumb */}
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none top-0"
            style={{
              left: `${(hue / 360) * 100}%`,
              transform: 'translateX(-50%)',
              backgroundColor: hueToHex(hue),
            }}
          />
        </div>

        {/* HEX input + preview */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full border border-gray-300 dark:border-neutral-600 flex-shrink-0"
            style={{ backgroundColor: currentHex }}
          />
          <input
            ref={hexInputRef}
            type="text"
            value={hexInput}
            onChange={handleHexChange}
            maxLength={7}
            className="flex-1 px-2 py-1 text-sm font-mono border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-tiffany"
            placeholder="#000000"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-neutral-500 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
          >
            {t.colorPickerCancel}
          </button>
          <button
            onClick={() => onConfirm(currentHex)}
            className="flex-1 py-1.5 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg transition-colors"
          >
            {t.colorPickerConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Color Picker with custom color registration ----
const MAX_CUSTOM_COLORS = 20;

export function ColorPicker({
  value,
  onChange,
  customColors,
  onRegisterColor,
  onChangeCustomColor,
  onDeleteCustomColor,
}: {
  value: string;
  onChange: (c: string) => void;
  customColors?: string[];
  onRegisterColor?: (color: string) => void;
  onChangeCustomColor?: (oldColor: string, newColor: string) => void;
  onDeleteCustomColor?: (color: string) => void;
}) {
  const { t } = useI18n();
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'add' | 'change'>('add');

  const cc = customColors ?? [];
  const isCustomSelected = cc.includes(value);

  const dotClass = (c: string) =>
    `w-5 h-5 rounded-full transition-transform flex-shrink-0 ${
      value === c
        ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-300 scale-110'
        : 'hover:scale-105'
    }`;

  const handlePresetClick = (c: string) => {
    setPendingColor(null);
    onChange(c);
  };

  // Open custom color picker for adding new color
  const handleOpenAddPicker = () => {
    setPickerMode('add');
    setPickerOpen(true);
  };

  // Open custom color picker for changing existing custom color
  const handleOpenChangePicker = () => {
    setPickerMode('change');
    setPickerOpen(true);
  };

  // Handle color picker confirm
  const handlePickerConfirm = (color: string) => {
    setPickerOpen(false);
    if (pickerMode === 'add') {
      setPendingColor(color);
    } else {
      // change mode
      onChangeCustomColor?.(value, color);
      onChange(color);
    }
  };

  const handleRegister = () => {
    if (!pendingColor) return;
    const normalized = pendingColor.toLowerCase();
    // Skip if already exists in presets or custom colors
    if (LABEL_COLORS.map(c => c.toLowerCase()).includes(normalized)) {
      onChange(pendingColor);
      setPendingColor(null);
      return;
    }
    if (cc.map(c => c.toLowerCase()).includes(normalized)) {
      onChange(pendingColor);
      setPendingColor(null);
      return;
    }
    onRegisterColor?.(pendingColor);
    onChange(pendingColor);
    setPendingColor(null);
  };

  const handleDelete = () => {
    onDeleteCustomColor?.(value);
    onChange(LABEL_COLORS[0]);
  };

  return (
    <div className="mt-2">
      {/* Preset colors */}
      <div className="flex flex-wrap gap-1.5">
        {LABEL_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => handlePresetClick(c)}
            className={dotClass(c)}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Custom colors section */}
      {(cc.length > 0 || onRegisterColor) && (
        <div className="border-t border-gray-200 dark:border-neutral-600 mt-2 pt-2">
          {/* Registered custom color dots */}
          {cc.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {cc.map((c) => (
                <button
                  key={c}
                  onClick={() => handlePresetClick(c)}
                  className={dotClass(c)}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          {/* Add custom color row */}
          {onRegisterColor && cc.length < MAX_CUSTOM_COLORS && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOpenAddPicker}
                className="w-5 h-5 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-500 flex items-center justify-center hover:border-tiffany transition-colors flex-shrink-0"
              >
                <Plus size={10} className="text-gray-400" />
              </button>
              {pendingColor && (
                <>
                  <div
                    className="w-5 h-5 rounded-full ring-2 ring-offset-1 ring-tiffany flex-shrink-0"
                    style={{ backgroundColor: pendingColor }}
                  />
                  <button
                    onClick={handleRegister}
                    className="px-2 py-0.5 text-xs text-white bg-tiffany hover:bg-tiffany-hover rounded transition-colors"
                  >
                    {t.customColorRegister}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Actions for selected custom color */}
          {isCustomSelected && onChangeCustomColor && onDeleteCustomColor && (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={handleOpenChangePicker}
                className="px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-neutral-500 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
              >
                {t.labelChangeColor}
              </button>
              <button
                onClick={handleDelete}
                className="px-2 py-0.5 text-xs text-red-500 border border-red-300 dark:border-red-500/40 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t.customColorDelete}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Custom color picker modal */}
      {pickerOpen && (
        <CustomColorPickerModal
          initialColor={pickerMode === 'change' ? value : (pendingColor ?? '#0abab5')}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ---- Add Label Modal ----
const DURATION_PRESETS = [5, 10, 15, 20, 30];

function AddLabelModal({
  onAdd,
  onClose,
  addLabel,
  customColors,
  onRegisterColor,
  onChangeCustomColor,
  onDeleteCustomColor,
}: {
  onAdd: (label: LabelDefinition) => void;
  onClose: () => void;
  addLabel: string;
  customColors?: string[];
  onRegisterColor?: (color: string) => void;
  onChangeCustomColor?: (oldColor: string, newColor: string) => void;
  onDeleteCustomColor?: (color: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[19]); // tiffany default
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDurationStr, setCustomDurationStr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const unit = t.minuteUnit;

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ id: Date.now().toString(36), name: trimmed, color, duration });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') onClose();
  };

  const handleDurationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setIsCustomDuration(false);
      setDuration(undefined);
    } else if (val === '__custom__') {
      setIsCustomDuration(true);
      setCustomDurationStr(duration !== undefined ? String(duration) : '');
    } else {
      setIsCustomDuration(false);
      setDuration(Number(val));
    }
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
          placeholder={t.labelNamePlaceholder}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 dark:placeholder-gray-400 mb-3"
        />
        <ColorPicker
          value={color}
          onChange={setColor}
          customColors={customColors}
          onRegisterColor={onRegisterColor}
          onChangeCustomColor={onChangeCustomColor}
          onDeleteCustomColor={onDeleteCustomColor}
        />
        {/* Duration selector with custom input */}
        <div className="mt-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.labelDuration}</label>
          <div className="flex gap-2">
            <select
              value={isCustomDuration ? '__custom__' : (duration ?? '')}
              onChange={handleDurationSelect}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200 bg-white"
            >
              <option value="">{t.labelDurationNone}</option>
              {DURATION_PRESETS.map((m) => (
                <option key={m} value={m}>{m}{unit}</option>
              ))}
              <option value="__custom__">{t.customInput}</option>
            </select>
            {isCustomDuration && (
              <input
                autoFocus
                type="number"
                value={customDurationStr}
                onChange={(e) => {
                  setCustomDurationStr(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed > 0) setDuration(parsed);
                }}
                onBlur={() => {
                  const parsed = parseInt(customDurationStr, 10);
                  if (isNaN(parsed) || parsed <= 0) {
                    setIsCustomDuration(false);
                    setDuration(undefined);
                  }
                }}
                min={1}
                placeholder={unit}
                className="w-20 px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany dark:bg-neutral-700 dark:text-gray-200"
              />
            )}
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="mt-4 w-full py-2 text-sm text-white bg-tiffany hover:bg-tiffany-hover rounded-lg disabled:opacity-40 transition-colors"
        >
          {t.addPreset}
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
  customColors,
  onRegisterColor,
  onChangeCustomColor,
  onDeleteCustomColor,
}: {
  label: LabelDefinition;
  onEdit: (id: string, name: string, color: string, duration?: number) => void;
  onDelete: (id: string) => void;
  renameLabel: string;
  deleteLabel: string;
  cancelLabel: string;
  labelNamePlaceholder: string;
  saveLabel: string;
  customColors?: string[];
  onRegisterColor?: (color: string) => void;
  onChangeCustomColor?: (oldColor: string, newColor: string) => void;
  onDeleteCustomColor?: (color: string) => void;
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
          onAdd={(edited) => { onEdit(edited.id, edited.name, edited.color, edited.duration); setShowEditModal(false); }}
          onClose={() => setShowEditModal(false)}
          addNewLabel=""
          labelNamePlaceholder={labelNamePlaceholder}
          addButtonText=""
          initialName={label.name}
          initialColor={label.color}
          initialDuration={label.duration}
          editId={label.id}
          title={renameLabel}
          buttonText={saveLabel}
          customColors={customColors}
          onRegisterColor={onRegisterColor}
          onChangeCustomColor={onChangeCustomColor}
          onDeleteCustomColor={onDeleteCustomColor}
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
  customColors,
  onRegisterColor,
  onChangeCustomColor,
  onDeleteCustomColor,
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
  customColors?: string[];
  onRegisterColor?: (color: string) => void;
  onChangeCustomColor?: (oldColor: string, newColor: string) => void;
  onDeleteCustomColor?: (color: string) => void;
}) {
  const { t } = useI18n();
  const [showAddModal, setShowAddModal] = useState(false);
  const atLimit = labels.length >= maxLabels;

  // --- Live reorder state ---
  // ドラッグ中は liveLabels で並び順を即座に反映し、
  // ドロップ時に onChange で外部へ確定通知する。
  const [liveLabels, setLiveLabels] = useState<LabelDefinition[]>(labels);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const liveLabelsRef = useRef(liveLabels);
  liveLabelsRef.current = liveLabels;

  // Sync with external labels when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) setLiveLabels(labels);
  }, [labels]);

  // Refs
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // FLIP animation refs
  const prevRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const isAnimatingRef = useRef(false);

  // CRUD handlers (operate on original labels)
  const handleAdd = (label: LabelDefinition) => {
    onChange([...labels, label]);
  };

  const handleEdit = (id: string, name: string, color: string, duration?: number) => {
    onChange(labels.map((l) => l.id === id ? { ...l, name, color, duration } : l));
  };

  const handleDelete = (id: string) => {
    onChange(labels.filter((l) => l.id !== id));
  };

  // ── FLIP: capture current bounding rects keyed by label id ──
  const capturePositions = useCallback((): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>();
    liveLabelsRef.current.forEach((l, i) => {
      const el = rowRefs.current[i];
      if (el) rects.set(l.id, el.getBoundingClientRect());
    });
    return rects;
  }, []);

  // ── Reorder helper: move item from currentIdx to targetIdx ──
  const reorderLive = useCallback((currentIdx: number, targetIdx: number) => {
    prevRectsRef.current = capturePositions();
    const reordered = [...liveLabelsRef.current];
    const [moved] = reordered.splice(currentIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    liveLabelsRef.current = reordered;
    setLiveLabels(reordered);
  }, [capturePositions]);

  // --- Mouse drag handlers ---
  const handleDragStart = useCallback((idx: number) => {
    isDraggingRef.current = true;
    setDragItemId(liveLabelsRef.current[idx]?.id ?? null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (!dragItemId) return;
    const currentIdx = liveLabelsRef.current.findIndex(l => l.id === dragItemId);
    if (currentIdx === -1 || currentIdx === targetIdx) return;
    reorderLive(currentIdx, targetIdx);
  }, [dragItemId, reorderLive]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    if (isDraggingRef.current) {
      onChange(liveLabelsRef.current);
    }
    isDraggingRef.current = false;
    setDragItemId(null);
  }, [onChange]);

  // --- Touch-based reorder ---
  const handleTouchStart = useCallback((idx: number) => {
    isDraggingRef.current = true;
    setDragItemId(liveLabelsRef.current[idx]?.id ?? null);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragItemId) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const rowEl = el.closest('[data-label-idx]') as HTMLElement | null;
    if (!rowEl) return;
    const targetIdx = Number(rowEl.dataset.labelIdx);
    const currentIdx = liveLabelsRef.current.findIndex(l => l.id === dragItemId);
    if (currentIdx === -1 || currentIdx === targetIdx) return;
    reorderLive(currentIdx, targetIdx);
  }, [dragItemId, reorderLive]);

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      onChange(liveLabelsRef.current);
    }
    isDraggingRef.current = false;
    setDragItemId(null);
  }, [onChange]);

  // ── FLIP animation: runs after React re-renders with new label order ──
  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    if (!prevRects) return;
    prevRectsRef.current = null;

    // If already animating, snap previous animation to end instantly
    if (isAnimatingRef.current) {
      liveLabels.forEach((_, i) => {
        const el = rowRefs.current[i];
        if (el) { el.style.transition = ''; el.style.transform = ''; }
      });
    }

    isAnimatingRef.current = true;
    const animatingEls: HTMLDivElement[] = [];

    liveLabels.forEach((l, i) => {
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
    const duration = 200;
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
  }, [liveLabels]);

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
        {liveLabels.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">{noLabelsText}</p>
        )}
        {liveLabels.map((l, i) => (
          <div
            key={l.id}
            data-label-idx={i}
            ref={(el) => { rowRefs.current[i] = el; }}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onTouchStart={() => handleTouchStart(i)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`flex items-center gap-2 py-2 px-1 border-b border-gray-100 dark:border-neutral-700 transition-colors select-none ${
              dragItemId === l.id ? 'opacity-40' : ''
            }`}
          >
            <span className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-500 flex-shrink-0 touch-none">
              <GripVertical size={14} />
            </span>
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: l.color }}
            />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">
              {l.name}
              {l.duration != null && (
                <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{l.duration}{t.minuteUnit}</span>
              )}
            </span>
            <LabelDotMenu
              label={l}
              onEdit={handleEdit}
              onDelete={handleDelete}
              renameLabel={renameLabel}
              deleteLabel={deleteLabel}
              cancelLabel={cancelLabel}
              labelNamePlaceholder={labelNamePlaceholder}
              saveLabel={saveLabel}
              customColors={customColors}
              onRegisterColor={onRegisterColor}
              onChangeCustomColor={onChangeCustomColor}
              onDeleteCustomColor={onDeleteCustomColor}
            />
          </div>
        ))}
      </div>

      {showAddModal && (
        <AddLabelModal
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
          addLabel={addLabel}
          customColors={customColors}
          onRegisterColor={onRegisterColor}
          onChangeCustomColor={onChangeCustomColor}
          onDeleteCustomColor={onDeleteCustomColor}
        />
      )}
    </div>
  );
}

// ---- Alarm Settings ----
function AlarmSettingsPanel({
  sound,
  repeat,
  volume,
  vibration,
  onSoundChange,
  onRepeatChange,
  onVolumeChange,
  onVibrationChange,
  alarmLabel,
  repeatLabel,
  volumeLabel,
  vibrationLabel,
  vibrationOffLabel,
  vibrationSilentLabel,
  vibrationAlwaysLabel,
  vibrationNote,
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
  volume: number;
  vibration: VibrationMode;
  onSoundChange: (s: AlarmSound) => void;
  onRepeatChange: (n: number) => void;
  onVolumeChange: (v: number) => void;
  onVibrationChange: (v: VibrationMode) => void;
  alarmLabel: string;
  repeatLabel: string;
  volumeLabel: string;
  vibrationLabel: string;
  vibrationOffLabel: string;
  vibrationSilentLabel: string;
  vibrationAlwaysLabel: string;
  vibrationNote: string;
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
              onClick={() => previewAlarm(sound, repeat, volume, vibration)}
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
          <label className={labelClass}>{volumeLabel}</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-tiffany bg-gray-200 dark:bg-neutral-600"
            />
            <span className="w-10 text-right text-sm text-gray-600 dark:text-gray-400">{volume}%</span>
          </div>
        </div>
      )}

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

      <div>
        <label className={labelClass}>{vibrationLabel}</label>
        <div className="flex gap-1.5">
          {([
            { value: 'off' as VibrationMode, label: vibrationOffLabel },
            { value: 'silent' as VibrationMode, label: vibrationSilentLabel },
            { value: 'always' as VibrationMode, label: vibrationAlwaysLabel },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onVibrationChange(opt.value)}
              className={`px-3 h-9 rounded-lg border text-sm font-medium transition-colors ${
                vibration === opt.value
                  ? 'border-tiffany bg-tiffany text-white'
                  : 'border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{vibrationNote}</p>
      </div>
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

export function SettingsPanel({ settings, onSave, onClose, onClearAll, onImportCsv, sessions, labels: externalLabels, onSaveLabels, onSaveCustomColors }: SettingsPanelProps) {
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
  const [alarmVolume, setAlarmVolume] = useState(settings.alarm?.volume ?? 80);
  const [alarmVibration, setAlarmVibration] = useState<VibrationMode>(settings.alarm?.vibration ?? 'silent');
  const [labels, setLabels] = useState<LabelDefinition[]>(settings.labels ?? []);
  const [customColors, setCustomColors] = useState<string[]>(settings.customColors ?? []);
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

  // Custom color handlers — persist immediately without closing settings
  const persistCustomColors = (updated: string[], updatedLabels?: LabelDefinition[]) => {
    setCustomColors(updated);
    const newLabels = updatedLabels ?? labels;
    if (updatedLabels) setLabels(newLabels);
    if (onSaveCustomColors) {
      onSaveCustomColors(updated, updatedLabels);
    }
  };

  const handleRegisterCustomColor = (color: string) => {
    persistCustomColors([...customColors, color]);
  };

  const handleChangeCustomColor = (oldColor: string, newColor: string) => {
    const updatedColors = customColors.map((c) => c === oldColor ? newColor : c);
    const updatedLabels = labels.map((l) => l.color === oldColor ? { ...l, color: newColor } : l);
    persistCustomColors(updatedColors, updatedLabels);
  };

  const handleDeleteCustomColor = (color: string) => {
    persistCustomColors(customColors.filter((c) => c !== color));
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
      alarm: { sound: alarmSound, repeat: alarmRepeat, volume: alarmVolume, vibration: alarmVibration },
      labels,
      activeLabel: settings.activeLabel,
      customColors,
    });
  };

  const tabClass = (active: boolean) =>
    `flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-tiffany text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
    }`;

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
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
            {/* 1セットの設定 */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.settingsSessionGroup}</p>
              <TimeSelector
                label={t.activeTimeLabel}
                value={workTime}
                presets={activePresets}
                onChange={setWorkTime}
                restOffLabel={t.restOffLabel}
                customLabel={t.customInput}
                unit={t.minuteUnit}
              />
              <TimeSelector
                label={t.restTimeLabel}
                value={breakTime}
                presets={restPresets}
                onChange={setBreakTime}
                isRest
                restOffLabel={t.restOffLabel}
                customLabel={t.customInput}
                unit={t.minuteUnit}
              />
            </div>
            {/* 長い休憩の設定 */}
            <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-neutral-700">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.settingsLongBreakGroup}</p>
              <TimeSelector
                label={t.longBreakTimeLabel}
                value={longBreakTime}
                presets={LONG_BREAK_OPTIONS}
                onChange={setLongBreakTime}
                isRest
                restOffLabel={t.restOffLabel}
                customLabel={t.customInput}
                unit={t.minuteUnit}
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
                  unit={t.sessionUnit}
                />
              )}
            </div>
            {/* Alarm separator */}
            <div className="border-t border-gray-200 dark:border-neutral-700" />
            <AlarmSettingsPanel
              sound={alarmSound}
              repeat={alarmRepeat}
              volume={alarmVolume}
              vibration={alarmVibration}
              onSoundChange={setAlarmSound}
              onRepeatChange={setAlarmRepeat}
              onVolumeChange={setAlarmVolume}
              onVibrationChange={setAlarmVibration}
              alarmLabel={t.alarmLabel}
              repeatLabel={t.alarmRepeatLabel}
              volumeLabel={t.alarmVolumeLabel}
              vibrationLabel={t.alarmVibrationLabel}
              vibrationOffLabel={t.alarmVibrationOff}
              vibrationSilentLabel={t.alarmVibrationSilent}
              vibrationAlwaysLabel={t.alarmVibrationAlways}
              vibrationNote={t.alarmVibrationNote}
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
                onClick={features.exportData ? () => { setImportStatus(null); setShowImportModal(true); } : () => setShowUpgrade(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
              >
                {features.exportData ? <Upload size={14} /> : <Lock size={14} />}
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
              customColors={customColors}
              onRegisterColor={handleRegisterCustomColor}
              onChangeCustomColor={handleChangeCustomColor}
              onDeleteCustomColor={handleDeleteCustomColor}
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
