import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = Number(process.env.PORT || 3000);
const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 15000;

// Ephemeral AES-256-GCM key for encrypting GitHub PATs in server memory.
// Never persisted to disk, never logged, never returned to browser clients.
const SERVER_SECRET = crypto
  .createHash('sha256')
  .update(process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'))
  .digest();

interface EncryptedSession {
  iv: string;
  tag: string;
  ciphertext: string;
  user: GitHubUser;
  createdAt: number;
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  total_private_repos?: number;
}

const sessionVault = new Map<string, EncryptedSession>();

function encryptToken(token: string): { iv: string; tag: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SERVER_SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

function decryptToken(entry: EncryptedSession): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    SERVER_SECRET,
    Buffer.from(entry.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(entry.ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function getSessionId(req: Request): string | null {
  const headerId = req.header('x-lauda-session');
  if (headerId && sessionVault.has(headerId)) return headerId;
  const cookies = parseCookies(req.headers.cookie);
  const cookieId = cookies.lauda_sid;
  if (cookieId && sessionVault.has(cookieId)) return cookieId;
  return null;
}

function getSessionToken(req: Request): { sessionId: string; token: string; user: GitHubUser } | null {
  const sid = getSessionId(req);
  if (!sid) return null;
  const entry = sessionVault.get(sid);
  if (!entry) return null;
  return {
    sessionId: sid,
    token: decryptToken(entry),
    user: entry.user,
  };
}

function encodeGitHubPath(repoPath: string): string {
  return repoPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

interface GitHubFetchResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  errorMessage?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

function mapGitHubError(status: number, ghMessage?: string, remaining?: string | null): string {
  if (status === 401) return 'Invalid GitHub token';
  if (status === 403) {
    if (remaining === '0' || (ghMessage && ghMessage.toLowerCase().includes('rate limit'))) {
      return 'GitHub rate limit reached';
    }
    return 'Permission denied';
  }
  if (status === 404) return 'Repository or file not found';
  if (status === 409 || status === 422) return 'Remote file changed';
  if (status >= 500) return 'GitHub service temporarily unavailable';
  return ghMessage || 'GitHub request failed';
}

async function githubRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    retries?: number;
  } = {}
): Promise<GitHubFetchResult<T>> {
  const method = options.method || 'GET';
  const maxRetries = options.retries ?? (method === 'GET' ? 1 : 0);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'LAUDA-Admin-Console',
      };
      if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
      }
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${GITHUB_API}${endpoint}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const remainingHeader = res.headers.get('x-ratelimit-remaining');
      const resetHeader = res.headers.get('x-ratelimit-reset');
      const rateLimitRemaining = remainingHeader !== null ? Number(remainingHeader) : undefined;
      const rateLimitReset = resetHeader !== null ? Number(resetHeader) : undefined;

      const text = await res.text();
      let parsed: T | null = null;
      if (text) {
        try {
          parsed = JSON.parse(text) as T;
        } catch {
          parsed = null;
        }
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        const ghMsg =
          parsed && typeof parsed === 'object' && 'message' in parsed
            ? String((parsed as { message?: unknown }).message)
            : undefined;
        return {
          ok: false,
          status: res.status,
          data: parsed,
          errorMessage: mapGitHubError(res.status, ghMsg, remainingHeader),
          rateLimitRemaining,
          rateLimitReset,
        };
      }

      return {
        ok: true,
        status: res.status,
        data: parsed,
        rateLimitRemaining,
        rateLimitReset,
      };
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        status: isAbort ? 504 : 503,
        data: null,
        errorMessage: isAbort ? 'GitHub request timed out' : 'Network unavailable',
      };
    }
  }

  return {
    ok: false,
    status: 503,
    data: null,
    errorMessage: 'Network unavailable',
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // --- Auth Endpoints ---
  app.post('/api/auth/connect', async (req: Request, res: Response) => {
    const rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!rawToken) {
      res.status(400).json({ error: 'Personal Access Token is required.' });
      return;
    }

    const userRes = await githubRequest<GitHubUser>('/user', { token: rawToken });
    if (!userRes.ok || !userRes.data) {
      res.status(userRes.status).json({
        error: userRes.errorMessage || 'Invalid GitHub token',
      });
      return;
    }

    const sessionId = crypto.randomUUID();
    const encrypted = encryptToken(rawToken);
    sessionVault.set(sessionId, {
      ...encrypted,
      user: userRes.data,
      createdAt: Date.now(),
    });

    const isHttps = req.protocol === 'https' || req.header('x-forwarded-proto') === 'https';
    res.cookie('lauda_sid', sessionId, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      maxAge: 1000 * 60 * 60 * 12,
    });

    res.json({
      sessionId,
      user: {
        login: userRes.data.login,
        name: userRes.data.name,
        avatarUrl: userRes.data.avatar_url,
        htmlUrl: userRes.data.html_url,
        publicRepos: userRes.data.public_repos,
        privateRepos: userRes.data.total_private_repos ?? 0,
      },
      rateLimitRemaining: userRes.rateLimitRemaining,
      rateLimitReset: userRes.rateLimitReset,
    });
  });

  app.get('/api/auth/session', async (req: Request, res: Response) => {
    const session = getSessionToken(req);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }

    const rateRes = await githubRequest<{
      resources?: { core?: { remaining?: number; limit?: number; reset?: number } };
    }>('/rate_limit', { token: session.token });

    res.json({
      authenticated: true,
      sessionId: session.sessionId,
      user: {
        login: session.user.login,
        name: session.user.name,
        avatarUrl: session.user.avatar_url,
        htmlUrl: session.user.html_url,
        publicRepos: session.user.public_repos,
        privateRepos: session.user.total_private_repos ?? 0,
      },
      rateLimit: rateRes.data?.resources?.core ?? null,
    });
  });

  app.post('/api/auth/disconnect', (req: Request, res: Response) => {
    const sid = getSessionId(req);
    if (sid) {
      sessionVault.delete(sid);
    }
    res.clearCookie('lauda_sid');
    res.json({ ok: true });
  });

  // --- GitHub Repository Endpoints ---
  app.get('/api/github/repos', async (req: Request, res: Response) => {
    const session = getSessionToken(req);
    if (!session) {
      res.status(401).json({ error: 'GitHub authentication required' });
      return;
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.min(100, Math.max(10, Number(req.query.perPage || 60)));

    const result = await githubRequest<
      Array<{
        id: number;
        name: string;
        full_name: string;
        private: boolean;
        description: string | null;
        default_branch: string;
        updated_at: string;
        html_url: string;
        owner: { login: string; avatar_url: string };
        permissions?: { push?: boolean; admin?: boolean };
      }>
    >(
      `/user/repos?sort=updated&direction=desc&per_page=${perPage}&page=${page}&affiliation=owner,collaborator,organization_member`,
      { token: session.token }
    );

    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.errorMessage || 'Failed to load repositories' });
      return;
    }

    res.json({
      repos: result.data.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        ownerAvatar: r.owner.avatar_url,
        isPrivate: r.private,
        description: r.description,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        htmlUrl: r.html_url,
        canPush: r.permissions?.push ?? true,
      })),
      hasMore: result.data.length === perPage,
      rateLimitRemaining: result.rateLimitRemaining,
    });
  });

  app.get('/api/github/repo', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    if (!owner || !repo) {
      res.status(400).json({ error: 'owner and repo are required' });
      return;
    }

    const session = getSessionToken(req);
    const result = await githubRequest<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      description: string | null;
      default_branch: string;
      updated_at: string;
      html_url: string;
      owner: { login: string; avatar_url: string };
      permissions?: { push?: boolean };
    }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      token: session?.token ?? null,
    });

    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.errorMessage || 'Repository not found' });
      return;
    }

    const r = result.data;
    res.json({
      repo: {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        owner: r.owner.login,
        ownerAvatar: r.owner.avatar_url,
        isPrivate: r.private,
        description: r.description,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        htmlUrl: r.html_url,
        canPush: session ? (r.permissions?.push ?? true) : false,
      },
      rateLimitRemaining: result.rateLimitRemaining,
    });
  });

  app.get('/api/github/branches', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    if (!owner || !repo) {
      res.status(400).json({ error: 'owner and repo are required' });
      return;
    }
    const session = getSessionToken(req);
    const result = await githubRequest<Array<{ name: string; protected: boolean }>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      { token: session?.token ?? null }
    );
    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.errorMessage || 'Failed to load branches' });
      return;
    }
    res.json({ branches: result.data });
  });

  app.get('/api/github/tree', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    const branch = String(req.query.branch || 'main').trim();
    if (!owner || !repo) {
      res.status(400).json({ error: 'owner and repo are required' });
      return;
    }

    const session = getSessionToken(req);
    const result = await githubRequest<{
      sha: string;
      truncated: boolean;
      tree: Array<{ path: string; type: string; sha: string; size?: number }>;
    }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { token: session?.token ?? null }
    );

    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.errorMessage || 'Failed to discover repository tree' });
      return;
    }

    const jsonFiles = result.data.tree
      .filter((item) => item.type === 'blob' && item.path.toLowerCase().endsWith('.json'))
      .map((item) => {
        const lastSlash = item.path.lastIndexOf('/');
        const directory = lastSlash >= 0 ? item.path.slice(0, lastSlash + 1) : '';
        const rawFilename = lastSlash >= 0 ? item.path.slice(lastSlash + 1) : item.path;
        const displayName = rawFilename.replace(/\.json$/i, '');
        return {
          path: item.path,
          directory,
          rawFilename,
          displayName,
          sha: item.sha,
          size: item.size ?? 0,
        };
      });

    res.json({
      treeSha: result.data.sha,
      truncated: result.data.truncated,
      files: jsonFiles,
      rateLimitRemaining: result.rateLimitRemaining,
    });
  });

  app.get('/api/github/file', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    const filePath = String(req.query.path || '').trim();
    const branch = String(req.query.branch || 'main').trim();

    if (!owner || !repo || !filePath) {
      res.status(400).json({ error: 'owner, repo, and path are required' });
      return;
    }

    const session = getSessionToken(req);
    const result = await githubRequest<{
      name: string;
      path: string;
      sha: string;
      size: number;
      content?: string;
      encoding?: string;
      html_url: string;
    }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`,
      { token: session?.token ?? null }
    );

    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.errorMessage || 'Failed to load file' });
      return;
    }

    const encoded = (result.data.content || '').replace(/\n/g, '');
    const decoded = encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';

    res.json({
      path: result.data.path,
      name: result.data.name,
      sha: result.data.sha,
      size: result.data.size,
      htmlUrl: result.data.html_url,
      content: decoded,
      rateLimitRemaining: result.rateLimitRemaining,
    });
  });

  app.get('/api/github/file-sha', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    const filePath = String(req.query.path || '').trim();
    const branch = String(req.query.branch || 'main').trim();

    if (!owner || !repo || !filePath) {
      res.status(400).json({ error: 'owner, repo, and path are required' });
      return;
    }

    const session = getSessionToken(req);
    const result = await githubRequest<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`,
      { token: session?.token ?? null }
    );

    if (!result.ok || !result.data) {
      res.status(result.status).json({ error: result.errorMessage || 'Failed to check remote SHA' });
      return;
    }

    res.json({ sha: result.data.sha });
  });

  app.get('/api/github/file-history', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    const filePath = String(req.query.path || '').trim();
    const branch = String(req.query.branch || 'main').trim();

    if (!owner || !repo || !filePath) {
      res.status(400).json({ error: 'owner, repo, and path are required' });
      return;
    }

    const session = getSessionToken(req);
    const result = await githubRequest<
      Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { name: string; date: string } | null;
        };
        author: { login: string; avatar_url: string } | null;
      }>
    >(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?path=${encodeURIComponent(filePath)}&sha=${encodeURIComponent(branch)}&per_page=25`,
      { token: session?.token ?? null }
    );

    if (!result.ok || !result.data) {
      res.status(result.status).json({
        error: result.errorMessage || 'Failed to load commit history',
      });
      return;
    }

    res.json({
      commits: result.data.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        authorName: c.commit.author?.name || c.author?.login || 'Unknown',
        authorLogin: c.author?.login || null,
        authorAvatar: c.author?.avatar_url || null,
        date: c.commit.author?.date || '',
        htmlUrl: c.html_url,
      })),
    });
  });

  app.get('/api/github/file-at-commit', async (req: Request, res: Response) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    const filePath = String(req.query.path || '').trim();
    const ref = String(req.query.ref || '').trim();

    if (!owner || !repo || !filePath || !ref) {
      res.status(400).json({ error: 'owner, repo, path, and ref are required' });
      return;
    }

    const session = getSessionToken(req);
    const result = await githubRequest<{
      sha: string;
      path: string;
      content?: string;
    }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(ref)}`,
      { token: session?.token ?? null }
    );

    if (!result.ok || !result.data) {
      res.status(result.status).json({
        error: result.errorMessage || 'Failed to load file version',
      });
      return;
    }

    const encoded = (result.data.content || '').replace(/\n/g, '');
    const decoded = encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';

    res.json({
      sha: result.data.sha,
      path: result.data.path,
      content: decoded,
    });
  });

  app.put('/api/github/file', async (req: Request, res: Response) => {
    const session = getSessionToken(req);
    if (!session) {
      res.status(401).json({ error: 'Connect a GitHub Personal Access Token to commit changes.' });
      return;
    }

    const owner = String(req.body?.owner || '').trim();
    const repo = String(req.body?.repo || '').trim();
    const filePath = String(req.body?.path || '').trim();
    const branch = String(req.body?.branch || 'main').trim();
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const message = String(req.body?.message || '').trim();
    const expectedSha = typeof req.body?.expectedSha === 'string' ? req.body.expectedSha : undefined;
    const isCreate = Boolean(req.body?.isCreate);

    if (!owner || !repo || !filePath || !message) {
      res.status(400).json({ error: 'owner, repo, path, and commit message are required.' });
      return;
    }

    // Validate JSON syntax before touching GitHub
    try {
      JSON.parse(content);
    } catch {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }

    // Step 1: SHA Conflict Check on remote
    const latestCheck = await githubRequest<{ sha: string; content?: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`,
      { token: session.token }
    );

    if (isCreate) {
      if (latestCheck.ok && latestCheck.data) {
        res.status(409).json({
          code: 'FILE_EXISTS',
          error: 'A file with this path already exists in the repository.',
        });
        return;
      }
    } else {
      if (!latestCheck.ok || !latestCheck.data) {
        res.status(latestCheck.status).json({
          error: latestCheck.errorMessage || 'Remote file could not be verified before commit.',
        });
        return;
      }
      if (expectedSha && latestCheck.data.sha !== expectedSha) {
        const encodedRemote = (latestCheck.data.content || '').replace(/\n/g, '');
        const remoteContent = encodedRemote
          ? Buffer.from(encodedRemote, 'base64').toString('utf8')
          : '';
        res.status(409).json({
          code: 'SHA_CONFLICT',
          error: 'Remote file changed',
          remoteSha: latestCheck.data.sha,
          remoteContent,
        });
        return;
      }
    }

    // Step 2: Base64 encode and commit via GitHub Contents API
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');
    const putBody: Record<string, string> = {
      message,
      content: encodedContent,
      branch,
    };
    if (!isCreate && (expectedSha || latestCheck.data?.sha)) {
      putBody.sha = expectedSha || latestCheck.data!.sha;
    }

    const commitRes = await githubRequest<{
      content: { sha: string; path: string; html_url: string };
      commit: { sha: string; html_url: string };
    }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}`,
      {
        method: 'PUT',
        token: session.token,
        body: putBody,
      }
    );

    if (!commitRes.ok || !commitRes.data) {
      res.status(commitRes.status).json({
        error: commitRes.errorMessage || 'Commit failed',
      });
      return;
    }

    res.json({
      sha: commitRes.data.content.sha,
      path: commitRes.data.content.path,
      htmlUrl: commitRes.data.content.html_url,
      commitSha: commitRes.data.commit.sha,
      commitUrl: commitRes.data.commit.html_url,
    });
  });

  app.post('/api/github/upload-asset', async (req: Request, res: Response) => {
    const session = getSessionToken(req);
    if (!session) {
      res.status(401).json({ error: 'Connect a GitHub Personal Access Token to upload assets.' });
      return;
    }

    const owner = String(req.body?.owner || '').trim();
    const repo = String(req.body?.repo || '').trim();
    const branch = String(req.body?.branch || 'main').trim();
    const filePath = String(req.body?.path || '').trim();
    const base64Data = String(req.body?.base64Data || '').trim();

    if (!owner || !repo || !filePath || !base64Data) {
      res.status(400).json({ error: 'owner, repo, path, and base64Data are required.' });
      return;
    }

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const existing = await githubRequest<{ sha: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`,
      { token: session.token }
    );

    const putBody: Record<string, string> = {
      message: `Upload asset ${path.posix.basename(filePath)}`,
      content: cleanBase64,
      branch,
    };
    if (existing.ok && existing.data?.sha) {
      putBody.sha = existing.data.sha;
    }

    const uploadRes = await githubRequest<{
      content: { sha: string; path: string; download_url: string | null; html_url: string };
    }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}`,
      {
        method: 'PUT',
        token: session.token,
        body: putBody,
      }
    );

    if (!uploadRes.ok || !uploadRes.data) {
      res.status(uploadRes.status).json({ error: uploadRes.errorMessage || 'Asset upload failed' });
      return;
    }

    const rawUrl =
      uploadRes.data.content.download_url ||
      `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodeGitHubPath(filePath)}`;

    res.json({
      url: rawUrl,
      path: uploadRes.data.content.path,
      sha: uploadRes.data.content.sha,
    });
  });

  // --- Gemini Deep Thinking Endpoint (gemini-4-carbon + ThinkingLevel.HIGH) ---
  app.post('/api/ai/think', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'Gemini API key is not configured in Settings > Secrets.',
      });
      return;
    }

    const mode = req.body?.mode === 'architect' ? 'architect' : 'audit';
    const filePath = String(req.body?.filePath || 'config.json');
    const originalJson = String(req.body?.originalJson || '{}');
    const editedJson = String(req.body?.editedJson || '{}');
    const diffSummary = Array.isArray(req.body?.diffSummary) ? req.body.diffSummary : [];
    const userPrompt = String(req.body?.prompt || '').trim();
    const useStandardFallback = Boolean(req.body?.useStandardFallback);

    const modelName = useStandardFallback ? 'gemini-4-hydrogen' : 'gemini-4-carbon';

    try {
      if (mode === 'audit') {
        const promptText = [
          `File path: ${filePath}`,
          `Changed paths (${diffSummary.length}):`,
          JSON.stringify(diffSummary, null, 2),
          `Original JSON:`,
          originalJson,
          `Current Edited JSON:`,
          editedJson,
          userPrompt ? `Specific focus from admin: ${userPrompt}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction:
              'You are a senior Android remote-configuration auditor for LAUDA Admin. Deeply inspect the JSON structure, data types (strictly verifying numbers are not stringified, booleans are booleans, arrays preserve element types), update/changelog/maintenance/compatibility schema integrity, URL formats, and diff risks. Never hallucinate problems if the config is clean. Return concise, actionable findings.',
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verdict: { type: Type.STRING },
                riskLevel: { type: Type.STRING },
                summary: { type: Type.STRING },
                findings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      severity: { type: Type.STRING },
                      path: { type: Type.STRING },
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                    },
                    required: ['severity', 'path', 'title', 'detail'],
                  },
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['verdict', 'riskLevel', 'summary', 'findings', 'recommendations'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim());
        res.json({ model: modelName, result: parsed });
        return;
      }

      // Architect mode: solve complex configuration design / patch requests
      if (!userPrompt) {
        res.status(400).json({ error: 'Prompt is required for configuration architect mode.' });
        return;
      }

      const architectContents = [
        `Target file: ${filePath}`,
        `Current JSON state:\n${editedJson}`,
        `Admin request:\n${userPrompt}`,
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: modelName,
        contents: architectContents,
        config: {
          systemInstruction:
            'You are a senior remote-configuration architect for LAUDA Admin. Answer complex configuration queries or produce a complete, valid, type-preserving updated JSON document that satisfies the admin request while preserving all unrelated existing properties, types, and user-provided languages. Put the full updated JSON string in updatedJson (or empty string if the user only asked a conceptual question).',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
              hasJsonPatch: { type: Type.BOOLEAN },
              updatedJson: { type: Type.STRING },
              changedPaths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['explanation', 'hasJsonPatch', 'updatedJson', 'changedPaths'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ model: modelName, result: parsed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI reasoning request failed';
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 500;
      const isPaidTierError =
        status === 403 ||
        status === 429 ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.toLowerCase().includes('billing') ||
        msg.toLowerCase().includes('quota');

      res.status(isPaidTierError ? 429 : status >= 400 && status < 600 ? status : 500).json({
        code: isPaidTierError ? 'PAID_MODEL_TIER_REQUIRED' : 'AI_REQUEST_FAILED',
        model: modelName,
        error: isPaidTierError
          ? 'gemini-4-carbon requires a billing-enabled API key in Settings > Secrets, or you can run Standard High Thinking.'
          : msg,
      });
    }
  });

  // --- Frontend / Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAUDA Admin server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
