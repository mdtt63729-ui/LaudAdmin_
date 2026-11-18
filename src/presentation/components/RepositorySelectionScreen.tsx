import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Lock, Globe, GitBranch, RefreshCw, AlertCircle, FolderGit2, ArrowRight } from 'lucide-react';
import type { GitHubRepo } from '../../domain/types';
import type { Translations } from '../../core/i18n';
import { M3_CHIP_SPRING, M3_EXPRESSIVE_SPRING, getSpring } from '../../core/motionPresets';
import { apiClient } from '../../data/apiClient';

interface RepositorySelectionScreenProps {
  t: Translations;
  repos: GitHubRepo[];
  loading: boolean;
  error: string | null;
  selectedRepoId: number | null;
  reducedMotion: boolean;
  onRefresh: () => void;
  onSelectRepo: (repo: GitHubRepo) => void;
}

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const RepositorySelectionScreen: React.FC<RepositorySelectionScreenProps> = ({
  t,
  repos,
  loading,
  error,
  selectedRepoId,
  reducedMotion,
  onRefresh,
  onSelectRepo,
}) => {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [directSlug, setDirectSlug] = useState('');
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim().toLowerCase());
    }, 220);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return repos;
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(debouncedQuery) ||
        r.owner.toLowerCase().includes(debouncedQuery) ||
        (r.description || '').toLowerCase().includes(debouncedQuery)
    );
  }, [repos, debouncedQuery]);

  const handleOpenDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = directSlug.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length < 2) {
      setDirectError('Enter repository as owner/repo');
      return;
    }
    setDirectError(null);
    setDirectLoading(true);
    try {
      const res = await apiClient.getRepo(parts[0], parts[1]);
      onSelectRepo(res.repo);
    } catch (err) {
      setDirectError(err instanceof Error ? err.message : 'Repository not found');
    } finally {
      setDirectLoading(false);
    }
  };

  const cardSpring = getSpring(reducedMotion, M3_EXPRESSIVE_SPRING);
  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            {t.selectRepository}
          </h1>
          <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
            Choose a repository to discover configuration files and manage releases.
          </p>
        </div>

        <motion.button
          type="button"
          whileTap={reducedMotion ? undefined : { scale: 0.95 }}
          transition={chipSpring}
          onClick={onRefresh}
          disabled={loading}
          className="h-10 px-4 rounded-xl border text-xs font-medium inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0 hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: 'var(--m3-surface-container-low)',
            borderColor: 'var(--m3-outline)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? t.refreshing : t.refresh}</span>
        </motion.button>
      </div>

      {/* Search + Direct Lookup Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 relative">
          <Search
            className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          />
          <input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder={t.searchRepositories}
            aria-label={t.searchRepositories}
            className="w-full h-12 pl-11 pr-4 rounded-2xl border text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          />
        </div>

        <form onSubmit={handleOpenDirect} className="lg:col-span-5 flex gap-2">
          <input
            type="text"
            value={directSlug}
            onChange={(e) => setDirectSlug(e.target.value)}
            placeholder="Open owner/repo directly..."
            aria-label="Open repository directly by owner and name"
            className="flex-1 h-12 px-4 rounded-2xl border text-sm font-mono focus:outline-none"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: directError ? '#DC2626' : 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          />
          <motion.button
            type="submit"
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={chipSpring}
            disabled={directLoading}
            className="h-12 px-4 rounded-2xl font-medium text-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: 'var(--m3-secondary-container)',
              color: 'var(--m3-on-secondary-container)',
            }}
          >
            <span>Open</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </form>
      </div>
      {directError && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">{directError}</p>
      )}

      {error && (
        <div
          role="alert"
          className="p-5 rounded-2xl border flex items-center justify-between gap-4 bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-red-500/30 hover:bg-red-500/10 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {loading && repos.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border animate-pulse space-y-3"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline-variant)',
              }}
            >
              <div className="h-5 w-2/3 rounded-md" style={{ backgroundColor: 'var(--m3-surface-container-high)' }} />
              <div className="h-4 w-full rounded-md" style={{ backgroundColor: 'var(--m3-surface-container)' }} />
              <div className="h-3 w-1/2 rounded-md" style={{ backgroundColor: 'var(--m3-surface-container)' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="p-12 rounded-3xl border text-center space-y-3"
          style={{
            backgroundColor: 'var(--m3-surface-container-low)',
            borderColor: 'var(--m3-outline-variant)',
          }}
        >
          <FolderGit2 className="w-8 h-8 mx-auto opacity-50" />
          <p className="text-sm font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
            {t.noRepositories}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((repo, idx) => {
            const isSelected = repo.id === selectedRepoId;
            return (
              <motion.button
                key={repo.id}
                type="button"
                initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...cardSpring, delay: reducedMotion ? 0 : Math.min(idx, 10) * 0.035 }}
                whileHover={reducedMotion ? undefined : { y: -2, scale: 1.015 }}
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => onSelectRepo(repo)}
                className="text-left p-5 rounded-2xl border flex flex-col justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--m3-primary-container)'
                    : 'var(--m3-surface-container-low)',
                  borderColor: isSelected ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                  color: isSelected ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                }}
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-base font-semibold truncate">{repo.name}</h2>
                    {repo.isPrivate ? (
                      <Lock className="w-4 h-4 shrink-0 opacity-75 mt-0.5" aria-label={t.privateLabel} />
                    ) : (
                      <Globe className="w-4 h-4 shrink-0 opacity-75 mt-0.5" aria-label={t.publicLabel} />
                    )}
                  </div>
                  <p
                    className="text-xs line-clamp-2 min-h-[2rem]"
                    style={{
                      color: isSelected
                        ? 'var(--m3-on-primary-container)'
                        : 'var(--m3-on-surface-variant)',
                    }}
                  >
                    {repo.description || `${repo.owner}/${repo.name}`}
                  </p>
                </div>

                <div
                  className="flex items-center flex-wrap gap-1.5 text-xs tabular-nums"
                  style={{
                    color: isSelected
                      ? 'var(--m3-on-primary-container)'
                      : 'var(--m3-on-surface-variant)',
                  }}
                >
                  <span className="truncate max-w-[110px]">{repo.owner}</span>
                  <span aria-hidden="true">·</span>
                  <span>{repo.isPrivate ? t.privateLabel : t.publicLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <GitBranch className="w-3 h-3" />
                    {repo.defaultBranch}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRelativeDate(repo.updatedAt)}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};
