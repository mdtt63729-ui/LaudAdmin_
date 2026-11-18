/*
 * LAUD Admin — offline API shim.
 *
 * The web app in /assets was written to talk to an Express backend (/api/...).
 * Inside the Android APK there is no Node server, so this shim re-implements the
 * same endpoints directly against the GitHub REST API from the WebView.
 * The Personal Access Token stays on the device (WebView localStorage).
 */
(function () {
  'use strict';

  var PAT_KEY = 'lauda_pat_v1';
  var SID_KEY = 'lauda_sid_v1';
  var GH = 'https://api.github.com';

  function readPat() {
    try { return localStorage.getItem(PAT_KEY) || ''; } catch (e) { return ''; }
  }
  function writePat(t) {
    try {
      if (t) { localStorage.setItem(PAT_KEY, t); } else { localStorage.removeItem(PAT_KEY); localStorage.removeItem(SID_KEY); }
    } catch (e) { /* ignore */ }
  }
  function readSid() {
    try { return localStorage.getItem(SID_KEY) || ''; } catch (e) { return ''; }
  }
  function writeSid(s) {
    try {
      if (s) { localStorage.setItem(SID_KEY, s); } else { localStorage.removeItem(SID_KEY); }
    } catch (e) { /* ignore */ }
  }
  function uuid() {
    try { return crypto.randomUUID(); } catch (e) { return 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  }

  function jsonResponse(status, body) {
    return new Response(JSON.stringify(body === undefined ? {} : body), {
      status: status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function b64decodeUtf8(b64) {
    var clean = String(b64 || '').replace(/\s/g, '');
    if (!clean) return '';
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return new TextDecoder('utf-8').decode(bytes); } catch (e) { return bin; }
  }

  function b64encodeUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function encodePath(p) {
    return String(p).split('/').map(encodeURIComponent).join('/');
  }

  // Thin wrapper over api.github.com that mirrors the server's error contract.
  function gh(path, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var token = opts.token !== undefined ? opts.token : readPat();
    if (token) headers.Authorization = 'Bearer ' + token;
    var init = { method: opts.method || 'GET', headers: headers, credentials: 'omit', mode: 'cors' };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(GH + path, init).then(
      function (res) {
        return res.text().then(function (text) {
          var data = null;
          if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
          var remaining = res.headers.get('x-ratelimit-remaining');
          var reset = res.headers.get('x-ratelimit-reset');
          return {
            ok: res.ok,
            status: res.status,
            data: data,
            rateLimitRemaining: remaining === null ? undefined : Number(remaining),
            rateLimitReset: reset === null ? undefined : Number(reset),
          };
        });
      },
      function () {
        return { ok: false, status: 0, data: null, errorMessage: 'Network unavailable' };
      }
    );
  }

  function errorMessage(r, fallback) {
    if (r && r.data && typeof r.data.message === 'string' && r.data.message) return r.data.message;
    if (r && r.status === 401) return 'GitHub rejected the token (401).';
    if (r && r.status === 403) return 'GitHub rate limit or permission problem (403).';
    if (r && r.status === 404) return 'Not found (404).';
    if (r && r.status === 0) return 'Network unavailable';
    return fallback;
  }

  function fail(r, fallback, extra) {
    var body = { error: (r && r.errorMessage) || errorMessage(r, fallback) };
    if (extra) for (var k in extra) body[k] = extra[k];
    return jsonResponse(r && r.status ? r.status : 500, body);
  }

  function mapUser(u) {
    return {
      login: u.login,
      name: u.name === undefined ? null : u.name,
      avatarUrl: u.avatar_url,
      htmlUrl: u.html_url,
      publicRepos: u.public_repos,
      privateRepos: u.total_private_repos || 0,
    };
  }

  function mapRepo(r, canPushFallback) {
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner ? r.owner.login : '',
      ownerAvatar: r.owner ? r.owner.avatar_url : '',
      isPrivate: r.private,
      description: r.description === undefined ? null : r.description,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      htmlUrl: r.html_url,
      canPush: r.permissions && r.permissions.push !== undefined ? r.permissions.push : canPushFallback,
    };
  }

  function requireToken() {
    var t = readPat();
    if (!t) return null;
    return t;
  }

  var handlers = {};

  handlers['POST /api/auth/connect'] = function (body) {
    var token = body && typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) return Promise.resolve(jsonResponse(400, { error: 'Personal Access Token is required.' }));
    return gh('/user', { token: token }).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Invalid GitHub token');
      writePat(token);
      var sid = uuid();
      writeSid(sid);
      return jsonResponse(200, {
        sessionId: sid,
        user: mapUser(r.data),
        rateLimitRemaining: r.rateLimitRemaining,
        rateLimitReset: r.rateLimitReset,
      });
    });
  };

  handlers['GET /api/auth/session'] = function () {
    var token = requireToken();
    if (!token) return Promise.resolve(jsonResponse(200, { authenticated: false }));
    return gh('/user', { token: token }).then(function (userRes) {
      if (!userRes.ok || !userRes.data) {
        writePat('');
        return jsonResponse(200, { authenticated: false });
      }
      return gh('/rate_limit', { token: token }).then(function (rateRes) {
        var core = rateRes.data && rateRes.data.resources ? rateRes.data.resources.core : null;
        var sid = readSid();
        if (!sid) { sid = uuid(); writeSid(sid); }
        return jsonResponse(200, {
          authenticated: true,
          sessionId: sid,
          user: mapUser(userRes.data),
          rateLimit: core || null,
        });
      });
    });
  };

  handlers['POST /api/auth/disconnect'] = function () {
    writePat('');
    return Promise.resolve(jsonResponse(200, { ok: true }));
  };

  handlers['GET /api/github/repos'] = function (_body, q) {
    var token = requireToken();
    if (!token) return Promise.resolve(jsonResponse(401, { error: 'GitHub authentication required' }));
    var page = Math.max(1, Number(q.get('page') || 1));
    var perPage = Math.min(100, Math.max(10, Number(q.get('perPage') || 60)));
    var path = '/user/repos?sort=updated&direction=desc&per_page=' + perPage + '&page=' + page +
      '&affiliation=owner,collaborator,organization_member';
    return gh(path, { token: token }).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Failed to load repositories');
      return jsonResponse(200, {
        repos: r.data.map(function (x) { return mapRepo(x, true); }),
        hasMore: r.data.length === perPage,
        rateLimitRemaining: r.rateLimitRemaining,
      });
    });
  };

  handlers['GET /api/github/repo'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    if (!owner || !repo) return Promise.resolve(jsonResponse(400, { error: 'owner and repo are required' }));
    return gh('/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo)).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Repository not found');
      return jsonResponse(200, { repo: mapRepo(r.data, false), rateLimitRemaining: r.rateLimitRemaining });
    });
  };

  handlers['GET /api/github/branches'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    if (!owner || !repo) return Promise.resolve(jsonResponse(400, { error: 'owner and repo are required' }));
    return gh('/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/branches?per_page=100')
      .then(function (r) {
        if (!r.ok || !r.data) return fail(r, 'Failed to load branches');
        return jsonResponse(200, {
          branches: r.data.map(function (b) { return { name: b.name, protected: !!b.protected }; }),
        });
      });
  };

  handlers['GET /api/github/tree'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    var branch = (q.get('branch') || 'main').trim();
    if (!owner || !repo) return Promise.resolve(jsonResponse(400, { error: 'owner and repo are required' }));
    var path = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
      '/git/trees/' + encodeURIComponent(branch) + '?recursive=1';
    return gh(path).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Failed to discover repository tree');
      var files = (r.data.tree || [])
        .filter(function (item) { return item.type === 'blob' && /\.json$/i.test(item.path); })
        .map(function (item) {
          var lastSlash = item.path.lastIndexOf('/');
          var directory = lastSlash >= 0 ? item.path.slice(0, lastSlash + 1) : '';
          var rawFilename = lastSlash >= 0 ? item.path.slice(lastSlash + 1) : item.path;
          return {
            path: item.path,
            directory: directory,
            rawFilename: rawFilename,
            displayName: rawFilename.replace(/\.json$/i, ''),
            sha: item.sha,
            size: item.size || 0,
          };
        });
      return jsonResponse(200, {
        treeSha: r.data.sha,
        truncated: !!r.data.truncated,
        files: files,
        rateLimitRemaining: r.rateLimitRemaining,
      });
    });
  };

  function contentsPath(owner, repo, filePath, ref) {
    return '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
      '/contents/' + encodePath(filePath) + (ref ? '?ref=' + encodeURIComponent(ref) : '');
  }

  handlers['GET /api/github/file'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    var filePath = (q.get('path') || '').trim();
    var branch = (q.get('branch') || 'main').trim();
    if (!owner || !repo || !filePath) return Promise.resolve(jsonResponse(400, { error: 'owner, repo, and path are required' }));
    return gh(contentsPath(owner, repo, filePath, branch)).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Failed to load file');
      return jsonResponse(200, {
        path: r.data.path,
        name: r.data.name,
        sha: r.data.sha,
        size: r.data.size,
        htmlUrl: r.data.html_url,
        content: b64decodeUtf8(r.data.content),
        rateLimitRemaining: r.rateLimitRemaining,
      });
    });
  };

  handlers['GET /api/github/file-sha'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    var filePath = (q.get('path') || '').trim();
    var branch = (q.get('branch') || 'main').trim();
    if (!owner || !repo || !filePath) return Promise.resolve(jsonResponse(400, { error: 'owner, repo, and path are required' }));
    return gh(contentsPath(owner, repo, filePath, branch)).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Failed to check remote SHA');
      return jsonResponse(200, { sha: r.data.sha });
    });
  };

  handlers['GET /api/github/file-history'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    var filePath = (q.get('path') || '').trim();
    var branch = (q.get('branch') || 'main').trim();
    if (!owner || !repo || !filePath) return Promise.resolve(jsonResponse(400, { error: 'owner, repo, and path are required' }));
    var path = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
      '/commits?path=' + encodeURIComponent(filePath) + '&sha=' + encodeURIComponent(branch) + '&per_page=25';
    return gh(path).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Failed to load commit history');
      return jsonResponse(200, {
        commits: r.data.map(function (c) {
          var author = c.commit && c.commit.author ? c.commit.author : null;
          return {
            sha: c.sha,
            shortSha: c.sha.slice(0, 7),
            message: c.commit ? c.commit.message : '',
            authorName: (author && author.name) || (c.author && c.author.login) || 'Unknown',
            authorLogin: c.author ? c.author.login : null,
            authorAvatar: c.author ? c.author.avatar_url : null,
            date: (author && author.date) || '',
            htmlUrl: c.html_url,
          };
        }),
      });
    });
  };

  handlers['GET /api/github/file-at-commit'] = function (_body, q) {
    var owner = (q.get('owner') || '').trim();
    var repo = (q.get('repo') || '').trim();
    var filePath = (q.get('path') || '').trim();
    var ref = (q.get('ref') || '').trim();
    if (!owner || !repo || !filePath || !ref) {
      return Promise.resolve(jsonResponse(400, { error: 'owner, repo, path, and ref are required' }));
    }
    return gh(contentsPath(owner, repo, filePath, ref)).then(function (r) {
      if (!r.ok || !r.data) return fail(r, 'Failed to load file version');
      return jsonResponse(200, { sha: r.data.sha, path: r.data.path, content: b64decodeUtf8(r.data.content) });
    });
  };

  handlers['PUT /api/github/file'] = function (body) {
    var token = requireToken();
    if (!token) return Promise.resolve(jsonResponse(401, { error: 'Connect a GitHub Personal Access Token to commit changes.' }));
    body = body || {};
    var owner = (body.owner || '').trim();
    var repo = (body.repo || '').trim();
    var filePath = (body.path || '').trim();
    var branch = (body.branch || 'main').trim();
    var content = typeof body.content === 'string' ? body.content : '';
    var message = (body.message || '').trim();
    var expectedSha = typeof body.expectedSha === 'string' ? body.expectedSha : undefined;
    var isCreate = !!body.isCreate;

    if (!owner || !repo || !filePath || !message) {
      return Promise.resolve(jsonResponse(400, { error: 'owner, repo, path, and commit message are required.' }));
    }
    try { JSON.parse(content); } catch (e) { return Promise.resolve(jsonResponse(400, { error: 'Invalid JSON' })); }

    return gh(contentsPath(owner, repo, filePath, branch), { token: token }).then(function (latest) {
      if (isCreate) {
        if (latest.ok && latest.data) {
          return jsonResponse(409, {
            code: 'FILE_EXISTS',
            error: 'A file with this path already exists in the repository.',
          });
        }
      } else {
        if (!latest.ok || !latest.data) return fail(latest, 'Remote file could not be verified before commit.');
        if (expectedSha && latest.data.sha !== expectedSha) {
          return jsonResponse(409, {
            code: 'SHA_CONFLICT',
            error: 'Remote file changed',
            remoteSha: latest.data.sha,
            remoteContent: b64decodeUtf8(latest.data.content),
          });
        }
      }
      var putBody = { message: message, content: b64encodeUtf8(content), branch: branch };
      if (!isCreate) putBody.sha = expectedSha || (latest.data && latest.data.sha);
      return gh(contentsPath(owner, repo, filePath), { method: 'PUT', token: token, body: putBody })
        .then(function (res) {
          if (!res.ok || !res.data) return fail(res, 'Commit failed');
          return jsonResponse(200, {
            sha: res.data.content.sha,
            path: res.data.content.path,
            htmlUrl: res.data.content.html_url,
            commitSha: res.data.commit.sha,
            commitUrl: res.data.commit.html_url,
          });
        });
    });
  };

  handlers['POST /api/github/upload-asset'] = function (body) {
    var token = requireToken();
    if (!token) return Promise.resolve(jsonResponse(401, { error: 'Connect a GitHub Personal Access Token to upload assets.' }));
    body = body || {};
    var owner = (body.owner || '').trim();
    var repo = (body.repo || '').trim();
    var branch = (body.branch || 'main').trim();
    var filePath = (body.path || '').trim();
    var base64Data = String(body.base64Data || '').trim();
    if (!owner || !repo || !filePath || !base64Data) {
      return Promise.resolve(jsonResponse(400, { error: 'owner, repo, path, and base64Data are required.' }));
    }
    var clean = base64Data.indexOf(',') >= 0 ? base64Data.split(',')[1] : base64Data;
    var name = filePath.split('/').pop();
    return gh(contentsPath(owner, repo, filePath, branch), { token: token }).then(function (existing) {
      var putBody = { message: 'Upload asset ' + name, content: clean, branch: branch };
      if (existing.ok && existing.data && existing.data.sha) putBody.sha = existing.data.sha;
      return gh(contentsPath(owner, repo, filePath), { method: 'PUT', token: token, body: putBody })
        .then(function (res) {
          if (!res.ok || !res.data) return fail(res, 'Asset upload failed');
          var url = res.data.content.download_url ||
            ('https://raw.githubusercontent.com/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
              '/' + encodeURIComponent(branch) + '/' + encodePath(filePath));
          return jsonResponse(200, { url: url, path: res.data.content.path, sha: res.data.content.sha });
        });
    });
  };

  handlers['POST /api/ai/think'] = function () {
    return Promise.resolve(jsonResponse(503, {
      code: 'MISSING_API_KEY',
      error: 'Deep Think needs a Gemini API key on a server, which this on-device build does not have. ' +
        'Everything else (browse, edit, validate, commit) works offline of that server.',
    }));
  };

  var realFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var path = url;
    try { path = new URL(url, location.href).pathname; } catch (e) { /* keep raw */ }

    if (path.indexOf('/api/') === 0) {
      var body = null;
      if (init && typeof init.body === 'string' && init.body) {
        try { body = JSON.parse(init.body); } catch (e) { body = null; }
      }
      var key = method + ' ' + path;
      var handler = handlers[key];
      if (!handler) {
        return Promise.resolve(jsonResponse(404, { error: 'Unknown endpoint ' + key }));
      }
      var query = new URLSearchParams();
      try { query = new URL(url, location.href).searchParams; } catch (e) { /* ignore */ }
      try {
        return Promise.resolve(handler(body, query)).catch(function (err) {
          return jsonResponse(500, { error: (err && err.message) || 'Request failed' });
        });
      } catch (err) {
        return Promise.resolve(jsonResponse(500, { error: (err && err.message) || 'Request failed' }));
      }
    }

    if (realFetch) return realFetch(input, init);
    return Promise.reject(new Error('fetch unavailable'));
  };

  // Keep the web app's sessionStorage id in sync with the on-device session.
  try {
    if (readPat()) {
      var existing = sessionStorage.getItem('lauda_session_id');
      if (!existing) {
        var sid = readSid() || uuid();
        writeSid(sid);
        sessionStorage.setItem('lauda_session_id', sid);
      }
    }
  } catch (e) { /* ignore */ }
})();
