import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  FileCode2,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  AlertCircle,
  FolderOpen,
  ArrowLeftRight,
} from 'lucide-react';
import type { DiscoveredJsonFile, GitHubBranch, GitHubRepo } from '../../domain/types';
import type { Translations } from '../../core/i18n';
import { formatBytes } from '../../core/jsonEngine';
import { M3_CHIP_SPRING, M3_EXPRESSIVE_SPRING, getSpring } from '../../core/motionPresets';
import { CreateJsonModal } from './CreateJsonModal';

interface DashboardScreenProps {
  t: Translations;
  repo: GitHubRepo;
  branch: string;
  branches: GitHubBranch[];
  files: DiscoveredJsonFile[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  truncatedTree: boolean;
  reducedMotion: boolean;
  lastRefreshSummary: string | null;
  onChangeBranch: (branch: string) => void;
  onRefresh: () => void;
  onOpenFile: (file: DiscoveredJsonFile) => void;
  onSwitchRepo: () => void;
  onFileCreated: (createdPath: string) => void;
}

const CardLogoOrIcon: React.FC<{ logoUrl?: string | null; name: string }> = ({
  logoUrl,
  name,
}) => {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} icon`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-10 h-10 rounded-xl object-cover shrink-0 border"
        style={{ borderColor: 'var(--m3-outline-variant)' }}
      />
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{
        backgroundColor: 'var(--m3-primary-container)',
        color: 'var(--m3-on-primary-container)',
      }}
    >
      <FileCode2 className="w-5 h-5" />
    </div>
  );
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  t,
  repo,
  branch,
  branches,
  files,
  loading,
  refreshing,
  error,
  truncatedTree,
  reducedMotion,
  lastRefreshSummary,
  onChangeBranch,
  onRefresh,
  onOpenFile,
  onSwitchRepo,
  onFileCreated,
}) => {
  const [filterText, setFilterText] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const directories = useMemo(() => {
    const dirs = new Set<string>();
    for (const f of files) {
      dirs.add(f.directory || 'root');
    }
    return ['ALL', ...Array.from(dirs).sort()];
  }, [files]);

  const visibleFiles = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return files.filter((f) => {
      const dirLabel = f.directory || 'root';
      if (selectedFolder !== 'ALL' && dirLabel !== selectedFolder) return false;
      if (!q) return true;
      return (
        f.displayName.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
      );
    });
  }, [files, filterText, selectedFolder]);

  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);
  const cardSpring = getSpring(reducedMotion, M3_EXPRESSIVE_SPRING);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-7 space-y-6 pb-24">
      {refreshing && (
        <div
          className="w-full h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
        >
          <div
            className="h-full w-1/3 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--m3-primary)' }}
          />
        </div>
      )}

      {/* Repository & Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2 text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
            <span className="font-mono">{repo.owner}</span>
            <span aria-hidden="true">/</span>
            <span className="font-mono font-medium" style={{ color: 'var(--m3-on-surface)' }}>
              {repo.name}
            </span>
            <span aria-hidden="true">·</span>
            <span>{repo.isPrivate ? t.privateLabel : t.publicLabel}</span>
            {!repo.canPush && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t.readOnlyLabel}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            {t.jsonDashboard}
          </h1>
          {lastRefreshSummary && (
            <p className="text-xs tabular-nums" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {lastRefreshSummary}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative inline-flex items-center">
            <GitBranch
              className="w-4 h-4 absolute left-3 pointer-events-none"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            />
            <select
              aria-label={t.defaultBranch}
              value={branch}
              onChange={(e) => onChangeBranch(e.target.value)}
              className="h-10 pl-9 pr-7 rounded-xl border text-xs font-mono font-medium focus:outline-none cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              {branches.length === 0 ? (
                <option value={branch}>{branch}</option>
              ) : (
                branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={chipSpring}
            onClick={onSwitchRepo}
            className="h-10 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
            }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{t.switchRepo}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={chipSpring}
            onClick={onRefresh}
            disabled={loading || refreshing}
            className="h-10 px-4 rounded-xl border text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? t.refreshing : t.refresh}</span>
          </motion.button>

          {repo.canPush && (
            <motion.button
              type="button"
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              transition={chipSpring}
              onClick={() => setShowCreateModal(true)}
              className="h-10 px-4 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>{t.createConfig}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Filter & Bouncy M3 Directory Chips */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          />
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by file or folder path..."
            aria-label="Filter discovered files"
            className="w-full h-11 pl-10 pr-4 rounded-2xl border text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          />
        </div>

        {directories.length > 2 && (
          <div
            className="flex items-center gap-1 p-1 rounded-2xl border overflow-x-auto"
            style={{
              backgroundColor: 'var(--m3-surface-container)',
              borderColor: 'var(--m3-outline-variant)',
            }}
          >
            {directories.slice(0, 7).map((dir) => {
              const active = selectedFolder === dir;
              return (
                <motion.button
                  key={dir}
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                  onClick={() => setSelectedFolder(dir)}
                  className="relative h-8 px-3 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  style={{
                    color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface-variant)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="dashboard-dir-pill"
                      transition={chipSpring}
                      className="absolute inset-0 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--m3-primary-container)',
                        borderColor: 'var(--m3-primary)',
                      }}
                    />
                  )}
                  <span className="relative z-10">{dir === 'ALL' ? 'All Paths' : dir}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {truncatedTree && (
        <div
          className="px-4 py-3 rounded-2xl border text-xs"
          style={{
            backgroundColor: 'var(--m3-surface-container)',
            borderColor: 'var(--m3-outline-variant)',
            color: 'var(--m3-on-surface-variant)',
          }}
        >
          Large repository tree detected; GitHub truncated the recursive listing at 100,000 entries.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl border flex items-center justify-between gap-4 bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-red-500/30 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Initial Skeleton Loading */}
      {loading && files.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 rounded-2xl border animate-pulse space-y-3"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline-variant)',
              }}
            >
              <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: 'var(--m3-surface-container-high)' }} />
              <div className="h-4 w-3/4 rounded-md" style={{ backgroundColor: 'var(--m3-surface-container-high)' }} />
              <div className="h-3 w-1/2 rounded-md" style={{ backgroundColor: 'var(--m3-surface-container)' }} />
            </div>
          ))}
        </div>
      ) : visibleFiles.length === 0 ? (
        <div
          className="p-12 rounded-3xl border text-center space-y-4"
          style={{
            backgroundColor: 'var(--m3-surface-container-low)',
            borderColor: 'var(--m3-outline-variant)',
          }}
        >
          <FolderOpen className="w-9 h-9 mx-auto opacity-50" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t.noConfigFiles}</p>
            <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {repo.canPush
                ? 'Create a configuration file directly in this branch to get started.'
                : 'Select another branch or repository to inspect configurations.'}
            </p>
          </div>
          {repo.canPush && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="h-11 px-5 rounded-xl text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>{t.createFirstConfig}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {visibleFiles.map((file, idx) => {
            const delaySec = reducedMotion ? 0 : Math.min(idx, 10) * 0.045;
            return (
              <motion.button
                key={file.path}
                type="button"
                initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...cardSpring, delay: delaySec }}
                whileHover={reducedMotion ? undefined : { y: -2, scale: 1.015 }}
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => onOpenFile(file)}
                className="group text-left p-4 sm:p-5 rounded-2xl border hover:shadow-sm flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  backgroundColor: 'var(--m3-surface-container-low)',
                  borderColor: 'var(--m3-outline-variant)',
                  color: 'var(--m3-on-surface)',
                }}
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  <CardLogoOrIcon logoUrl={file.cachedLogoUrl} name={file.displayName} />
                  {file.changeStatus && file.changeStatus !== 'unchanged' && (
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--m3-primary)' }}
                    >
                      {file.changeStatus === 'added' ? 'Added' : 'Updated'}
                    </span>
                  )}
                </div>

                <div className="space-y-1 w-full min-w-0">
                  <h2 className="font-display text-sm sm:text-base font-semibold truncate group-hover:underline decoration-1 underline-offset-2">
                    {file.displayName}
                  </h2>
                  <div
                    className="flex items-center gap-1.5 text-xs truncate tabular-nums"
                    style={{ color: 'var(--m3-on-surface-variant)' }}
                  >
                    <span className="truncate font-mono">{file.directory || 'root'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{formatBytes(file.size)}</span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {repo.canPush && visibleFiles.length > 0 && (
        <motion.button
          type="button"
          whileHover={reducedMotion ? undefined : { scale: 1.04 }}
          whileTap={reducedMotion ? undefined : { scale: 0.94 }}
          transition={chipSpring}
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-6 left-6 sm:left-auto sm:right-6 z-30 h-14 px-5 rounded-2xl shadow-lg font-medium text-sm inline-flex items-center gap-2.5 cursor-pointer"
          style={{
            backgroundColor: 'var(--m3-primary-container)',
            color: 'var(--m3-on-primary-container)',
          }}
        >
          <Plus className="w-5 h-5" />
          <span>{t.createConfig}</span>
        </motion.button>
      )}

      {showCreateModal && (
        <CreateJsonModal
          t={t}
          owner={repo.owner}
          repo={repo.name}
          branch={branch}
          canPush={repo.canPush}
          onClose={() => setShowCreateModal(false)}
          onCreated={(createdPath) => {
            setShowCreateModal(false);
            onFileCreated(createdPath);
          }}
        />
      )}
    </div>
  );
};
