package com.laudadmin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Bundle;
import android.util.Base64;
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
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/** JSON editor with validation, pretty-printing, SHA-conflict protection and history. */
public class EditorActivity extends Activity {

    private FrameLayout root;
    private LinearLayout editorPage;
    private Api api;

    private String token;
    private String owner;
    private String repo;
    private String branch;
    private String path;
    private String sha;
    private String loadedRef;
    private boolean readOnly;

    private EditText editor;
    private TextView status;
    private TextView editorStatus;
    private ProgressBar progress;
    private Button commitButton;
    private ArrayList<JSONObject> commits = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        token = getIntent().getStringExtra("token");
        owner = getIntent().getStringExtra("owner");
        repo = getIntent().getStringExtra("repo");
        branch = getIntent().getStringExtra("branch");
        path = getIntent().getStringExtra("path");
        api = new Api(token);

        root = new FrameLayout(this);
        root.setBackgroundColor(Ui.BG);
        setContentView(root);

        buildEditor();
        loadFile();
    }

    private void setScreen(View v) {
        root.removeAllViews();
        root.addView(v, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private LinearLayout page() {
        LinearLayout col = Ui.column(this);
        col.setBackgroundColor(Ui.BG);
        col.setFitsSystemWindows(true);
        int pad = Ui.dp(this, 14);
        col.setPadding(pad, Ui.dp(this, 24), pad, pad);
        return col;
    }

    // ---------------------------------------------------------------- editor

    private void buildEditor() {
        LinearLayout col = page();

        LinearLayout bar = Ui.row(this);
        LinearLayout texts = Ui.column(this);
        texts.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        String name = path.contains("/") ? path.substring(path.lastIndexOf('/') + 1) : path;
        TextView title = Ui.text(this, name, 18f, Ui.TEXT, true);
        title.setMaxLines(1);
        title.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        texts.addView(title);
        TextView sub = Ui.text(this, owner + "/" + repo + " · " + branch, 12f, Ui.MUTED, false);
        sub.setMaxLines(1);
        sub.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        texts.addView(sub);
        bar.addView(texts);

        Button back = Ui.button(this, "Back", false);
        back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        bar.addView(back);
        col.addView(bar, Ui.fillWidth(this, 12));

        progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        col.addView(progress, Ui.fillWidth(this, 6));

        status = Ui.text(this, "Loading file…", 12.5f, Ui.MUTED, false);
        editorStatus = status;
        col.addView(status, Ui.fillWidth(this, 8));

        editor = new EditText(this);
        editor.setTextColor(Ui.TEXT);
        editor.setHintTextColor(Ui.MUTED);
        editor.setTextSize(13.5f);
        editor.setTypeface(android.graphics.Typeface.MONOSPACE);
        editor.setGravity(android.view.Gravity.TOP | android.view.Gravity.START);
        editor.setBackground(Ui.shape(this, 14, Ui.SURFACE, Ui.STROKE));
        int p = Ui.dp(this, 12);
        editor.setPadding(p, p, p, p);
        editor.setInputType(android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        editor.setHorizontallyScrolling(false);
        col.addView(editor, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout actions = Ui.row(this);
        actions.setPadding(0, Ui.dp(this, 10), 0, 0);

        Button format = Ui.button(this, "Format", false);
        format.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                formatJson();
            }
        });
        actions.addView(format, weight());

        Button validate = Ui.button(this, "Validate", false);
        validate.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                validateJson(true);
            }
        });
        actions.addView(validate, weight());

        Button history = Ui.button(this, "History", false);
        history.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showHistory();
            }
        });
        actions.addView(history, weight());

        commitButton = Ui.button(this, "Commit", true);
        commitButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                askCommitMessage();
            }
        });
        actions.addView(commitButton, weight());

        col.addView(actions);
        editorPage = col;
        setScreen(col);
    }

    private LinearLayout.LayoutParams weight() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(Ui.dp(this, 3), 0, Ui.dp(this, 3), 0);
        return lp;
    }

    private void busy(boolean on, String message) {
        if (progress != null) progress.setVisibility(on ? View.VISIBLE : View.GONE);
        if (status != null && message != null) {
            status.setTextColor(Ui.MUTED);
            status.setText(message);
        }
    }

    private void warn(String message) {
        if (progress != null) progress.setVisibility(View.GONE);
        if (status != null) {
            status.setTextColor(Ui.ERROR);
            status.setText(message);
        } else {
            Ui.toast(this, message);
        }
    }

    private void good(String message) {
        if (progress != null) progress.setVisibility(View.GONE);
        if (status != null) {
            status.setTextColor(Ui.SUCCESS);
            status.setText(message);
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

    // ------------------------------------------------------------------ load

    private void loadFile() {
        bg("Loading " + path + "…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                return api.get(Api.contentsPath(owner, repo, path, branch));
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                if (!res.ok()) {
                    warn("Could not load file: " + res.message());
                    return;
                }
                JSONObject json = res.json();
                sha = json.optString("sha", null);
                loadedRef = branch;
                String content = decode(json.optString("content", ""));
                editor.setText(content);
                readOnly = false;
                editor.setEnabled(true);
                commitButton.setEnabled(true);
                good("Loaded · sha " + shortSha(sha) + " · " + Ui.humanSize(content.length()));
            }
        });
    }

    private static String shortSha(String s) {
        return s == null || s.length() < 7 ? String.valueOf(s) : s.substring(0, 7);
    }

    private static String decode(String base64) {
        try {
            byte[] bytes = Base64.decode(base64.replace("\n", "").replace("\r", ""), Base64.DEFAULT);
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static String encode(String text) {
        return Base64.encodeToString(text.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
    }

    // -------------------------------------------------------------- validate

    private Object parse(String text) throws Exception {
        return new JSONTokener(text).nextValue();
    }

    private boolean validateJson(boolean announce) {
        String text = editor.getText().toString();
        try {
            Object value = parse(text);
            if (value instanceof JSONObject || value instanceof JSONArray) {
                if (announce) good("Valid JSON");
                return true;
            }
            if (announce) warn("JSON must be an object or an array at the top level.");
            return false;
        } catch (Exception e) {
            if (announce) warn("Invalid JSON: " + e.getMessage());
            return false;
        }
    }

    private void formatJson() {
        String text = editor.getText().toString();
        try {
            Object value = parse(text);
            String pretty;
            if (value instanceof JSONObject) {
                pretty = ((JSONObject) value).toString(2);
            } else if (value instanceof JSONArray) {
                pretty = ((JSONArray) value).toString(2);
            } else {
                warn("Nothing to format: the document is not a JSON object or array.");
                return;
            }
            editor.setText(pretty);
            good("Formatted (2-space indent)");
        } catch (Exception e) {
            warn("Invalid JSON: " + e.getMessage());
        }
    }

    // ---------------------------------------------------------------- commit

    private void askCommitMessage() {
        if (readOnly) {
            Ui.toast(this, "This version is read-only. Reload the file to edit.");
            return;
        }
        if (!validateJson(false)) {
            Ui.toast(this, "Fix the JSON before committing.");
            return;
        }
        final EditText message = new EditText(this);
        message.setHint("Commit message");
        message.setText("Update " + (path.contains("/") ? path.substring(path.lastIndexOf('/') + 1) : path));
        message.setSelectAllOnFocus(true);
        int p = Ui.dp(this, 16);
        message.setPadding(p, p, p, p);

        new AlertDialog.Builder(this)
                .setTitle("Commit to " + branch)
                .setView(message)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Commit", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        String msg = message.getText().toString().trim();
                        if (msg.isEmpty()) msg = "Update " + path;
                        doCommit(msg, false);
                    }
                })
                .show();
    }

    private void doCommit(final String message, final boolean force) {
        final String content = editor.getText().toString();
        final String expected = sha;
        bg("Committing…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                try {
                    JSONObject body = new JSONObject();
                    body.put("message", message);
                    body.put("content", encode(content));
                    body.put("branch", branch);
                    if (expected != null && !expected.isEmpty()) body.put("sha", expected);
                    return api.put(Api.contentsPath(owner, repo, path, null), body);
                } catch (Exception e) {
                    return new Api.Res(0, "", "Failed: " + e.getMessage());
                }
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                if (res.ok()) {
                    JSONObject json = res.json();
                    JSONObject contentObj = json.optJSONObject("content");
                    if (contentObj != null) sha = contentObj.optString("sha", sha);
                    JSONObject commitObj = json.optJSONObject("commit");
                    String commitSha = commitObj == null ? "" : commitObj.optString("sha", "");
                    good("Committed · " + shortSha(commitSha));
                    Ui.toast(EditorActivity.this, "Committed to " + branch);
                    return;
                }
                if (res.status == 409 && !force) {
                    promptConflict(message);
                    return;
                }
                if (res.status == 401 || res.status == 403) {
                    warn("Token lacks write permission: " + res.message());
                    return;
                }
                warn("Commit failed: " + res.message());
            }
        });
    }

    private void promptConflict(final String message) {
        new AlertDialog.Builder(this)
                .setTitle("File changed on GitHub")
                .setMessage("Someone committed to this file after you opened it. Reload the latest "
                        + "version, or overwrite it with your edit.")
                .setNegativeButton("Reload", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        loadFile();
                    }
                })
                .setPositiveButton("Overwrite", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        refetchShaThenCommit(message);
                    }
                })
                .show();
    }

    private void refetchShaThenCommit(final String message) {
        bg("Checking remote…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                return api.get(Api.contentsPath(owner, repo, path, branch));
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                if (res.ok()) {
                    sha = res.json().optString("sha", sha);
                }
                doCommit(message, true);
            }
        });
    }

    // --------------------------------------------------------------- history

    private void showHistory() {
        bg("Loading history…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                return api.get(Api.repoPath(owner, repo) + "/commits?path=" + Api.encPath(path)
                        + "&sha=" + Api.enc(branch) + "&per_page=25");
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                if (!res.ok()) {
                    warn("Could not load history: " + res.message());
                    return;
                }
                commits = new ArrayList<>();
                JSONArray arr = res.array();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject c = arr.optJSONObject(i);
                    if (c != null) commits.add(c);
                }
                renderHistory();
            }
        });
    }

    private void renderHistory() {
        LinearLayout col = page();
        col.addView(topBarFor("History", commits.size() + " commits", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                backToEditor();
            }
        }), Ui.fillWidth(this, 12));

        TextView hint = Ui.text(this, "Tap a commit to view that version (read-only).", 12.5f, Ui.MUTED, false);
        col.addView(hint, Ui.fillWidth(this, 8));

        ListView list = new ListView(this);
        list.setDivider(null);
        list.setDividerHeight(0);
        list.setBackgroundColor(Ui.BG);
        list.setAdapter(new CommitAdapter());
        col.addView(list, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        list.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                JSONObject c = commits.get(position);
                loadVersion(c.optString("sha", ""));
            }
        });
        setScreen(col);
    }

    private LinearLayout topBarFor(String title, String subtitle, View.OnClickListener back) {
        LinearLayout bar = Ui.row(this);
        LinearLayout texts = Ui.column(this);
        texts.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        texts.addView(Ui.text(this, title, 20f, Ui.TEXT, true));
        if (subtitle != null) texts.addView(Ui.text(this, subtitle, 12.5f, Ui.MUTED, false));
        bar.addView(texts);
        Button b = Ui.button(this, "Back", false);
        b.setOnClickListener(back);
        bar.addView(b);
        return bar;
    }

    private void loadVersion(final String ref) {
        bg("Loading version " + shortSha(ref) + "…", new java.util.concurrent.Callable<Api.Res>() {
            @Override
            public Api.Res call() {
                return api.get(Api.contentsPath(owner, repo, path, ref));
            }
        }, new OnResult() {
            @Override
            public void run(Api.Res res) {
                if (!res.ok()) {
                    status = editorStatus;
                    warn("Could not load that version: " + res.message());
                    setScreen(editorPage);
                    return;
                }
                JSONObject json = res.json();
                editor.setText(decode(json.optString("content", "")));
                readOnly = true;
                editor.setEnabled(false);
                commitButton.setEnabled(false);
                loadedRef = ref;
                status = editorStatus;
                setScreen(editorPage);
                status.setTextColor(Ui.MUTED);
                status.setText("Read-only view of " + shortSha(ref) + " — press Back and reopen to edit");
            }
        });
    }

    private class CommitAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return commits.size();
        }

        @Override
        public Object getItem(int position) {
            return commits.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            JSONObject c = commits.get(position);
            JSONObject commit = c.optJSONObject("commit");
            String message = commit == null ? "" : commit.optString("message", "");
            if (message.contains("\n")) message = message.substring(0, message.indexOf('\n'));
            JSONObject author = commit == null ? null : commit.optJSONObject("author");
            String who = author == null ? "" : author.optString("name", "");
            String date = author == null ? "" : author.optString("date", "");
            if (date.length() >= 10) date = date.substring(0, 10);

            LinearLayout wrap = Ui.column(EditorActivity.this);
            wrap.setPadding(0, 0, 0, Ui.dp(EditorActivity.this, 10));
            wrap.addView(Ui.cardRow(EditorActivity.this, message.isEmpty() ? "(no message)" : message,
                    who + " · " + date, shortSha(c.optString("sha", ""))));
            return wrap;
        }
    }

    private void backToEditor() {
        status = editorStatus;
        setScreen(editorPage);
    }

    @Override
    public void onBackPressed() {
        if (root.getChildCount() > 0 && root.getChildAt(0) != editorPage) {
            backToEditor();
        } else {
            super.onBackPressed();
        }
    }
}
