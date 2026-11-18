import type {
  AiArchitectResult,
  AiAuditResult,
  DiscoveredJsonFile,
  FileCommitEntry,
  GitHubBranch,
  GitHubRepo,
  GitHubUserProfile,
  JsonDiffEntry,
} from '../domain/types';

const SESSION_KEY = 'lauda_session_id';

export function getStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const sid = getStoredSessionId();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (sid) {
    headers.set('X-Lauda-Session', sid);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, credentials: 'include' });
  } catch {
    throw new Error('Network unavailable');
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  if (!res.ok) {
    const err = new Error(String(parsed.error || 'Request failed')) as Error & {
      status?: number;
      code?: string;
      remoteSha?: string;
      remoteContent?: string;
    };
    err.status = res.status;
    err.code = typeof parsed.code === 'string' ? parsed.code : undefined;
    err.remoteSha = typeof parsed.remoteSha === 'string' ? parsed.remoteSha : undefined;
    err.remoteContent = typeof parsed.remoteContent === 'string' ? parsed.remoteContent : undefined;
    throw err;
  }

  return parsed as unknown as T;
}

export const apiClient = {
  connectToken(token: string) {
    return apiFetch<{
      sessionId: string;
      user: GitHubUserProfile;
      rateLimitRemaining?: number;
    }>('/api/auth/connect', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  checkSession() {
    return apiFetch<{
      authenticated: boolean;
      sessionId?: string;
      user?: GitHubUserProfile;
      rateLimit?: { remaining: number; limit: number; reset: number } | null;
    }>('/api/auth/session');
  },

  disconnect() {
    return apiFetch<{ ok: boolean }>('/api/auth/disconnect', { method: 'POST' });
  },

  listRepos(page = 1, perPage = 60) {
    return apiFetch<{
      repos: GitHubRepo[];
      hasMore: boolean;
      rateLimitRemaining?: number;
    }>(`/api/github/repos?page=${page}&perPage=${perPage}`);
  },

  getRepo(owner: string, repo: string) {
    return apiFetch<{
      repo: GitHubRepo;
      rateLimitRemaining?: number;
    }>(`/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
  },

  listBranches(owner: string, repo: string) {
    return apiFetch<{ branches: GitHubBranch[] }>(
      `/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`
    );
  },

  discoverJsonFiles(owner: string, repo: string, branch: string) {
    return apiFetch<{
      treeSha: string;
      truncated: boolean;
      files: DiscoveredJsonFile[];
      rateLimitRemaining?: number;
    }>(
      `/api/github/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`
    );
  },

  getFile(owner: string, repo: string, path: string, branch: string) {
    return apiFetch<{
      path: string;
      name: string;
      sha: string;
      size: number;
      htmlUrl: string;
      content: string;
      rateLimitRemaining?: number;
    }>(
      `/api/github/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`
    );
  },

  getFileHistory(owner: string, repo: string, path: string, branch: string) {
    return apiFetch<{
      commits: FileCommitEntry[];
    }>(
      `/api/github/file-history?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`
    );
  },

  getFileAtCommit(owner: string, repo: string, path: string, ref: string) {
    return apiFetch<{
      sha: string;
      path: string;
      content: string;
    }>(
      `/api/github/file-at-commit?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`
    );
  },

  commitFile(payload: {
    owner: string;
    repo: string;
    path: string;
    branch: string;
    content: string;
    message: string;
    expectedSha?: string;
    isCreate?: boolean;
  }) {
    return apiFetch<{
      sha: string;
      path: string;
      htmlUrl: string;
      commitSha: string;
      commitUrl: string;
    }>('/api/github/file', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  uploadAsset(payload: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    base64Data: string;
  }) {
    return apiFetch<{
      url: string;
      path: string;
      sha: string;
    }>('/api/github/upload-asset', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  runDeepThink(payload: {
    mode: 'audit' | 'architect';
    filePath: string;
    originalJson: string;
    editedJson: string;
    diffSummary?: JsonDiffEntry[];
    prompt?: string;
    useStandardFallback?: boolean;
  }) {
    return apiFetch<{
      model: string;
      result: AiAuditResult | AiArchitectResult;
    }>('/api/ai/think', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
