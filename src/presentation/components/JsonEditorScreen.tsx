import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Check,
  Loader2,
  AlertTriangle,
  BrainCircuit,
  Code,
  Layers,
  X,
  Plus,
  Minus,
  Edit3,
  Undo2,
  Redo2,
  History,
} from 'lucide-react';
import type { EditorDocument, FileCommitEntry, GitHubRepo, JsonDiffEntry } from '../../domain/types';
import type { Translations } from '../../core/i18n';
import { computeJsonDiff, deepCloneJson, deepEqualJson } from '../../core/jsonEngine';
import { M3_CHIP_SPRING, M3_SHEET_SPRING, getSpring } from '../../core/motionPresets';
import { apiClient } from '../../data/apiClient';
import { JsonNodeTree } from './JsonNodeTree';
import { DeepThinkingSheet } from './DeepThinkingSheet';
import { VersionHistorySheet } from './VersionHistorySheet';

interface JsonEditorScreenProps {
  t: Translations;
  repo: GitHubRepo;
  branch: string;
  doc: EditorDocument;
  isOffline: boolean;
  reducedMotion: boolean;
  onBack: () => void;
  onUpdateDoc: (nextDoc: EditorDocument) => void;
  onNotify: (message: string, tone?: 'neutral' | 'success' | 'warning' | 'error') => void;
}

const MAX_HISTORY_STEPS = 80;

