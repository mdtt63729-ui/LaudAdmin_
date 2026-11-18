import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  History,
  RotateCcw,
  Plus,
  Minus,
  Edit3,
  AlertCircle,
  ExternalLink,
  Code,
} from 'lucide-react';
import { apiClient } from '../../data/apiClient';
import { computeJsonDiff } from '../../core/jsonEngine';
import { M3_CHIP_SPRING, M3_SHEET_SPRING, getSpring } from '../../core/motionPresets';
import type { FileCommitEntry, JsonDiffEntry } from '../../domain/types';
import type { Translations } from '../../core/i18n';
import { ContainedLoadingIndicator } from './ContainedLoadingIndicator';

interface VersionHistorySheetProps {
  t: Translations;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  currentEditedData: unknown;
  canEdit: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onRestoreVersion: (restoredData: unknown, commit: FileCommitEntry) => void;
}

function formatCommitDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const VersionHistorySheet: React.FC<VersionHistorySheetProps> = ({
  t,
  owner,
  repo,
  branch,
  filePath,
  currentEditedData,
  canEdit,
  reducedMotion,
  onClose,
  onRestoreVersion,
}) => {
  const [commits, setCommits] = useState<FileCommitEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedCommit, setSelectedCommit] = useState<FileCommitEntry | null>(null);
  const [compareMode, setCompareMode] = useState<'commit' | 'current'>('commit');
  const [showRaw, setShowRaw] = useState(false);

  const [versionCache, setVersionCache] = useState<Record<string, unknown>>({});
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setListError(null);
    apiClient
      .getFileHistory(owner, repo, filePath, branch)
      .then((res) => {
        if (cancelled) return;
        setCommits(res.commits);
        if (res.commits.length > 0) {
          setSelectedCommit(res.commits[0]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : 'Failed to load commit history');
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, filePath, branch]);

  useEffect(() => {
    if (!selectedCommit) return;
    const idx = commits.findIndex((c) => c.sha === selectedCommit.sha);
    const parentCommit = idx >= 0 && idx + 1 < commits.length ? commits[idx + 1] : null;

    const neededRefs = [selectedCommit.sha];
    if (parentCommit) neededRefs.push(parentCommit.sha);

    const missing = neededRefs.filter((ref) => !(ref in versionCache));
    if (missing.length === 0) return;

    let cancelled = false;
    setLoadingVersion(true);
    setVersionError(null);

    Promise.all(
      missing.map(async (ref) => {
        const res = await apiClient.getFileAtCommit(owner, repo, filePath, ref);
        return { ref, parsed: JSON.parse(res.content) as unknown };
      })
    )
      .then((loaded) => {
        if (cancelled) return;
        setVersionCache((prev) => {
          const next = { ...prev };
          for (const item of loaded) {
            next[item.ref] = item.parsed;
          }
          return next;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setVersionError(err instanceof Error ? err.message : 'Failed to load commit snapshot');
      })
      .finally(() => {
        if (!cancelled) setLoadingVersion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCommit, commits, owner, repo, filePath, versionCache]);

  const selectedData = selectedCommit ? versionCache[selectedCommit.sha] : undefined;
  const selectedIdx = selectedCommit
    ? commits.findIndex((c) => c.sha === selectedCommit.sha)
    : -1;
  const parentCommit =
    selectedIdx >= 0 && selectedIdx + 1 < commits.length ? commits[selectedIdx + 1] : null;
  const parentData = parentCommit ? versionCache[parentCommit.sha] : undefined;

  const diffs: JsonDiffEntry[] = useMemo(() => {
    if (selectedData === undefined) return [];
    if (compareMode === 'current') {
      return computeJsonDiff(currentEditedData, selectedData);
    }
    if (parentData === undefined) {
      return computeJsonDiff({}, selectedData);
    }
    return computeJsonDiff(parentData, selectedData);
  }, [selectedData, parentData, compareMode, currentEditedData]);

  const spring = getSpring(reducedMotion, M3_SHEET_SPRING);
  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t.versionHistory}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={spring}
        className="w-full max-w-3xl h-full flex flex-col border-l shadow-2xl"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          borderColor: 'var(--m3-outline)',
          color: 'var(--m3-on-surface)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--m3-outline-variant)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
            >
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold truncate">{t.versionHistory}</h2>
              <p className="text-xs font-mono truncate" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {filePath} · {branch}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-pane responsive body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          {/* Left Commit List */}
          <div
            className="md:col-span-5 border-b md:border-b-0 md:border-r overflow-y-auto p-4 space-y-2 max-h-64 md:max-h-none"
            style={{ borderColor: 'var(--m3-outline-variant)' }}
          >
            {loadingList ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl border animate-pulse space-y-2"
                    style={{
                      backgroundColor: 'var(--m3-surface)',
                      borderColor: 'var(--m3-outline-variant)',
                    }}
                  >
                    <div className="h-3.5 w-3/4 rounded" style={{ backgroundColor: 'var(--m3-surface-container-high)' }} />
                    <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--m3-surface-container)' }} />
                  </div>
                ))}
              </div>
            ) : listError ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{listError}</span>
              </div>
            ) : commits.length === 0 ? (
              <p className="text-xs p-4" style={{ color: 'var(--m3-on-surface-variant)' }}>
                No commit history found for this file on branch {branch}.
              </p>
            ) : (
              commits.map((commit, index) => {
                const active = selectedCommit?.sha === commit.sha;
                return (
                  <motion.button
                    key={commit.sha}
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                    transition={chipSpring}
                    onClick={() => setSelectedCommit(commit)}
                    className="w-full text-left p-3.5 rounded-2xl border transition-colors cursor-pointer space-y-1.5"
                    style={{
                      backgroundColor: active
                        ? 'var(--m3-primary-container)'
                        : 'var(--m3-surface)',
                      borderColor: active ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                      color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold line-clamp-2 leading-snug">
                        {commit.message}
                      </span>
                      {index === 0 && (
                        <span className="text-[10px] font-mono font-semibold shrink-0 opacity-80">
                          Latest
                        </span>
                      )}
                    </div>
                    <div
                      className="flex items-center flex-wrap gap-1.5 text-[11px] tabular-nums"
                      style={{
                        color: active
                          ? 'var(--m3-on-primary-container)'
                          : 'var(--m3-on-surface-variant)',
                      }}
                    >
                      <span className="truncate max-w-[110px]">{commit.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{commit.shortSha}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatCommitDate(commit.date)}</span>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Right Version Diff & Restore Pane */}
          <div className="md:col-span-7 flex flex-col min-h-0 overflow-y-auto p-5 space-y-4">
            {selectedCommit ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Bouncy M3 Segmented Chips */}
                  <div
                    className="inline-flex p-1 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--m3-surface-container)',
                      borderColor: 'var(--m3-outline-variant)',
                    }}
                  >
                    {(
                      [
                        { id: 'commit', label: 'Changes in Commit' },
                        { id: 'current', label: 'Vs Current Editor' },
                      ] as const
                    ).map((opt) => {
                      const active = compareMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCompareMode(opt.id)}
                          className="relative h-8 px-3 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
                          style={{
                            color: active
                              ? 'var(--m3-on-surface)'
                              : 'var(--m3-on-surface-variant)',
                          }}
                        >
                          {active && (
                            <motion.span
                              layoutId="history-compare-pill"
                              transition={chipSpring}
                              className="absolute inset-0 rounded-lg shadow-xs"
                              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
                            />
                          )}
                          <span className="relative z-10">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRaw((v) => !v)}
                      className="h-9 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: showRaw ? 'var(--m3-primary-container)' : 'var(--m3-surface)',
                        borderColor: 'var(--m3-outline-variant)',
                        color: showRaw ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                      }}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>{showRaw ? 'Diff View' : 'Snapshot'}</span>
                    </button>

                    <a
                      href={selectedCommit.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 w-9 rounded-xl border flex items-center justify-center hover:opacity-80"
                      style={{ borderColor: 'var(--m3-outline-variant)' }}
                      aria-label="View commit on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {loadingVersion ? (
                  <div className="flex flex-col items-center gap-3 py-12 justify-center text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    <ContainedLoadingIndicator size={48} reducedMotion={reducedMotion} />
                    <span>Fetching snapshot {selectedCommit.shortSha}...</span>
                  </div>
                ) : versionError ? (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300">
                    {versionError}
                  </div>
                ) : showRaw && selectedData !== undefined ? (
                  <pre
                    className="p-4 rounded-2xl border text-xs font-mono overflow-x-auto leading-relaxed"
                    style={{
                      backgroundColor: 'var(--m3-surface)',
                      borderColor: 'var(--m3-outline-variant)',
                    }}
                  >
                    {JSON.stringify(selectedData, null, 2)}
                  </pre>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${selectedCommit.sha}-${compareMode}`}
                      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={chipSpring}
                      className="space-y-2.5"
                    >
                      {diffs.length === 0 ? (
                        <div
                          className="p-6 rounded-2xl border text-center text-xs"
                          style={{
                            backgroundColor: 'var(--m3-surface)',
                            borderColor: 'var(--m3-outline-variant)',
                            color: 'var(--m3-on-surface-variant)',
                          }}
                        >
                          {compareMode === 'current'
                            ? 'This commit matches your current editor state identically.'
                            : 'No structural property differences detected in this commit.'}
                        </div>
                      ) : (
                        <div
                          className="rounded-2xl border divide-y overflow-hidden"
                          style={{
                            backgroundColor: 'var(--m3-surface)',
                            borderColor: 'var(--m3-outline-variant)',
                          }}
                        >
                          {diffs.map((d, i) => (
                            <div key={i} className="px-4 py-2.5 text-xs flex items-start gap-2.5 font-mono">
                              {d.kind === 'added' ? (
                                <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              ) : d.kind === 'removed' ? (
                                <Minus className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              ) : (
                                <Edit3 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold break-all">{d.path}</div>
                                <div className="text-[11px] break-all" style={{ color: 'var(--m3-on-surface-variant)' }}>
                                  {d.kind === 'added' && `→ ${d.newValue}`}
                                  {d.kind === 'removed' && `was ${d.oldValue}`}
                                  {d.kind === 'modified' && `${d.oldValue} → ${d.newValue}`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}

                {canEdit && selectedData !== undefined && (
                  <div className="pt-2">
                    <motion.button
                      type="button"
                      whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                      transition={chipSpring}
                      onClick={() => onRestoreVersion(selectedData, selectedCommit)}
                      className="w-full h-11 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--m3-primary)',
                        color: 'var(--m3-on-primary)',
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t.restoreVersion} ({selectedCommit.shortSha})</span>
                    </motion.button>
                    <p
                      className="text-[11px] text-center mt-2"
                      style={{ color: 'var(--m3-on-surface-variant)' }}
                    >
                      Loads this snapshot into your editor Undo/Redo stack so you can review and commit safely.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Select a commit from the list to inspect changes.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
