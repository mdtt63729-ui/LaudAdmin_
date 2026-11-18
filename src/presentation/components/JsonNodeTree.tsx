import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Edit3,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Loader2,
} from 'lucide-react';
import { convertJsonType, defaultForType, deepCloneJson, detectJsonType } from '../../core/jsonEngine';
import { M3_CHIP_SPRING, M3_SHEET_SPRING, getSpring } from '../../core/motionPresets';
import type { JsonValueType } from '../../domain/types';
import type { Translations } from '../../core/i18n';

const ALL_TYPES: JsonValueType[] = ['string', 'number', 'boolean', 'object', 'array', 'null'];

interface JsonNodeTreeProps {
  t: Translations;
  value: unknown;
  pathSegments: (string | number)[];
  label: string;
  isRoot?: boolean;
  readOnly: boolean;
  reducedMotion?: boolean;
  onChangeValue: (newVal: unknown, coalesceRapidTyping?: boolean) => void;
  onUploadLogo?: (file: File, applyUrl: (url: string) => void) => Promise<void>;
  onRequestDeleteSelf?: () => void;
  onRequestRenameSelf?: () => void;
  onRequestDuplicateSelf?: () => void;
}

const LogoPreviewField: React.FC<{
  url: string;
  readOnly: boolean;
  onChangeUrl: (next: string) => void;
  onUploadLogo?: (file: File, applyUrl: (url: string) => void) => Promise<void>;
}> = ({ url, readOnly, onChangeUrl, onUploadLogo }) => {
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadLogo) return;
    setUploading(true);
    try {
      await onUploadLogo(file, (uploadedUrl) => {
        setImgError(false);
        onChangeUrl(uploadedUrl);
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
      <div
        className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden shrink-0"
        style={{
          backgroundColor: 'var(--m3-surface-container)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        {url && !imgError ? (
          <img
            src={url}
            alt="Configuration logo preview"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-5 h-5 opacity-50" />
        )}
      </div>
      <input
        type="url"
        value={url}
        readOnly={readOnly}
        onChange={(e) => {
          setImgError(false);
          onChangeUrl(e.target.value);
        }}
        placeholder="https://example.com/logo.png"
        className="flex-1 h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none"
        style={{
          backgroundColor: 'var(--m3-surface)',
          borderColor: 'var(--m3-outline)',
          color: 'var(--m3-on-surface)',
        }}
      />
      {!readOnly && onUploadLogo && (
        <label
          className="h-11 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90"
          style={{
            backgroundColor: 'var(--m3-secondary-container)',
            borderColor: 'var(--m3-outline-variant)',
            color: 'var(--m3-on-secondary-container)',
          }}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>{uploading ? 'Uploading...' : 'Upload'}</span>
          <input type="file" accept="image/*" onChange={handleFile} className="sr-only" disabled={uploading} />
        </label>
      )}
    </div>
  );
};

export const JsonNodeTree: React.FC<JsonNodeTreeProps> = ({
  t,
  value,
  pathSegments,
  label,
  isRoot = false,
  readOnly,
  reducedMotion = false,
  onChangeValue,
  onUploadLogo,
  onRequestDeleteSelf,
  onRequestRenameSelf,
  onRequestDuplicateSelf,
}) => {
  const nodeType = detectJsonType(value);
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const [addingProp, setAddingProp] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropType, setNewPropType] = useState<JsonValueType>('string');
  const [addPropError, setAddPropError] = useState<string | null>(null);

  const [addingItem, setAddingItem] = useState(false);
  const [newItemType, setNewItemType] = useState<JsonValueType>('string');

  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<
    { kind: 'key'; key: string } | { kind: 'index'; index: number } | null
  >(null);

  const [numDraft, setNumDraft] = useState<string | null>(null);

  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);
  const sheetSpring = getSpring(reducedMotion, M3_SHEET_SPRING);

  const isLogoField =
    nodeType === 'string' &&
    /^(logoUrl|iconUrl|appLogo|logo|icon)$/i.test(label);

  // --- OBJECT RENDERER ---
  if (nodeType === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);

    const handleAddProperty = (e: React.FormEvent) => {
      e.preventDefault();
      const k = newPropKey.trim();
      if (!k) {
        setAddPropError('Property name is required.');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        setAddPropError(`"${k}" already exists.`);
        return;
      }
      const next = { ...obj, [k]: defaultForType(newPropType) };
      onChangeValue(next, false);
      setNewPropKey('');
      setAddPropError(null);
      setAddingProp(false);
    };

    const handleConfirmRename = (e: React.FormEvent) => {
      e.preventDefault();
      if (!renamingKey) return;
      const nextKey = renameDraft.trim();
      if (!nextKey) {
        setRenameError('Property name cannot be empty.');
        return;
      }
      if (nextKey !== renamingKey && Object.prototype.hasOwnProperty.call(obj, nextKey)) {
        setRenameError(`"${nextKey}" already exists.`);
        return;
      }
      if (nextKey === renamingKey) {
        setRenamingKey(null);
        return;
      }
      const rebuilt: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        if (k === renamingKey) {
          rebuilt[nextKey] = v;
        } else {
          rebuilt[k] = v;
        }
      }
      onChangeValue(rebuilt, false);
      setRenamingKey(null);
      setRenameError(null);
    };

    const handleDuplicateKey = (key: string) => {
      let candidate = `${key}_copy`;
      let counter = 2;
      while (Object.prototype.hasOwnProperty.call(obj, candidate)) {
        candidate = `${key}_copy_${counter++}`;
      }
      const rebuilt: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        rebuilt[k] = v;
        if (k === key) {
          rebuilt[candidate] = deepCloneJson(v);
        }
      }
      onChangeValue(rebuilt, false);
    };

    const handleDeleteKey = (key: string) => {
      const rebuilt: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        if (k !== key) rebuilt[k] = v;
      }
      onChangeValue(rebuilt, false);
      setDeletingTarget(null);
    };

    return (
      <div
        className="rounded-2xl border transition-colors"
        style={{
          backgroundColor: isRoot ? 'var(--m3-surface-container-low)' : 'var(--m3-surface)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer min-h-[36px]"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--m3-on-surface-variant)' }} />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--m3-on-surface-variant)' }} />
            )}
            <span className="font-display text-sm font-semibold truncate">{label}</span>
            <span
              className="text-xs tabular-nums shrink-0"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              · {entries.length} {entries.length === 1 ? 'property' : 'properties'}
            </span>
          </button>

          {!readOnly && !isRoot && (
            <NodeOverflowMenu
              t={t}
              open={menuOpen}
              currentType="object"
              reducedMotion={reducedMotion}
              onToggle={() => setMenuOpen((o) => !o)}
              onClose={() => setMenuOpen(false)}
              onRename={onRequestRenameSelf}
              onDuplicate={onRequestDuplicateSelf}
              onConvertType={(nextType) => onChangeValue(convertJsonType(value, nextType), false)}
              onDelete={onRequestDeleteSelf}
            />
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={chipSpring}
              className="px-4 pb-4 pt-2 space-y-3 border-t"
              style={{ borderColor: 'var(--m3-outline-variant)' }}
            >
              {entries.length === 0 ? (
                <p className="text-xs py-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Empty object — add a property below.
                </p>
              ) : (
                entries.map(([key, childVal]) => (
                  <div key={key}>
                    {renamingKey === key ? (
                      <form
                        onSubmit={handleConfirmRename}
                        className="p-3 rounded-xl border flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                        style={{
                          backgroundColor: 'var(--m3-surface-container)',
                          borderColor: 'var(--m3-primary)',
                        }}
                      >
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          autoFocus
                          className="flex-1 h-9 px-3 rounded-lg border text-xs font-mono focus:outline-none"
                          style={{
                            backgroundColor: 'var(--m3-surface)',
                            borderColor: renameError ? '#DC2626' : 'var(--m3-outline)',
                            color: 'var(--m3-on-surface)',
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer"
                            style={{ backgroundColor: 'var(--m3-primary)', color: 'var(--m3-on-primary)' }}
                          >
                            Save Key
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingKey(null);
                              setRenameError(null);
                            }}
                            className="h-9 px-3 rounded-lg border text-xs cursor-pointer"
                            style={{ borderColor: 'var(--m3-outline)' }}
                          >
                            {t.cancel}
                          </button>
                        </div>
                        {renameError && <span className="text-xs text-red-500">{renameError}</span>}
                      </form>
                    ) : (
                      <JsonNodeTree
                        t={t}
                        value={childVal}
                        pathSegments={[...pathSegments, key]}
                        label={key}
                        readOnly={readOnly}
                        reducedMotion={reducedMotion}
                        onUploadLogo={onUploadLogo}
                        onChangeValue={(updatedChild, coalesce) => {
                          onChangeValue({ ...obj, [key]: updatedChild }, coalesce);
                        }}
                        onRequestRenameSelf={() => {
                          setRenamingKey(key);
                          setRenameDraft(key);
                          setRenameError(null);
                        }}
                        onRequestDuplicateSelf={() => handleDuplicateKey(key)}
                        onRequestDeleteSelf={() => setDeletingTarget({ kind: 'key', key })}
                      />
                    )}
                  </div>
                ))
              )}

              {!readOnly && (
                <div>
                  {addingProp ? (
                    <form
                      onSubmit={handleAddProperty}
                      className="p-3.5 rounded-2xl border space-y-3"
                      style={{
                        backgroundColor: 'var(--m3-surface-container)',
                        borderColor: 'var(--m3-outline)',
                      }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <input
                          type="text"
                          value={newPropKey}
                          onChange={(e) => {
                            setNewPropKey(e.target.value);
                            setAddPropError(null);
                          }}
                          placeholder="Property key name"
                          autoFocus
                          className="sm:col-span-7 h-10 px-3 rounded-xl border text-xs font-mono focus:outline-none"
                          style={{
                            backgroundColor: 'var(--m3-surface)',
                            borderColor: addPropError ? '#DC2626' : 'var(--m3-outline)',
                            color: 'var(--m3-on-surface)',
                          }}
                        />
                        <select
                          value={newPropType}
                          onChange={(e) => setNewPropType(e.target.value as JsonValueType)}
                          aria-label="Property type"
                          className="sm:col-span-5 h-10 px-3 rounded-xl border text-xs font-medium focus:outline-none"
                          style={{
                            backgroundColor: 'var(--m3-surface)',
                            borderColor: 'var(--m3-outline)',
                            color: 'var(--m3-on-surface)',
                          }}
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="object">Object</option>
                          <option value="array">Array</option>
                          <option value="null">Null</option>
                        </select>
                      </div>
                      {addPropError && <p className="text-xs text-red-500">{addPropError}</p>}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingProp(false);
                            setAddPropError(null);
                          }}
                          className="h-9 px-3.5 rounded-xl border text-xs font-medium cursor-pointer"
                          style={{ borderColor: 'var(--m3-outline)' }}
                        >
                          {t.cancel}
                        </button>
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                          style={{
                            backgroundColor: 'var(--m3-primary)',
                            color: 'var(--m3-on-primary)',
                          }}
                        >
                          {t.addProperty}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
                      transition={chipSpring}
                      onClick={() => setAddingProp(true)}
                      className="h-9 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--m3-surface-container)',
                        borderColor: 'var(--m3-outline-variant)',
                        color: 'var(--m3-primary)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addProperty}</span>
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {deletingTarget && deletingTarget.kind === 'key' && (
          <DeleteConfirmModal
            t={t}
            targetLabel={deletingTarget.key}
            reducedMotion={reducedMotion}
            sheetSpring={sheetSpring}
            onCancel={() => setDeletingTarget(null)}
            onConfirm={() => handleDeleteKey(deletingTarget.key)}
          />
        )}
      </div>
    );
  }

  // --- ARRAY RENDERER ---
  if (nodeType === 'array') {
    const arr = value as unknown[];
    const inferredDefaultType: JsonValueType =
      arr.length > 0 ? detectJsonType(arr[0]) : 'string';

    const handleAddItem = () => {
      const next = [...arr, defaultForType(newItemType)];
      onChangeValue(next, false);
      setAddingItem(false);
    };

    const handleDeleteItem = (index: number) => {
      const next = arr.filter((_, i) => i !== index);
      onChangeValue(next, false);
      setDeletingTarget(null);
    };

    return (
      <div
        className="rounded-2xl border"
        style={{
          backgroundColor: isRoot ? 'var(--m3-surface-container-low)' : 'var(--m3-surface)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer min-h-[36px]"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--m3-on-surface-variant)' }} />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--m3-on-surface-variant)' }} />
            )}
            <span className="font-display text-sm font-semibold truncate">{label}</span>
            <span
              className="text-xs tabular-nums shrink-0"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              · [{arr.length}]
            </span>
          </button>

          {!readOnly && !isRoot && (
            <NodeOverflowMenu
              t={t}
              open={menuOpen}
              currentType="array"
              reducedMotion={reducedMotion}
              onToggle={() => setMenuOpen((o) => !o)}
              onClose={() => setMenuOpen(false)}
              onRename={onRequestRenameSelf}
              onDuplicate={onRequestDuplicateSelf}
              onConvertType={(nextType) => onChangeValue(convertJsonType(value, nextType), false)}
              onDelete={onRequestDeleteSelf}
            />
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={chipSpring}
              className="px-4 pb-4 pt-2 space-y-2.5 border-t"
              style={{ borderColor: 'var(--m3-outline-variant)' }}
            >
              {arr.length === 0 ? (
                <p className="text-xs py-1.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Empty array
                </p>
              ) : (
                arr.map((item, idx) => (
                  <JsonNodeTree
                    key={idx}
                    t={t}
                    value={item}
                    pathSegments={[...pathSegments, idx]}
                    label={`[${idx}]`}
                    readOnly={readOnly}
                    reducedMotion={reducedMotion}
                    onUploadLogo={onUploadLogo}
                    onChangeValue={(updatedItem, coalesce) => {
                      const copy = [...arr];
                      copy[idx] = updatedItem;
                      onChangeValue(copy, coalesce);
                    }}
                    onRequestDeleteSelf={() => setDeletingTarget({ kind: 'index', index: idx })}
                  />
                ))
              )}

              {!readOnly && (
                <div>
                  {addingItem ? (
                    <div
                      className="p-3 rounded-xl border flex flex-wrap items-center gap-2"
                      style={{
                        backgroundColor: 'var(--m3-surface-container)',
                        borderColor: 'var(--m3-outline)',
                      }}
                    >
                      <select
                        value={newItemType}
                        onChange={(e) => setNewItemType(e.target.value as JsonValueType)}
                        aria-label="New array item type"
                        className="h-9 px-3 rounded-lg border text-xs font-medium"
                        style={{
                          backgroundColor: 'var(--m3-surface)',
                          borderColor: 'var(--m3-outline)',
                          color: 'var(--m3-on-surface)',
                        }}
                      >
                        {ALL_TYPES.map((tp) => (
                          <option key={tp} value={tp}>
                            {tp.charAt(0).toUpperCase() + tp.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="h-9 px-3.5 rounded-lg text-xs font-semibold cursor-pointer"
                        style={{
                          backgroundColor: 'var(--m3-primary)',
                          color: 'var(--m3-on-primary)',
                        }}
                      >
                        {t.addItem}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingItem(false)}
                        className="h-9 px-3 rounded-lg border text-xs cursor-pointer"
                        style={{ borderColor: 'var(--m3-outline)' }}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <motion.button
                      type="button"
                      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
                      transition={chipSpring}
                      onClick={() => {
                        setNewItemType(inferredDefaultType);
                        setAddingItem(true);
                      }}
                      className="h-9 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--m3-surface-container)',
                        borderColor: 'var(--m3-outline-variant)',
                        color: 'var(--m3-primary)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addItem}</span>
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {deletingTarget && deletingTarget.kind === 'index' && (
          <DeleteConfirmModal
            t={t}
            targetLabel={`${label}[${deletingTarget.index}]`}
            reducedMotion={reducedMotion}
            sheetSpring={sheetSpring}
            onCancel={() => setDeletingTarget(null)}
            onConfirm={() => handleDeleteItem(deletingTarget.index)}
          />
        )}
      </div>
    );
  }

  // --- PRIMITIVE RENDERERS ---
  return (
    <div
      className="p-3.5 rounded-xl border space-y-2"
      style={{
        backgroundColor: 'var(--m3-surface-container-low)',
        borderColor: 'var(--m3-outline-variant)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold font-mono truncate">{label}</span>
          <span
            className="text-[11px] shrink-0"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          >
            · {nodeType}
          </span>
        </div>

        {!readOnly && (
          <NodeOverflowMenu
            t={t}
            open={menuOpen}
            currentType={nodeType}
            reducedMotion={reducedMotion}
            onToggle={() => setMenuOpen((o) => !o)}
            onClose={() => setMenuOpen(false)}
            onRename={onRequestRenameSelf}
            onDuplicate={onRequestDuplicateSelf}
            onConvertType={(nextType) => onChangeValue(convertJsonType(value, nextType), false)}
            onDelete={onRequestDeleteSelf}
          />
        )}
      </div>

      {nodeType === 'string' && (
        isLogoField ? (
          <LogoPreviewField
            url={String(value)}
            readOnly={readOnly}
            onChangeUrl={(next) => onChangeValue(next, true)}
            onUploadLogo={onUploadLogo}
          />
        ) : String(value).length > 72 || String(value).includes('\n') ? (
          <textarea
            rows={3}
            readOnly={readOnly}
            value={String(value)}
            onChange={(e) => onChangeValue(e.target.value, true)}
            className="w-full p-3 rounded-xl border text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--m3-surface)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          />
        ) : (
          <input
            type="text"
            readOnly={readOnly}
            value={String(value)}
            onChange={(e) => onChangeValue(e.target.value, true)}
            className="w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--m3-surface)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          />
        )
      )}

      {nodeType === 'number' && (
        <input
          type="text"
          inputMode="decimal"
          readOnly={readOnly}
          value={numDraft !== null ? numDraft : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            setNumDraft(raw);
            if (raw.trim() !== '' && !raw.endsWith('.') && raw !== '-') {
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) {
                onChangeValue(parsed, true);
              }
            }
          }}
          onBlur={() => {
            if (numDraft !== null) {
              const parsed = Number(numDraft.trim());
              if (numDraft.trim() !== '' && Number.isFinite(parsed)) {
                onChangeValue(parsed, false);
              }
              setNumDraft(null);
            }
          }}
          className="w-full h-11 px-3.5 rounded-xl border text-sm font-mono tabular-nums focus:outline-none"
          style={{
            backgroundColor: 'var(--m3-surface)',
            borderColor: 'var(--m3-outline)',
            color: 'var(--m3-on-surface)',
          }}
        />
      )}

      {nodeType === 'boolean' && (
        <div className="flex items-center justify-between pt-0.5">
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: value ? '#16A34A' : 'var(--m3-on-surface-variant)' }}
          >
            {value ? 'TRUE' : 'FALSE'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            disabled={readOnly}
            onClick={() => onChangeValue(!value, false)}
            className="relative w-12 h-7 rounded-full transition-colors duration-150 cursor-pointer disabled:opacity-60"
            style={{
              backgroundColor: value ? 'var(--m3-primary)' : 'var(--m3-surface-container-high)',
            }}
          >
            <motion.span
              layout
              transition={chipSpring}
              className="block w-5 h-5 rounded-full bg-white shadow"
              style={{
                marginLeft: value ? '24px' : '4px',
              }}
            />
          </button>
        </div>
      )}

      {nodeType === 'null' && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          >
            NULL
          </span>
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              {(['string', 'number', 'boolean', 'object', 'array'] as JsonValueType[]).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => onChangeValue(defaultForType(tp), false)}
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-medium hover:opacity-85 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: 'var(--m3-outline-variant)',
                  }}
                >
                  → {tp}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface NodeOverflowMenuProps {
  t: Translations;
  open: boolean;
  currentType: JsonValueType;
  reducedMotion: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onConvertType: (nextType: JsonValueType) => void;
  onDelete?: () => void;
}

const NodeOverflowMenu: React.FC<NodeOverflowMenuProps> = ({
  t,
  open,
  currentType,
  reducedMotion,
  onToggle,
  onClose,
  onRename,
  onDuplicate,
  onConvertType,
  onDelete,
}) => {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setShowTypePicker(false);
          onToggle();
        }}
        aria-label="Property actions"
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:opacity-80 cursor-pointer"
        style={{ color: 'var(--m3-on-surface-variant)' }}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={onClose} />
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.94, y: -4 }}
              transition={chipSpring}
              className="absolute right-0 mt-1 w-48 rounded-2xl border shadow-xl z-40 py-1.5 text-xs origin-top-right"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              {onRename && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRename();
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t.rename}</span>
                </button>
              )}
              {onDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDuplicate();
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.duplicate}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTypePicker((v) => !v)}
                className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.changeType}</span>
              </button>
              {showTypePicker && (
                <div
                  className="px-2 py-1.5 border-y space-y-0.5"
                  style={{
                    backgroundColor: 'var(--m3-surface-container)',
                    borderColor: 'var(--m3-outline-variant)',
                  }}
                >
                  {ALL_TYPES.filter((tp) => tp !== currentType).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => {
                        onClose();
                        onConvertType(tp);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left capitalize hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.delete}</span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const DeleteConfirmModal: React.FC<{
  t: Translations;
  targetLabel: string;
  reducedMotion: boolean;
  sheetSpring: ReturnType<typeof getSpring>;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ t, targetLabel, reducedMotion, sheetSpring, onCancel, onConfirm }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="alertdialog"
    aria-modal="true"
  >
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={sheetSpring}
      className="w-full max-w-sm p-6 rounded-3xl border shadow-xl space-y-4"
      style={{
        backgroundColor: 'var(--m3-surface-container-low)',
        borderColor: 'var(--m3-outline)',
        color: 'var(--m3-on-surface)',
      }}
    >
      <div className="space-y-1.5">
        <h3 className="font-display text-lg font-semibold">{t.confirmDeleteTitle}</h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
          {t.confirmDeleteBody}
        </p>
        <p className="text-xs font-mono pt-1" style={{ color: 'var(--m3-primary)' }}>
          {targetLabel}
        </p>
      </div>
      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-xl border text-xs font-medium cursor-pointer"
          style={{ borderColor: 'var(--m3-outline)' }}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-10 px-4 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
        >
          {t.delete}
        </button>
      </div>
    </motion.div>
  </div>
);