export const JsonEditorScreen: React.FC<JsonEditorScreenProps> = ({
  t,
  repo,
  branch,
  doc,
  isOffline,
  reducedMotion,
  onBack,
  onUpdateDoc,
  onNotify,
}) => {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');
  const [rawDraft, setRawDraft] = useState(() => JSON.stringify(doc.editedData, null, 2));
  const [rawSyntaxError, setRawSyntaxError] = useState<string | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<unknown[]>([]);
  const [redoStack, setRedoStack] = useState<unknown[]>([]);
  const lastEditTimeRef = useRef<number>(0);
  const currentDocPathRef = useRef<string>(doc.path);

  useEffect(() => {
    if (currentDocPathRef.current !== doc.path) {
      currentDocPathRef.current = doc.path;
      setUndoStack([]);
      setRedoStack([]);
      setRawDraft(JSON.stringify(doc.editedData, null, 2));
      setRawSyntaxError(null);
    }
  }, [doc.path, doc.editedData]);

  const [refreshing, setRefreshing] = useState(false);
  const [showUnsavedReloadDialog, setShowUnsavedReloadDialog] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);

  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [commitMessage, setCommitMessage] = useState(`Update ${doc.displayName} configuration`);
  const [commitState, setCommitState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [commitError, setCommitError] = useState<string | null>(null);

  const [conflictState, setConflictState] = useState<{
    remoteSha: string;
    remoteContent: string;
  } | null>(null);
  const [showRemoteReview, setShowRemoteReview] = useState(false);

  const [showThinkingSheet, setShowThinkingSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);

  const diffs: JsonDiffEntry[] = useMemo(
    () => computeJsonDiff(doc.originalData, doc.editedData),
    [doc.originalData, doc.editedData]
  );

  const isDirty = useMemo(
    () => !deepEqualJson(doc.originalData, doc.editedData),
    [doc.originalData, doc.editedData]
  );

  const readOnly = !repo.canPush || isOffline;

  const commitSnapshot = useCallback(
    (nextVal: unknown, coalesceRapidTyping = false) => {
      if (deepEqualJson(doc.editedData, nextVal)) return;

      const now = Date.now();
      const shouldCoalesce = coalesceRapidTyping && now - lastEditTimeRef.current < 600;
      lastEditTimeRef.current = now;

      if (!shouldCoalesce) {
        setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY_STEPS - 1)), deepCloneJson(doc.editedData)]);
      }
      setRedoStack([]);

      onUpdateDoc({
        ...doc,
        editedData: nextVal,
      });
      setRawDraft(JSON.stringify(nextVal, null, 2));
      setRawSyntaxError(null);
    },
    [doc, onUpdateDoc]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, deepCloneJson(doc.editedData)]);
    onUpdateDoc({ ...doc, editedData: previous });
    setRawDraft(JSON.stringify(previous, null, 2));
    setRawSyntaxError(null);
  }, [undoStack, doc, onUpdateDoc]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, deepCloneJson(doc.editedData)]);
    onUpdateDoc({ ...doc, editedData: next });
    setRawDraft(JSON.stringify(next, null, 2));
    setRawSyntaxError(null);
  }, [redoStack, doc, onUpdateDoc]);

  // Global keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (isTextInput && viewMode === 'raw') return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, undoStack.length, redoStack.length, viewMode]);

  const handleSwitchMode = (mode: 'visual' | 'raw') => {
    if (mode === 'raw') {
      setRawDraft(JSON.stringify(doc.editedData, null, 2));
      setRawSyntaxError(null);
      setViewMode('raw');
      return;
    }
    try {
      const parsed = JSON.parse(rawDraft);
      setRawSyntaxError(null);
      commitSnapshot(parsed, false);
      setViewMode('visual');
    } catch (err) {
      setRawSyntaxError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const handleRawTextChange = (text: string) => {
    setRawDraft(text);
    try {
      const parsed = JSON.parse(text);
      setRawSyntaxError(null);
      commitSnapshot(parsed, true);
    } catch (err) {
      setRawSyntaxError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const executeReloadFromRemote = async () => {
    setShowUnsavedReloadDialog(false);
    setConflictState(null);
    setShowRemoteReview(false);
    setRefreshing(true);
    try {
      const remote = await apiClient.getFile(repo.owner, repo.name, doc.path, branch);
      const parsed = JSON.parse(remote.content);
      setUndoStack([]);
      setRedoStack([]);
      onUpdateDoc({
        path: remote.path,
        displayName: doc.displayName,
        sha: remote.sha,
        htmlUrl: remote.htmlUrl,
        originalRaw: remote.content,
        originalData: deepCloneJson(parsed),
        editedData: parsed,
      });
      setRawDraft(JSON.stringify(parsed, null, 2));
      setRawSyntaxError(null);
      onNotify('Refresh completed', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to reload file', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshTap = () => {
    if (isDirty) {
      setShowUnsavedReloadDialog(true);
    } else {
      executeReloadFromRemote();
    }
  };

  const handleBackTap = () => {
    if (isDirty) {
      setShowBackConfirmDialog(true);
    } else {
      onBack();
    }
  };

  const handleUploadLogo = async (file: File, applyUrl: (url: string) => void) => {
    if (readOnly) {
      onNotify('Connect a write-enabled PAT to upload assets.', 'warning');
      return;
    }
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const assetPath = `assets/${Date.now()}_${safeName}`;
    try {
      const uploaded = await apiClient.uploadAsset({
        owner: repo.owner,
        repo: repo.name,
        branch,
        path: assetPath,
        base64Data,
      });
      applyUrl(uploaded.url);
      onNotify(`Uploaded ${safeName} and updated URL`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Asset upload failed', 'error');
    }
  };

  const handleOpenSaveSheet = () => {
    if (!isDirty || rawSyntaxError) return;
    setCommitError(null);
    setCommitState('idle');
    setCommitMessage(`Update ${doc.displayName} configuration`);
    setShowSaveSheet(true);
  };

  const handleCommitChanges = async () => {
    if (readOnly || !isDirty || rawSyntaxError) return;
    setCommitError(null);
    setCommitState('saving');

    try {
      const formatted = JSON.stringify(doc.editedData, null, 2) + '\n';
      const result = await apiClient.commitFile({
        owner: repo.owner,
        repo: repo.name,
        branch,
        path: doc.path,
        content: formatted,
        message: commitMessage.trim() || `Update ${doc.displayName} configuration`,
        expectedSha: doc.sha,
      });

      setCommitState('success');
      onUpdateDoc({
        ...doc,
        sha: result.sha,
        originalRaw: formatted,
        originalData: deepCloneJson(doc.editedData),
      });
      onNotify(t.savedToGithub, 'success');

      setTimeout(() => {
        setShowSaveSheet(false);
        setCommitState('idle');
      }, 650);
    } catch (err) {
      const e = err as Error & { code?: string; remoteSha?: string; remoteContent?: string };
      setCommitState('idle');
      if (e.code === 'SHA_CONFLICT' && e.remoteSha) {
        setShowSaveSheet(false);
        setConflictState({
          remoteSha: e.remoteSha,
          remoteContent: e.remoteContent || '',
        });
      } else {
        setCommitError(e.message || 'Commit failed');
      }
    }
  };

  const handleRestoreHistoricalVersion = (restoredData: unknown, commit: FileCommitEntry) => {
    commitSnapshot(deepCloneJson(restoredData), false);
    setShowHistorySheet(false);
    setCommitMessage(`Revert ${doc.displayName} to ${commit.shortSha}`);
    onNotify(`Restored snapshot ${commit.shortSha} to editor (ready to commit)`, 'success');
  };

  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);
  const sheetSpring = getSpring(reducedMotion, M3_SHEET_SPRING);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 space-y-5 pb-24">
      {/* Sticky Editor Top Bar */}
      <div
        className="sticky top-16 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--m3-surface) 88%, transparent)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              type="button"
              whileTap={reducedMotion ? undefined : { scale: 0.92 }}
              transition={chipSpring}
              onClick={handleBackTap}
              aria-label={t.back}
              className="w-10 h-10 rounded-xl border flex items-center justify-center hover:opacity-85 shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline-variant)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold truncate">
                {doc.displayName}
              </h1>
              <p
                className="text-xs font-mono truncate"
                style={{ color: 'var(--m3-on-surface-variant)' }}
              >
                {repo.fullName} · {branch} · {doc.path}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo Buttons */}
            {!readOnly && (
              <div
                className="inline-flex items-center p-0.5 rounded-xl border"
                style={{
                  backgroundColor: 'var(--m3-surface-container-low)',
                  borderColor: 'var(--m3-outline-variant)',
                }}
              >
                <motion.button
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                  transition={chipSpring}
                  disabled={undoStack.length === 0}
                  onClick={handleUndo}
                  title={`${t.undo} (Ctrl+Z)`}
                  aria-label={t.undo}
                  className="h-9 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-35 cursor-pointer disabled:cursor-default"
                >
                  <Undo2 className="w-4 h-4" />
                  <span className="hidden xl:inline">{t.undo}</span>
                  {undoStack.length > 0 && (
                    <span className="text-[10px] font-mono tabular-nums opacity-70">
                      {undoStack.length}
                    </span>
                  )}
                </motion.button>
                <div className="w-px h-5" style={{ backgroundColor: 'var(--m3-outline-variant)' }} />
                <motion.button
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                  transition={chipSpring}
                  disabled={redoStack.length === 0}
                  onClick={handleRedo}
                  title={`${t.redo} (Ctrl+Shift+Z)`}
                  aria-label={t.redo}
                  className="h-9 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-35 cursor-pointer disabled:cursor-default"
                >
                  <Redo2 className="w-4 h-4" />
                  <span className="hidden xl:inline">{t.redo}</span>
                  {redoStack.length > 0 && (
                    <span className="text-[10px] font-mono tabular-nums opacity-70">
                      {redoStack.length}
                    </span>
                  )}
                </motion.button>
              </div>
            )}

            {/* Visual | Raw Segmented Control with Bouncy M3 Layout Indicator */}
            <div
              className="inline-flex p-0.5 rounded-xl border"
              style={{
                backgroundColor: 'var(--m3-surface-container)',
                borderColor: 'var(--m3-outline-variant)',
              }}
            >
              {(
                [
                  { id: 'visual', label: t.visualEditor, icon: Layers },
                  { id: 'raw', label: t.rawView, icon: Code },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = viewMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSwitchMode(opt.id)}
                    className="relative h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    style={{
                      color: active ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)',
                    }}
                  >
                    {active && (
                      <motion.span
                        layoutId="editor-mode-pill"
                        transition={chipSpring}
                        className="absolute inset-0 rounded-lg shadow-xs"
                        style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <motion.button
              type="button"
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              transition={chipSpring}
              onClick={() => setShowHistorySheet(true)}
              className="h-10 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
              }}
            >
              <History className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
              <span>{t.versionHistory}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              transition={chipSpring}
              onClick={() => setShowThinkingSheet(true)}
              className="h-10 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
              }}
            >
              <BrainCircuit className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
              <span>{t.deepAudit}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              transition={chipSpring}
              onClick={handleRefreshTap}
              disabled={refreshing}
              className="h-10 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{t.refresh}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={reducedMotion || !isDirty || readOnly ? undefined : { scale: 0.95 }}
              transition={chipSpring}
              disabled={!isDirty || Boolean(rawSyntaxError) || readOnly}
              onClick={handleOpenSaveSheet}
              className="h-10 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: isDirty && !readOnly ? 'var(--m3-primary)' : 'var(--m3-surface-container-high)',
                color: isDirty && !readOnly ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
              }}
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {readOnly
                  ? t.readOnlyLabel
                  : isDirty
                  ? `${t.save} (${diffs.length})`
                  : t.noChanges}
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Live Diff Banner when changes exist */}
      <AnimatePresence>
        {isDirty && diffs.length > 0 && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
            transition={chipSpring}
            className="px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs"
            style={{
              backgroundColor: 'var(--m3-primary-container)',
              borderColor: 'var(--m3-primary)',
              color: 'var(--m3-on-primary-container)',
            }}
          >
            <span className="font-medium tabular-nums">
              {diffs.length} pending {diffs.length === 1 ? 'change' : 'changes'}:{' '}
              <span className="font-mono">
                {diffs
                  .slice(0, 4)
                  .map((d) => `${d.kind === 'added' ? '+' : d.kind === 'removed' ? '-' : '~'} ${d.path}`)
                  .join(' · ')}
                {diffs.length > 4 ? ` (+${diffs.length - 4} more)` : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                commitSnapshot(deepCloneJson(doc.originalData), false);
              }}
              className="font-semibold underline cursor-pointer"
            >
              Revert to saved baseline
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {rawSyntaxError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl border bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300 text-xs font-mono"
        >
          Syntax error: {rawSyntaxError}
        </div>
      )}

      {/* Main Editor Surface with Bouncy View Switch */}
      <AnimatePresence mode="wait">
        {viewMode === 'visual' ? (
          <motion.div
            key="visual-mode"
            initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -8, scale: 0.99 }}
            transition={chipSpring}
          >
            <JsonNodeTree
              t={t}
              value={doc.editedData}
              pathSegments={[]}
              label={doc.displayName}
              isRoot
              readOnly={readOnly}
              reducedMotion={reducedMotion}
              onChangeValue={(nextVal, coalesce) => commitSnapshot(nextVal, coalesce)}
              onUploadLogo={handleUploadLogo}
            />
          </motion.div>
        ) : (
          <motion.div
            key="raw-mode"
            initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -8, scale: 0.99 }}
            transition={chipSpring}
          >
            <textarea
              value={rawDraft}
              readOnly={readOnly}
              onChange={(e) => handleRawTextChange(e.target.value)}
              spellCheck={false}
              rows={26}
              className="w-full p-5 rounded-2xl border text-xs sm:text-sm font-mono leading-relaxed focus:outline-none"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: rawSyntaxError ? '#DC2626' : 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Changes Confirmation Sheet */}
      <AnimatePresence>
        {showSaveSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-changes-title"
          >
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.97 }}
              transition={sheetSpring}
              className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              <div
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: 'var(--m3-outline-variant)' }}
              >
                <div>
                  <h2 id="save-changes-title" className="font-display text-lg font-semibold">
                    {t.saveChangesTitle}
                  </h2>
                  <p className="text-xs tabular-nums" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {diffs.length} {diffs.length === 1 ? 'property' : 'properties'} changed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveSheet(false)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div
                  className="p-3.5 rounded-2xl border text-xs space-y-1"
                  style={{
                    backgroundColor: 'var(--m3-surface-container)',
                    borderColor: 'var(--m3-outline-variant)',
                  }}
                >
                  <div className="flex justify-between gap-2">
                    <span style={{ color: 'var(--m3-on-surface-variant)' }}>Repository</span>
                    <span className="font-mono font-medium">{repo.fullName} ({branch})</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span style={{ color: 'var(--m3-on-surface-variant)' }}>File</span>
                    <span className="font-mono font-medium">{doc.displayName}</span>
                  </div>
                </div>

                {/* Nested Path Diff Summary */}
                <div className="space-y-1.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Changes
                  </span>
                  <div
                    className="rounded-2xl border divide-y max-h-52 overflow-y-auto"
                    style={{
                      backgroundColor: 'var(--m3-surface)',
                      borderColor: 'var(--m3-outline-variant)',
                    }}
                  >
                    {diffs.map((d, idx) => (
                      <div key={idx} className="px-3.5 py-2.5 text-xs flex items-start gap-2.5 font-mono">
                        {d.kind === 'added' ? (
                          <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : d.kind === 'removed' ? (
                          <Minus className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        ) : (
                          <Edit3 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold break-all">{d.path}</div>
                          <div className="text-[11px] truncate" style={{ color: 'var(--m3-on-surface-variant)' }}>
                            {d.kind === 'added' && `→ ${d.newValue}`}
                            {d.kind === 'removed' && `was ${d.oldValue}`}
                            {d.kind === 'modified' && `${d.oldValue} → ${d.newValue}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {t.commitMessageLabel}
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none"
                    style={{
                      backgroundColor: 'var(--m3-surface)',
                      borderColor: 'var(--m3-outline)',
                      color: 'var(--m3-on-surface)',
                    }}
                  />
                </div>

                {commitError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs font-medium">
                    {commitError}
                  </div>
                )}
              </div>

              <div
                className="flex items-center justify-end gap-2.5 px-6 py-4 border-t"
                style={{ borderColor: 'var(--m3-outline-variant)' }}
              >
                <button
                  type="button"
                  disabled={commitState === 'saving'}
                  onClick={() => setShowSaveSheet(false)}
                  className="h-11 px-5 rounded-xl border text-xs font-medium cursor-pointer"
                  style={{ borderColor: 'var(--m3-outline)' }}
                >
                  {t.cancel}
                </button>
                <motion.button
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={chipSpring}
                  disabled={commitState !== 'idle'}
                  onClick={handleCommitChanges}
                  className="h-11 px-6 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: commitState === 'success' ? '#16A34A' : 'var(--m3-primary)',
                    color: commitState === 'success' ? '#FFFFFF' : 'var(--m3-on-primary)',
                  }}
                >
                  {commitState === 'saving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.savingToGithub}</span>
                    </>
                  ) : commitState === 'success' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.savedToGithub}</span>
                    </>
                  ) : (
                    <span>{t.commitChanges}</span>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SHA Conflict Dialog */}
      <AnimatePresence>
        {conflictState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            role="alertdialog"
            aria-modal="true"
          >
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={sheetSpring}
              className="w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-semibold">{t.remoteChangedTitle}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {t.remoteChangedBody}
                  </p>
                </div>
              </div>

              {showRemoteReview && (
                <pre
                  className="p-3.5 rounded-xl border text-[11px] font-mono overflow-auto max-h-56"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: 'var(--m3-outline-variant)',
                  }}
                >
                  {conflictState.remoteContent}
                </pre>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConflictState(null);
                    setShowRemoteReview(false);
                  }}
                  className="h-10 px-4 rounded-xl border text-xs font-medium cursor-pointer"
                  style={{ borderColor: 'var(--m3-outline)' }}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRemoteReview((v) => !v)}
                  className="h-10 px-4 rounded-xl border text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--m3-surface-container)',
                    borderColor: 'var(--m3-outline)',
                  }}
                >
                  {t.reviewDiff}
                </button>
                <button
                  type="button"
                  onClick={executeReloadFromRemote}
                  className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--m3-primary)',
                    color: 'var(--m3-on-primary)',
                  }}
                >
                  {t.reloadLatest}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Reload Confirmation */}
      <AnimatePresence>
        {showUnsavedReloadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="alertdialog"
            aria-modal="true"
          >
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={sheetSpring}
              className="w-full max-w-sm p-6 rounded-3xl border shadow-xl space-y-4"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              <h3 className="font-display text-lg font-semibold">{t.unsavedChangesTitle}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {t.unsavedChangesBody}
              </p>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUnsavedReloadDialog(false)}
                  className="h-10 px-4 rounded-xl border text-xs font-medium cursor-pointer"
                  style={{ borderColor: 'var(--m3-outline)' }}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={executeReloadFromRemote}
                  className="h-10 px-4 rounded-xl text-xs font-semibold bg-red-600 text-white cursor-pointer"
                >
                  {t.reload}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Back Confirmation */}
      <AnimatePresence>
        {showBackConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="alertdialog"
            aria-modal="true"
          >
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={sheetSpring}
              className="w-full max-w-sm p-6 rounded-3xl border shadow-xl space-y-4"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              <h3 className="font-display text-lg font-semibold">{t.unsavedChangesTitle}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Leave the editor without committing your {diffs.length} pending changes?
              </p>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBackConfirmDialog(false)}
                  className="h-10 px-4 rounded-xl border text-xs font-medium cursor-pointer"
                  style={{ borderColor: 'var(--m3-outline)' }}
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBackConfirmDialog(false);
                    onBack();
                  }}
                  className="h-10 px-4 rounded-xl text-xs font-semibold bg-red-600 text-white cursor-pointer"
                >
                  Discard & Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version History Drawer */}
      <AnimatePresence>
        {showHistorySheet && (
          <VersionHistorySheet
            t={t}
            owner={repo.owner}
            repo={repo.name}
            branch={branch}
            filePath={doc.path}
            currentEditedData={doc.editedData}
            canEdit={!readOnly}
            reducedMotion={reducedMotion}
            onClose={() => setShowHistorySheet(false)}
            onRestoreVersion={handleRestoreHistoricalVersion}
          />
        )}
      </AnimatePresence>

      {/* Gemini High Thinking Drawer */}
      {showThinkingSheet && (
        <DeepThinkingSheet
          filePath={doc.path}
          originalJson={JSON.stringify(doc.originalData, null, 2)}
          editedJson={JSON.stringify(doc.editedData, null, 2)}
          diffs={diffs}
          canEdit={!readOnly}
          onClose={() => setShowThinkingSheet(false)}
          onApplyPatch={(parsedJson) => {
            commitSnapshot(parsedJson, false);
            onNotify('Applied patch to working tree', 'success');
          }}
        />
      )}
    </div>
  );
};
