export type AppRoute = 'splash' | 'auth' | 'repositories' | 'dashboard' | 'editor' | 'settings';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentPalette = 'warm-amber' | 'slate-indigo' | 'sage-teal' | 'terracotta';

export type AppLanguage = 'en' | 'bn' | 'hi';

export type MotionPreference = 'full' | 'reduced';

export type JsonValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface GitHubUserProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  publicRepos: number;
  privateRepos: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar: string;
  isPrivate: boolean;
  description: string | null;
  defaultBranch: string;
  updatedAt: string;
  htmlUrl: string;
  canPush: boolean;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

export interface DiscoveredJsonFile {
  path: string;
  directory: string;
  rawFilename: string;
  displayName: string; // Always stripped of .json
  sha: string;
  size: number;
  changeStatus?: 'added' | 'updated' | 'unchanged';
  cachedLogoUrl?: string | null;
}

export interface JsonDiffEntry {
  kind: 'added' | 'modified' | 'removed';
  path: string;
  oldValue?: string;
  newValue?: string;
}

export interface EditorDocument {
  path: string;
  displayName: string;
  sha: string;
  htmlUrl: string;
  originalRaw: string;
  originalData: unknown;
  editedData: unknown;
}

export interface SnackbarItem {
  id: string;
  message: string;
  tone: 'neutral' | 'success' | 'warning' | 'error';
}

export interface AiAuditFinding {
  severity: string;
  path: string;
  title: string;
  detail: string;
}

export interface AiAuditResult {
  verdict: string;
  riskLevel: string;
  summary: string;
  findings: AiAuditFinding[];
  recommendations: string[];
}

export interface AiArchitectResult {
  explanation: string;
  hasJsonPatch: boolean;
  updatedJson: string;
  changedPaths: string[];
}

export interface FileCommitEntry {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorLogin: string | null;
  authorAvatar: string | null;
  date: string;
  htmlUrl: string;
}

