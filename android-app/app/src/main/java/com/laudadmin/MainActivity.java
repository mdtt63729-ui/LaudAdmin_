package com.laudadmin;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;

/** Login, repository picker and JSON file browser. */
public class MainActivity extends Activity {

    private static final int SCREEN_AUTH = 0;
    private static final int SCREEN_REPOS = 1;
    private static final int SCREEN_FILES = 2;

    private FrameLayout root;
    private Api api;
    private String token;
    private String login = "";

    private int screen = SCREEN_AUTH;

    private final JSONArray repos = new JSONArray();
    private final ArrayList<JSONObject> reposShown = new ArrayList<>();
    private int repoPage = 1;
    private String reposQuery = "";

    private String owner = "";
    private String repo = "";
    private String branch = "main";
    private final ArrayList<String> branches = new ArrayList<>();
    private final ArrayList<JSONObject> filesShown = new ArrayList<>();

    private ProgressBar progress;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Ui.BG);
        setContentView(root);

        token = Store.loadToken(this);
        if (token != null && !token.isEmpty()) {
            api = new Api(token);
            showRepos(true);
        } else {
            showAuth(null);
        }
    }

    // ---------------------------------------------------------------- helpers

    private void setScreen(View v) {
        root.removeAllViews();
        root.addView(v, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private LinearLayout page() {
        LinearLayout col = Ui.column(this);
        col.setBackgroundColor(Ui.BG);
        col.setFitsSystemWindows(true);
        int pad = Ui.dp(this, 18);
        col.setPadding(pad, Ui.dp(this, 28), pad, pad);
        return col;
    }

    private LinearLayout topBar(String title, String subtitle, String action, View.OnClickListener onAction) {
        LinearLayout bar = Ui.row(this);
        LinearLayout texts = Ui.column(this);
        texts.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        texts.addView(Ui.text(this, title, 20f, Ui.TEXT, true));
        if (subtitle != null && !subtitle.isEmpty()) {
            TextView s = Ui.text(this, subtitle, 12.5f, Ui.MUTED, false);
            s.setMaxLines(1);
            s.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
            texts.addView(s);
        }
        bar.addView(texts);
        if (action != null) {
            Button b = Ui.button(this, action, false);
            b.setOnClickListener(onAction);
            bar.addView(b);
        }
        return bar;
    }

    private void busy(boolean on, String message) {
        if (progress != null) progress.setVisibility(on ? View.VISIBLE : View.GONE);
        if (status != null && message != null) status.setText(message);
    }

    private void fail(String message) {
        busy(false, null);
        if (status != null) {
            status.setTextColor(Ui.ERROR);
            status.setText(message);
        } else {
            Ui.toast(this, message);
        }
    }

    interface OnResult {
        void run(Api.Res res);
    }

    private void bg(final String label, final java.util.concurrent.Callable<Api.Res> work, final OnResult cb) {
        busy(true, label);
        new Thread(new Runnable() {
            @Override
            public void run() {
                Api.Res res;
                try {
                    res = work.call();
                } catch (Exception e) {
                    res = new Api.Res(0, "", "Failed: " + e.getMessage());
                }
                final Api.Res out = res;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        cb.run(out);
                    }
                });
            }
        }).start();
    }

    // ------------------------------------------------------------------ auth

    private void showAuth(String error) {
        screen = SCREEN_AUTH;
        LinearLayout col = page();
        col.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView title = Ui.text(this, "LAUD Admin", 30f, Ui.PRIMARY, true);
        title.setGravity(Gravity.CENTER_HORIZONTAL);
        col.addView(title, Ui.fillWidth(this, 4));

        TextView sub = Ui.text(this, "GitHub JSON administration", 14f, Ui.MUTED, false);
        sub.setGravity(Gravity.CENTER_HORIZONTAL);
        col.addView(sub, Ui.fillWidth(this, 26));

        final EditText tokenInput = Ui.input(this, "Personal access token (ghp_…)", false);
        col.addView(tokenInput, Ui.fillWidth(this, 12));

        final Button connect = Ui.button(this, "Connect to GitHub", true);
        col.addView(connect, Ui.fillWidth(this, 14));

        progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        col.addView(progress, Ui.fillWidth(this, 8));

        status = Ui.text(this, error == null ? "" : error, 13f, Ui.ERROR, false);
        col.addView(status, Ui.fillWidth(this, 18));

        TextView hint = Ui.text(this,
                "Needs a classic token with the repo scope (or a fine-grained token with Contents: read/write). "
                        + "Create one at github.com/settings/tokens.",
                12.5f, Ui.MUTED, false);
        hint.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://github.com/settings/tokens/new?scopes=repo&description=LAUD%20Admin")));
                } catch (Exception ignored) {
                }
            }
        });
        col.addView(hint);

        connect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                final String candidate = tokenInput.getText().toString().trim();
                if (candidate.isEmpty()) {
                    status.setTextColor(Ui.ERROR);
                    status.setText("Paste a token first.");
                    return;
                }
                status.setTextColor(Ui.MUTED);
                bg("Checking token…", new java.util.concurrent.Callable<Api.Res>() {
                    @Override
                    public Api.Res call() {
                        return new Api(candidate).get("/user");
                    }
                }, new OnResult() {
                    @Override
                    public void run(Api.Res res) {
                        if (!res.ok()) {
                            fail(res.status == 401 ? "GitHub rejected that token." : res.message());
                            return;
                        }
                        token = candidate;
                        api = new Api(token);
                        login = res.json().optString("login", "");
                        Store.saveToken(MainActivity.this, token);
                        showRepos(true);
                    }
                });
            }
        });

        setScreen(col);
    }

    // ----------------------------------------------------------------- repos

    private void showRepos(boolean reload) {
        screen = SCREEN_REPOS;
        LinearLayout col = page();

        final LinearLayout bar = topBar("Repositories", login.isEmpty() ? null : "@" + login, "Sign out",
                new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        Store.clear(MainActivity.this);
                        token = null;
                        api = null;
                        reposShown.clear();
                        showAuth(null);
                    }
                });
        col.addView(bar, Ui.fillWidth(this, 14));

        final EditText search = new EditText(this);
        search.setHint("Filter repositories");
        search.setTextColor(Ui.TEXT);
        search.setHintTextColor(Ui.MUTED);
        search.setTextSize(15f);
        search.setSingleLine(true);
        search.setInputType(InputType.TYPE_CLASS_TEXT);
        search.setBackground(Ui.shape(this, 14, Ui.SURFACE_HI, Ui.STROKE));
        int p = Ui.dp(this, 14);
        search.setPadding(p, Ui.dp(this, 10), p, Ui.dp(this, 10));
        col.addView(search, Ui.fillWidth(this, 12));

        progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        col.addView(progress, Ui.fillWidth(this, 6));

        status = Ui.text(this, "", 12.5f, Ui.MUTED, false);
        col.addView(status, Ui.fillWidth(this, 8));

        final ListView list = new ListView(this);
        list.setDivider(null);
        list.setDividerHeight(0);
        list.setBackgroundColor(Ui.BG);
        list.setAdapter(new RepoAdapter());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
        col.addView(list, lp);

        final Button more = Ui.button(this, "Load more", false);
        more.setVisibility(View.GONE);
        col.addView(more, Ui.fillWidth(this, 0));

        search.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {
            }

            @Override
            public void onTextChanged(CharSequence s, int a, int b, int c) {
                reposQuery = s.toString().trim().toLowerCase();
                filterRepos();
                list.invalidateViews();
                status.setText(reposShown.size() + " of " + repos.length() + " repositories");
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        list.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                JSONObject r = reposShown.get(position);
                String full = r.optString("full_name", "");
                if (!full.contains("/")) return;
                owner = full.split("/", 2)[0];
                repo = full.split("/", 2)[1];
                branch = r.optString("default_branch", "main");
                Store.saveLastRepo(MainActivity.this, owner, repo, branch);
                showFiles();
            }
        });

        more.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                loadRepos(repoPage + 1, list);
            }
        });

        setScreen(col);

        if (reload || repos.length() == 0) {
            loadRepos(1, list);
        } else {
            filterRepos();
            list.invalidateViews();
            status.setText(reposShown.size() + " of " + repos.length() + " repositories");
        }
    }

    private void loadRepos(final int pageNumber, final ListView list) {
        repoPage = pageNumber;
        bg(pageNumber == 1 ? "Loading repositories…" : "Loading more…",
                new java.util.concurrent.Callable<Api.Res>() {
                    @Override
                    public Api.Res call() {
                        return api.get("/user/repos?sort=updated&direction=desc&per_page=100&page="
                                + pageNumber + "&affiliation=owner,collaborator,organization_member");
                    }
                }, new OnResult() {
                    @Override
                    public void run(Api.Res res) {
                        if (!res.ok()) {
                            fail(res.message());
                            return;
                        }
                        JSONArray arr = res.array();
                        if (pageNumber == 1) reposShown.clear();
                        JSONArray merged = new JSONArray();
                        for (int i = 0; i < repos.length(); i++) merged.put(repos.opt(i));
                        for (int i = 0; i < arr.length(); i++) merged.put(arr.opt(i));
                        // replace backing store
                        reposShown.clear();
                        try {
                            while (repos.length() > 0) repos.remove(0);
                        } catch (Exception ignored) {
                        }
                        for (int i = 0; i < merged.length(); i++) repos.put(merged.opt(i));

                        filterRepos();
                        list.invalidateViews();
                        busy(false, reposShown.size() + " of " + repos.length() + " repositories");
                        if (status != null) status.setTextColor(Ui.MUTED);
                        View parent = list.getParent() instanceof View ? (View) list.getParent() : null;
                        if (parent != null) {
                            Button more = findMoreButton((LinearLayout) parent);
                            if (more != null) {
                                more.setVisibility(arr.length() >= 100 ? View.VISIBLE : View.GONE);
                            }
                        }
                    }
                });
    }

    private Button findMoreButton(LinearLayout parent) {
        for (int i = 0; i < parent.getChildCount(); i++) {
            View child = parent.getChildAt(i);
            if (child instanceof Button) return (Button) child;
        }
        return null;
    }

    private void filterRepos() {
        reposShown.clear();
        for (int i = 0; i < repos.length(); i++) {
            JSONObject r = repos.optJSONObject(i);
            if (r == null) continue;
            String name = r.optString("full_name", "").toLowerCase();
            String desc = r.optString("description", "").toLowerCase();
            if ("null".equals(desc)) desc = "";
            if (reposQuery.isEmpty() || name.contains(reposQuery) || desc.contains(reposQuery)) {
                reposShown.add(r);
            }
        }
    }

    private class RepoAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return reposShown.size();
        }

        @Override
        public Object getItem(int position) {
            return reposShown.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            JSONObject r = reposShown.get(position);
            String full = r.optString("full_name", "");
            String desc = r.optString("description", "");
            if ("null".equals(desc)) desc = "";
            String updated = r.optString("updated_at", "");
            if (updated.length() >= 10) updated = updated.substring(0, 10);
            String meta = (r.optBoolean("private", false) ? "private" : "public")
                    + (desc.isEmpty() ? "" : " · " + desc);

            LinearLayout wrap = Ui.column(MainActivity.this);
            wrap.setPadding(0, 0, 0, Ui.dp(MainActivity.this, 10));
            wrap.addView(Ui.cardRow(MainActivity.this, full, meta, updated));
            return wrap;
        }
    }

    // ----------------------------------------------------------------- files

    private void showFiles() {
        screen = SCREEN_FILES;
        filesShown.clear();

        LinearLayout col = page();
        col.addView(topBar(repo, owner + "/" + repo, "Back", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showRepos(false);
            }
        }), Ui.fillWidth(this, 12));

        final Spinner spinner = new Spinner(this);
        spinner.setBackgroundColor(Ui.SURFACE);
        ArrayAdapter<String> branchAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_dropdown_item, branches);
        spinner.setAdapter(branchAdapter);
        col.addView(spinner, Ui.fillWidth(this, 12));

        progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        col.addView(progress, Ui.fillWidth(this, 6));

        status = Ui.text(this, "Loading JSON files…", 12.5f, Ui.MUTED, false);
        col.addView(status, Ui.fillWidth(this, 8));

        final ListView list = new ListView(this);
        list.setDivider(null);
        list.setDividerHeight(0);
        list.setBackgroundColor(Ui.BG);
        list.setAdapter(new FileAdapter());
        col.addView(list, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        list.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                JSONObject f = filesShown.get(position);
                Intent intent = new Intent(MainActivity.this, EditorActivity.class);
                intent.putExtra("token", token);
                intent.putExtra("owner", owner);
                intent.putExtra("repo", repo);
                intent.putExtra("branch", branch);
                intent.putExtra("path", f.optString("path", ""));
                startActivity(intent);
            }
        });

        spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String picked = branches.get(position);
                if (!picked.equals(branch) || filesShown.isEmpty()) {
                    branch = picked;
                    Store.saveLastRepo(MainActivity.this, owner, repo, branch);
                    loadFiles(list);
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });

        setScreen(col);
        loadBranches(spinner, list);
    }

    private void loadBranches(final Spinner spinner, final ListView list) {
        bg("Loading branches…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                return api.get(Api.repoPath(owner, repo) + "/branches?per_page=100");
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                branches.clear();
                if (res.ok()) {
                    JSONArray arr = res.array();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject b = arr.optJSONObject(i);
                        if (b != null) branches.add(b.optString("name", ""));
                    }
                }
                if (branches.isEmpty()) branches.add(branch);
                if (!branches.contains(branch)) branches.add(0, branch);
                if (spinner.getAdapter() instanceof ArrayAdapter) {
                    //noinspection unchecked
                    ((ArrayAdapter<String>) spinner.getAdapter()).notifyDataSetChanged();
                }
                spinner.setSelection(Math.max(0, branches.indexOf(branch)));
                loadFiles(list);
            }
        });
    }

    private void loadFiles(final ListView list) {
        bg("Loading JSON files…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                return api.get(Api.repoPath(owner, repo) + "/git/trees/" + Api.enc(branch) + "?recursive=1");
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                filesShown.clear();
                if (!res.ok()) {
                    fail(res.message());
                    return;
                }
                JSONArray tree = res.json().optJSONArray("tree");
                if (tree != null) {
                    for (int i = 0; i < tree.length(); i++) {
                        JSONObject item = tree.optJSONObject(i);
                        if (item == null) continue;
                        if (!"blob".equals(item.optString("type"))) continue;
                        String path = item.optString("path", "");
                        if (!path.toLowerCase().endsWith(".json")) continue;
                        filesShown.add(item);
                    }
                }
                list.invalidateViews();
                boolean truncated = res.json().optBoolean("truncated", false);
                busy(false, filesShown.size() + " JSON files on " + branch
                        + (truncated ? " · tree truncated" : ""));
                if (status != null) status.setTextColor(Ui.MUTED);
            }
        });
    }

    private class FileAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return filesShown.size();
        }

        @Override
        public Object getItem(int position) {
            return filesShown.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            JSONObject f = filesShown.get(position);
            String path = f.optString("path", "");
            int slash = path.lastIndexOf('/');
            String dir = slash >= 0 ? path.substring(0, slash) : "";
            String name = slash >= 0 ? path.substring(slash + 1) : path;
            long size = f.optLong("size", 0);

            LinearLayout wrap = Ui.column(MainActivity.this);
            wrap.setPadding(0, 0, 0, Ui.dp(MainActivity.this, 10));
            wrap.addView(Ui.cardRow(MainActivity.this, name,
                    dir.isEmpty() ? "repository root" : dir, Ui.humanSize(size)));
            return wrap;
        }
    }

    // ------------------------------------------------------------------ back

    @Override
    public void onBackPressed() {
        if (screen == SCREEN_FILES) {
            showRepos(false);
        } else {
            super.onBackPressed();
        }
    }
}
