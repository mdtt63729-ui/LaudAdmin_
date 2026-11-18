package com.laudadmin;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * LAUD Admin — hosts the bundled Material 3 web build inside a WebView.
 *
 * The app is served from a virtual origin (https://lauda.local) instead of
 * file://, so ES modules, localStorage and fetch all behave like they do in a
 * browser. Requests to /api/... are answered on-device by lauda-shim.js.
 */
public class MainActivity extends Activity {

    private static final String APP_HOST = "lauda.local";
    private static final String APP_URL = "https://" + APP_HOST + "/index.html";

    private WebView webView;

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("mjs", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("txt", "text/plain");
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setFitsSystemWindows(true);
        root.setBackgroundColor(0xFF101014);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF101014);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        s.setUserAgentString(s.getUserAgentString() + " LaudAdminAndroid/1.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    return serveAsset(uri.getPath());
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                if (APP_HOST.equalsIgnoreCase(uri.getHost())) return false;
                openExternally(uri);
                return true;
            }
        });

        root.addView(webView);
        setContentView(root);

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        }
    }

    private WebResourceResponse serveAsset(String path) {
        String assetPath = (path == null || path.isEmpty() || "/".equals(path))
                ? "index.html"
                : path.startsWith("/") ? path.substring(1) : path;

        int dot = assetPath.lastIndexOf('.');
        String ext = dot >= 0 ? assetPath.substring(dot + 1).toLowerCase() : "html";
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";

        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");

        try {
            InputStream in = getAssets().open(assetPath);
            WebResourceResponse response = new WebResourceResponse(mime, "utf-8", in);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                response.setStatusCodeAndReasonPhrase(200, "OK");
                response.setResponseHeaders(headers);
            }
            return response;
        } catch (IOException e) {
            // Single page app: unknown in-app routes fall back to index.html
            if ("html".equals(ext)) {
                try {
                    return new WebResourceResponse("text/html", "utf-8", getAssets().open("index.html"));
                } catch (IOException ignored) {
                    // fall through
                }
            }
            return new WebResourceResponse("text/plain", "utf-8", null);
        }
    }

    private void openExternally(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!scheme.equals("http") && !scheme.equals("https")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.setVisibility(View.GONE);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
