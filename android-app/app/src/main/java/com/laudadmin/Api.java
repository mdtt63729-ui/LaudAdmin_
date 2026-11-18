package com.laudadmin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Minimal GitHub REST client (HttpURLConnection + org.json, no third-party deps). */
final class Api {

    static final String BASE = "https://api.github.com";
    private static final int TIMEOUT = 20000;

    private final String token;

    Api(String token) {
        this.token = token;
    }

    static final class Res {
        final int status;
        final String body;
        final String error;

        Res(int status, String body, String error) {
            this.status = status;
            this.body = body == null ? "" : body;
            this.error = error;
        }

        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }

        JSONObject json() {
            try {
                return body.isEmpty() ? new JSONObject() : new JSONObject(body);
            } catch (JSONException e) {
                return new JSONObject();
            }
        }

        JSONArray array() {
            try {
                return new JSONArray(body);
            } catch (JSONException e) {
                return new JSONArray();
            }
        }

        String message() {
            if (error != null) return error;
            String m = json().optString("message", "");
            if (!m.isEmpty()) return m;
            return "HTTP " + status;
        }
    }

    Res get(String path) {
        return call("GET", path, null);
    }

    Res put(String path, JSONObject body) {
        return call("PUT", path, body);
    }

    Res call(String method, String path, JSONObject body) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(BASE + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(TIMEOUT);
            conn.setReadTimeout(TIMEOUT);
            conn.setRequestProperty("Accept", "application/vnd.github+json");
            conn.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            conn.setRequestProperty("User-Agent", "LAUD-Admin-Android");
            if (token != null && !token.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }
            if (body != null) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(payload.length);
                OutputStream os = conn.getOutputStream();
                os.write(payload);
                os.close();
            }

            int status = conn.getResponseCode();
            InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String text = read(in);
            return new Res(status, text, null);
        } catch (IOException e) {
            return new Res(0, "", "Network unavailable: " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String read(InputStream in) throws IOException {
        if (in == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    // ---- path helpers -------------------------------------------------

    static String enc(String s) {
        try {
            return URLEncoder.encode(s == null ? "" : s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return s == null ? "" : s;
        }
    }

    /** Encodes a repository path but keeps the slashes. */
    static String encPath(String path) {
        String[] parts = (path == null ? "" : path).split("/");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append('/');
            sb.append(enc(parts[i]));
        }
        return sb.toString();
    }

    static String repoPath(String owner, String repo) {
        return "/repos/" + enc(owner) + "/" + enc(repo);
    }

    static String contentsPath(String owner, String repo, String path, String ref) {
        String p = repoPath(owner, repo) + "/contents/" + encPath(path);
        return ref == null || ref.isEmpty() ? p : p + "?ref=" + enc(ref);
    }
}
