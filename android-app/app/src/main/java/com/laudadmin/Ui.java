package com.laudadmin;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.ColorDrawable;
import android.content.res.ColorStateList;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Programmatic Material-ish widgets so the APK needs no resource layouts. */
final class Ui {

    static final int BG = 0xFF0F0F13;
    static final int SURFACE = 0xFF1A1A20;
    static final int SURFACE_HI = 0xFF232329;
    static final int STROKE = 0xFF2E2E38;
    static final int PRIMARY = 0xFFFFB84D;
    static final int TEXT = 0xFFF3F1EC;
    static final int MUTED = 0xFF9C978D;
    static final int ERROR = 0xFFFF7B72;
    static final int SUCCESS = 0xFF4ADE80;

    private Ui() {
    }

    static int dp(Context c, float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                c.getResources().getDisplayMetrics()));
    }

    static GradientDrawable shape(Context c, float radiusDp, int fill, int strokeColor) {
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.RECTANGLE);
        d.setCornerRadius(dp(c, radiusDp));
        d.setColor(fill);
        if (strokeColor != 0) {
            d.setStroke(dp(c, 1), strokeColor);
        }
        return d;
    }

    static TextView text(Context c, CharSequence value, float sp, int color, boolean bold) {
        TextView tv = new TextView(c);
        tv.setText(value);
        tv.setTextSize(sp);
        tv.setTextColor(color);
        if (bold) tv.setTypeface(Typeface.DEFAULT_BOLD);
        return tv;
    }

    static EditText input(Context c, String hint, boolean multiline) {
        EditText et = new EditText(c);
        et.setHint(hint);
        et.setTextColor(TEXT);
        et.setHintTextColor(MUTED);
        et.setTextSize(15f);
        et.setBackground(shape(c, 14, SURFACE_HI, STROKE));
        int pad = dp(c, 14);
        et.setPadding(pad, pad, pad, pad);
        et.setInputType(multiline
                ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
                : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        if (multiline) {
            et.setGravity(Gravity.TOP | Gravity.START);
            et.setTypeface(Typeface.MONOSPACE);
        }
        return et;
    }

    static Button button(Context c, String label, boolean primary) {
        Button b = new Button(c);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(15f);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(primary ? 0xFF191308 : TEXT);
        GradientDrawable bg = shape(c, 14, primary ? PRIMARY : SURFACE_HI, primary ? 0 : STROKE);
        b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x33FFFFFF), bg,
                new ColorDrawable(Color.WHITE)));
        b.setMinHeight(dp(c, 46));
        b.setPadding(dp(c, 16), dp(c, 10), dp(c, 16), dp(c, 10));
        return b;
    }

    static LinearLayout column(Context c) {
        LinearLayout ll = new LinearLayout(c);
        ll.setOrientation(LinearLayout.VERTICAL);
        return ll;
    }

    static LinearLayout row(Context c) {
        LinearLayout ll = new LinearLayout(c);
        ll.setOrientation(LinearLayout.HORIZONTAL);
        ll.setGravity(Gravity.CENTER_VERTICAL);
        return ll;
    }

    static View spacer(Context c, int heightDp) {
        View v = new View(c);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(c, heightDp)));
        return v;
    }

    /** A card row: title, subtitle, optional trailing text. */
    static LinearLayout cardRow(Context c, String title, String subtitle, String trailing) {
        LinearLayout card = new LinearLayout(c);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setBackground(shape(c, 16, SURFACE, STROKE));
        int pad = dp(c, 14);
        card.setPadding(pad, pad, pad, pad);
        card.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout texts = column(c);
        texts.setLayoutParams(new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        TextView t = text(c, title, 16f, TEXT, true);
        t.setMaxLines(1);
        t.setEllipsize(android.text.TextUtils.TruncateAt.MIDDLE);
        texts.addView(t);
        if (subtitle != null && !subtitle.isEmpty()) {
            TextView s = text(c, subtitle, 12.5f, MUTED, false);
            s.setMaxLines(2);
            s.setEllipsize(android.text.TextUtils.TruncateAt.END);
            texts.addView(s);
        }
        card.addView(texts);

        if (trailing != null && !trailing.isEmpty()) {
            TextView tr = text(c, trailing, 12f, MUTED, false);
            tr.setPadding(dp(c, 10), 0, 0, 0);
            card.addView(tr);
        }
        return card;
    }

    static LinearLayout.LayoutParams fillWidth(Context c, int bottomMarginDp) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(c, bottomMarginDp);
        return lp;
    }

    static void toast(Context c, String msg) {
        android.widget.Toast.makeText(c, msg, android.widget.Toast.LENGTH_LONG).show();
    }

    static String humanSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format(java.util.Locale.US, "%.1f KB", bytes / 1024.0);
        return String.format(java.util.Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0));
    }
}
