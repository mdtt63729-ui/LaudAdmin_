import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, KeyRound, FolderGit2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { apiClient, setStoredSessionId } from '../../data/apiClient';
import type { GitHubRepo, GitHubUserProfile } from '../../domain/types';
import type { Translations } from '../../core/i18n';
import { LaudaLogo } from './LaudaLogo';

interface AuthScreenProps {
  t: Translations;
  onAuthenticated: (user: GitHubUserProfile) => void;
  onOpenPublicRepo: (repo: GitHubRepo) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  t,
  onAuthenticated,
  onOpenPublicRepo,
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [publicSlug, setPublicSlug] = useState('');
  const [openingPublic, setOpeningPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setAuthError('Please enter a GitHub Personal Access Token.');
      return;
    }
    setAuthError(null);
    setConnecting(true);
    try {
      const res = await apiClient.connectToken(token.trim());
      setStoredSessionId(res.sessionId);
      setToken('');
      onAuthenticated(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid GitHub token');
    } finally {
      setConnecting(false);
    }
  };

  const handleExplorePublic = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = publicSlug.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length < 2) {
      setPublicError('Enter repository as owner/repo (for example: facebook/react).');
      return;
    }
    setPublicError(null);
    setOpeningPublic(true);
    try {
      const res = await apiClient.getRepo(parts[0], parts[1]);
      onOpenPublicRepo(res.repo);
    } catch (err) {
      setPublicError(err instanceof Error ? err.message : 'Repository not found');
    } finally {
      setOpeningPublic(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center px-4 sm:px-8 py-10"
      style={{ backgroundColor: 'var(--m3-surface)', color: 'var(--m3-on-surface)' }}
    >
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Left Context Column */}
        <div className="lg:col-span-5 flex flex-col justify-between py-2 space-y-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3.5">
              <LaudaLogo size={44} />
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight">{t.appName}</h1>
                <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  {t.tagline}
                </p>
              </div>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-balance">
              Manage remote JSON configurations directly on GitHub.
            </h2>

            <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Discover configuration trees automatically, edit arbitrary nested objects and arrays with strict type preservation, detect remote SHA conflicts before overwriting, and commit straight to your repository.
            </p>
          </div>

          <div
            className="p-5 rounded-2xl border space-y-2.5"
            style={{
              backgroundColor: 'var(--m3-surface-container)',
              borderColor: 'var(--m3-outline-variant)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: 'var(--m3-primary)' }} />
              <h3 className="font-display text-sm font-semibold">{t.securityNoteTitle}</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {t.securityNoteBody}
            </p>
          </div>
        </div>

        {/* Right Interactive Authentication Card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <form
            onSubmit={handleConnect}
            className="p-6 sm:p-8 rounded-3xl border space-y-5 transition-colors duration-200"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--m3-primary-container)',
                  color: 'var(--m3-on-primary-container)',
                }}
              >
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">{t.connectGithub}</h2>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Use a fine-grained or classic PAT with repository contents access.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="pat-input"
                className="block text-xs font-medium"
                style={{ color: 'var(--m3-on-surface-variant)' }}
              >
                {t.patLabel}
              </label>
              <div className="relative">
                <input
                  id="pat-input"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t.patPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-12 pl-4 pr-12 rounded-xl border text-sm font-mono focus:outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: authError ? '#DC2626' : 'var(--m3-outline)',
                    color: 'var(--m3-on-surface)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--m3-on-surface-variant)' }}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={connecting}
              className="w-full h-12 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.connecting}</span>
                </>
              ) : (
                <>
                  <span>{t.connectButton}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Optional Public Repository Inspector */}
          <form
            onSubmit={handleExplorePublic}
            className="p-6 rounded-3xl border space-y-4"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline-variant)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--m3-secondary-container)',
                  color: 'var(--m3-on-secondary-container)',
                }}
              >
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold">{t.explorePublicTitle}</h3>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  {t.explorePublicHint}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value)}
                placeholder="owner/repository"
                aria-label="Public repository owner and name"
                className="flex-1 h-11 px-4 rounded-xl border text-sm font-mono focus:outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface)',
                  borderColor: publicError ? '#DC2626' : 'var(--m3-outline)',
                  color: 'var(--m3-on-surface)',
                }}
              />
              <button
                type="submit"
                disabled={openingPublic}
                className="h-11 px-5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-surface-container)',
                  borderColor: 'var(--m3-outline)',
                  color: 'var(--m3-on-surface)',
                }}
              >
                {openingPublic ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{t.exploreButton}</span>
              </button>
            </div>

            {publicError && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{publicError}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
