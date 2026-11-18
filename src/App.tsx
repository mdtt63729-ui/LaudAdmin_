import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Settings, WifiOff, Maximize2, Minimize2 } from 'lucide-react';
import type {
  AccentPalette,
  AppLanguage,
  AppRoute,
  DiscoveredJsonFile,
  EditorDocument,
  GitHubBranch,
  GitHubRepo,
  GitHubUserProfile,
  MotionPreference,
  SnackbarItem,
  ThemeMode,
} from './domain/types';
import { getTranslations } from './core/i18n';
import { deepCloneJson, extractLogoUrl } from './core/jsonEngine';
import { M3_CHIP_SPRING, M3_EXPRESSIVE_SPRING, getSpring } from './core/motionPresets';
import { apiClient, setStoredSessionId } from './data/apiClient';
import { LaudaLogo } from './presentation/components/LaudaLogo';
import { SplashView } from './presentation/components/SplashView';
import { AuthScreen } from './presentation/components/AuthScreen';
import { RepositorySelectionScreen } from './presentation/components/RepositorySelectionScreen';
import { DashboardScreen } from './presentation/components/DashboardScreen';
import { JsonEditorScreen } from './presentation/components/JsonEditorScreen';
import { SettingsScreen } from './presentation/components/SettingsScreen';
import { SnackbarHost } from './presentation/components/SnackbarHost';
import { FileOpeningOverlay } from './presentation/components/ContainedLoadingIndicator';

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return (val as T) || fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => readPref('lauda_theme', 'system'));
  const [accent, setAccent] = useState<AccentPalette>(() => readPref('lauda_accent', 'warm-amber'));
  const [motionPref, setMotionPref] = useState<MotionPreference>(() => readPref('lauda_motion', 'full'));
  const [language, setLanguage] = useState<AppLanguage>(() => readPref('lauda_lang', 'en'));

  const t = getTranslations(language);
  const reducedMotion = motionPref === 'reduced';
  const routeSpring = getSpring(reducedMotion, M3_EXPRESSIVE_SPRING);
  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);

  const [route, setRoute] = useState<AppRoute>('splash');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const [user, setUser] = useState<GitHubUserProfile | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);

  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [activeBranch, setActiveBranch] = useState<string>('main');
  const [branches, setBranches] = useState<GitHubBranch[]>([]);

  const [files, setFiles] = useState<DiscoveredJsonFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesRefreshing, setFilesRefreshing] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [truncatedTree, setTruncatedTree] = useState(false);
  const [lastRefreshSummary, setLastRefreshSummary] = useState<string | null>(null);
  const [logoCache, setLogoCache] = useState<Record<string, string | null>>({});

  const [editorDoc, setEditorDoc] = useState<EditorDocument | null>(null);
  const [openingFile, setOpeningFile] = useState(false);
  const [openingFileName, setOpeningFileName] = useState<string | null>(null);
  const [snackbars, setSnackbars] = useState<SnackbarItem[]>([]);

  const notify = useCallback(
    (message: string, tone: SnackbarItem['tone'] = 'neutral') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setSnackbars((prev) => [...prev.slice(-2), { id, message, tone }]);
      setTimeout(() => {
        setSnackbars((prev) => prev.filter((item) => item.id !== id));
      }, 3600);
    },
    []
  );

  // Fullscreen state sync
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      notify('Fullscreen is restricted by the current embed container.', 'neutral');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark = theme === 'dark' || (theme === 'system' && prefersDark);
      root.classList.toggle('dark', shouldDark);
    };
    applyDark();
    try {
      localStorage.setItem('lauda_theme', theme);
    } catch {
      // Ignore
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyDark);
    return () => mq.removeEventListener('change', applyDark);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    try {
      localStorage.setItem('lauda_accent', accent);
    } catch {
      // Ignore
    }
  }, [accent]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    try {
      localStorage.setItem('lauda_motion', motionPref);
    } catch {
      // Ignore
    }
  }, [motionPref, reducedMotion]);

  useEffect(() => {
    try {
      localStorage.setItem('lauda_lang', language);
    } catch {
      // Ignore
    }
  }, [language]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const loadRepositories = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const res = await apiClient.listRepos(1, 60);
      setRepos(res.repos);
    } catch (err) {
      setReposError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setReposLoading(false);
    }
  }, []);

  const loadTree = useCallback(
    async (repo: GitHubRepo, branch: string, isRefresh = false) => {
      if (isRefresh) setFilesRefreshing(true);
      else setFilesLoading(true);
      setFilesError(null);

      try {
        const treeRes = await apiClient.discoverJsonFiles(repo.owner, repo.name, branch);
        setTruncatedTree(treeRes.truncated);

        setFiles((prevFiles) => {
          if (!isRefresh || prevFiles.length === 0) {
            return treeRes.files.map((f) => ({
              ...f,
              changeStatus: 'unchanged',
              cachedLogoUrl: logoCache[f.path] ?? null,
            }));
          }

          const prevMap = new Map(prevFiles.map((f) => [f.path, f]));
          const nextPaths = new Set(treeRes.files.map((f) => f.path));

          let added = 0;
          let updated = 0;
          let removed = 0;

          for (const oldPath of prevMap.keys()) {
            if (!nextPaths.has(oldPath)) removed++;
          }

          const merged: DiscoveredJsonFile[] = treeRes.files.map((f) => {
            const existing = prevMap.get(f.path);
            if (!existing) {
              added++;
              return { ...f, changeStatus: 'added', cachedLogoUrl: logoCache[f.path] ?? null };
            }
            if (existing.sha !== f.sha) {
              updated++;
              return { ...f, changeStatus: 'updated', cachedLogoUrl: logoCache[f.path] ?? null };
            }
            return {
              ...f,
              changeStatus: 'unchanged',
              cachedLogoUrl: existing.cachedLogoUrl ?? logoCache[f.path] ?? null,
            };
          });

          const summaryParts: string[] = [];
          if (added > 0) summaryParts.push(`${added} added`);
          if (updated > 0) summaryParts.push(`${updated} updated`);
          if (removed > 0) summaryParts.push(`${removed} deleted`);
          const summary =
            summaryParts.length > 0
              ? `Refresh completed · ${summaryParts.join(', ')}`
              : 'Refresh completed · Up to date';
          setLastRefreshSummary(summary);
          notify(summary, added + updated + removed > 0 ? 'neutral' : 'success');

          return merged;
        });
      } catch (err) {
        setFilesError(err instanceof Error ? err.message : 'Failed to discover files');
      } finally {
        setFilesLoading(false);
        setFilesRefreshing(false);
      }
    },
    [logoCache, notify]
  );

  const handleSplashComplete = useCallback(async () => {
    try {
      const session = await apiClient.checkSession();
      if (session.authenticated && session.user) {
        setUser(session.user);
        setRoute('repositories');
        loadRepositories();
        return;
      }
    } catch {
      // Proceed to auth
    }
    setRoute('auth');
  }, [loadRepositories]);

  const handleAuthenticated = (profile: GitHubUserProfile) => {
    setUser(profile);
    setRoute('repositories');
    loadRepositories();
    notify(`Connected as @${profile.login}`, 'success');
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setActiveBranch(repo.defaultBranch);
    setFiles([]);
    setLastRefreshSummary(null);
    setRoute('dashboard');

    apiClient
      .listBranches(repo.owner, repo.name)
      .then((res) => setBranches(res.branches))
      .catch(() => setBranches([{ name: repo.defaultBranch, protected: false }]));

    loadTree(repo, repo.defaultBranch, false);
  };

  const handleChangeBranch = (branch: string) => {
    if (!selectedRepo) return;
    setActiveBranch(branch);
    setFiles([]);
    setLastRefreshSummary(null);
    loadTree(selectedRepo, branch, false);
  };

  const handleOpenFile = async (file: DiscoveredJsonFile) => {
    if (!selectedRepo) return;
    setOpeningFileName(file.displayName);
    setOpeningFile(true);
    try {
      const remote = await apiClient.getFile(
        selectedRepo.owner,
        selectedRepo.name,
        file.path,
        activeBranch
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(remote.content);
      } catch {
        notify('Selected file contains invalid syntax and cannot be opened in visual mode.', 'error');
        setOpeningFile(false);
        return;
      }

      const detectedLogo = extractLogoUrl(parsed);
      if (detectedLogo) {
        setLogoCache((prev) => ({ ...prev, [file.path]: detectedLogo }));
        setFiles((prev) =>
          prev.map((item) =>
            item.path === file.path ? { ...item, cachedLogoUrl: detectedLogo } : item
          )
        );
      }

      setEditorDoc({
        path: remote.path,
        displayName: file.displayName,
        sha: remote.sha,
        htmlUrl: remote.htmlUrl,
        originalRaw: remote.content,
        originalData: deepCloneJson(parsed),
        editedData: parsed,
      });
      setRoute('editor');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to open file', 'error');
    } finally {
      setOpeningFile(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiClient.disconnect();
    } catch {
      // Ignore
    }
    setStoredSessionId(null);
    setUser(null);
    setRepos([]);
    setSelectedRepo(null);
    setFiles([]);
    setEditorDoc(null);
    setRoute('auth');
  };

  if (route === 'splash') {
    return (
      <SplashView
        onComplete={handleSplashComplete}
        reducedMotion={reducedMotion}
      />
    );
  }

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
    <div
      className="min-h-screen w-full flex flex-col overflow-x-hidden"
      style={{ backgroundColor: 'var(--m3-surface)', color: 'var(--m3-on-surface)' }}
    >
      {/* Top Bar (Clean 3-Zone Contract, Full-Width Edge-to-Edge) */}
      <header
        className="sticky top-0 z-30 h-16 w-full px-4 sm:px-6 lg:px-10 border-b backdrop-blur-md flex items-center justify-between gap-8"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--m3-surface) 90%, transparent)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            if (selectedRepo) setRoute('dashboard');
            else if (user) setRoute('repositories');
            else setRoute('auth');
          }}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <LaudaLogo size={30} />
          <span className="font-display text-base font-bold tracking-tight">{t.appName}</span>
        </button>

        {/* Zone 2: Bouncy M3 Navigation Chips */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl" aria-label="Primary navigation">
          {user && (
            <button
              type="button"
              onClick={() => setRoute('repositories')}
              className="relative px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                color:
                  route === 'repositories' ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface-variant)',
              }}
            >
              {route === 'repositories' && (
                <motion.span
                  layoutId="top-nav-pill"
                  transition={chipSpring}
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'var(--m3-primary-container)' }}
                />
              )}
              <span className="relative z-10">{t.repositories}</span>
            </button>
          )}
          {selectedRepo && (
            <button
              type="button"
              onClick={() => setRoute('dashboard')}
              className="relative px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                color:
                  route === 'dashboard' ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface-variant)',
              }}
            >
              {route === 'dashboard' && (
                <motion.span
                  layoutId="top-nav-pill"
                  transition={chipSpring}
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'var(--m3-primary-container)' }}
                />
              )}
              <span className="relative z-10">{t.jsonDashboard}</span>
            </button>
          )}
          {editorDoc && (
            <button
              type="button"
              onClick={() => setRoute('editor')}
              className="relative px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              style={{
                color:
                  route === 'editor' ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface-variant)',
              }}
            >
              {route === 'editor' && (
                <motion.span
                  layoutId="top-nav-pill"
                  transition={chipSpring}
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'var(--m3-primary-container)' }}
                />
              )}
              <span className="relative z-10">{editorDoc.displayName}</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Fullscreen + Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <span
              className="hidden sm:inline text-xs font-mono truncate max-w-[140px]"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              @{user.login}
            </span>
          )}
          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
            transition={chipSpring}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
            title={isFullscreen ? t.exitFullscreen : t.fullscreen}
            className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline)',
              color: 'var(--m3-on-surface)',
            }}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </motion.button>
          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : { scale: 0.94 }}
            transition={chipSpring}
            onClick={() =>
              setRoute(
                route === 'settings'
                  ? selectedRepo
                    ? 'dashboard'
                    : user
                    ? 'repositories'
                    : 'auth'
                  : 'settings'
              )
            }
            aria-label={t.settings}
            className="h-10 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor:
                route === 'settings'
                  ? 'var(--m3-primary-container)'
                  : 'var(--m3-surface-container-low)',
              borderColor: route === 'settings' ? 'var(--m3-primary)' : 'var(--m3-outline)',
              color:
                route === 'settings'
                  ? 'var(--m3-on-primary-container)'
                  : 'var(--m3-on-surface)',
            }}
          >
            <Settings className="w-4 h-4" />
            <span>{t.settings}</span>
          </motion.button>
        </div>
      </header>

      {isOffline && (
        <div
          role="status"
          className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>{t.offlineBanner}</span>
        </div>
      )}

      <FileOpeningOverlay
        visible={openingFile}
        fileName={openingFileName}
        reducedMotion={reducedMotion}
      />

      {/* Full-Screen Animated Route Viewport */}
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          {route === 'auth' && (
            <motion.div
              key="route-auth"
              initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
              transition={routeSpring}
            >
              <AuthScreen
                t={t}
                onAuthenticated={handleAuthenticated}
                onOpenPublicRepo={handleSelectRepo}
              />
            </motion.div>
          )}

          {route === 'repositories' && (
            <motion.div
              key="route-repositories"
              initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
              transition={routeSpring}
            >
              <RepositorySelectionScreen
                t={t}
                repos={repos}
                loading={reposLoading}
                error={reposError}
                selectedRepoId={selectedRepo?.id ?? null}
                reducedMotion={reducedMotion}
                onRefresh={loadRepositories}
                onSelectRepo={handleSelectRepo}
              />
            </motion.div>
          )}

          {route === 'dashboard' && selectedRepo && (
            <motion.div
              key="route-dashboard"
              initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
              transition={routeSpring}
            >
              <DashboardScreen
                t={t}
                repo={selectedRepo}
                branch={activeBranch}
                branches={branches}
                files={files}
                loading={filesLoading}
                refreshing={filesRefreshing}
                error={filesError}
                truncatedTree={truncatedTree}
                reducedMotion={reducedMotion}
                lastRefreshSummary={lastRefreshSummary}
                onChangeBranch={handleChangeBranch}
                onRefresh={() => loadTree(selectedRepo, activeBranch, true)}
                onOpenFile={handleOpenFile}
                onSwitchRepo={() => {
                  if (user) setRoute('repositories');
                  else setRoute('auth');
                }}
                onFileCreated={(createdPath) => {
                  notify(`Created ${createdPath.replace(/\.json$/i, '')}`, 'success');
                  loadTree(selectedRepo, activeBranch, true);
                }}
              />
            </motion.div>
          )}

          {route === 'editor' && selectedRepo && editorDoc && (
            <motion.div
              key={`route-editor-${editorDoc.path}`}
              initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
              transition={routeSpring}
            >
              <JsonEditorScreen
                t={t}
                repo={selectedRepo}
                branch={activeBranch}
                doc={editorDoc}
                isOffline={isOffline}
                reducedMotion={reducedMotion}
                onBack={() => {
                  setRoute('dashboard');
                  loadTree(selectedRepo, activeBranch, true);
                }}
                onUpdateDoc={(nextDoc) => {
                  setEditorDoc(nextDoc);
                  const detectedLogo = extractLogoUrl(nextDoc.editedData);
                  if (detectedLogo) {
                    setLogoCache((prev) => ({ ...prev, [nextDoc.path]: detectedLogo }));
                  }
                }}
                onNotify={notify}
              />
            </motion.div>
          )}

          {route === 'settings' && (
            <motion.div
              key="route-settings"
              initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10, scale: 0.99 }}
              transition={routeSpring}
            >
              <SettingsScreen
                t={t}
                user={user}
                theme={theme}
                accent={accent}
                motionMode={motionPref}
                language={language}
                onChangeTheme={setTheme}
                onChangeAccent={setAccent}
                onChangeMotion={setMotionPref}
                onChangeLanguage={setLanguage}
                onDisconnect={handleDisconnect}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SnackbarHost
        items={snackbars}
        onDismiss={(id) => setSnackbars((prev) => prev.filter((s) => s.id !== id))}
      />
    </div>
    </MotionConfig>
  );
}
