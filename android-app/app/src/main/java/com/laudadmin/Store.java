package com.laudadmin;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Stores the GitHub token encrypted with an AES-256-GCM key that lives in the
 * Android Keystore (hardware-backed where the device supports it). The key never
 * leaves the keystore, so the ciphertext in SharedPreferences is useless alone.
 */
final class Store {

    private static final String PREF = "laud_admin";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_ALIAS = "laud_admin_token_key";
    private static final String TRANSFORM = "AES/GCM/NoPadding";

    private Store() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) {
            return (SecretKey) ks.getKey(KEY_ALIAS, null);
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }

    static void saveToken(Context c, String token) {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(token.getBytes("UTF-8"));
            String packed = Base64.encodeToString(iv, Base64.NO_WRAP) + ":"
                    + Base64.encodeToString(ct, Base64.NO_WRAP);
            prefs(c).edit().putString(KEY_TOKEN, packed).apply();
        } catch (Exception e) {
            // Keystore unavailable: keep the app usable, but never store plaintext.
            prefs(c).edit().remove(KEY_TOKEN).apply();
        }
    }

    static String loadToken(Context c) {
        String packed = prefs(c).getString(KEY_TOKEN, null);
        if (packed == null || !packed.contains(":")) return null;
        try {
            String[] parts = packed.split(":", 2);
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] ct = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance(TRANSFORM);
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(ct), "UTF-8");
        } catch (Exception e) {
            return null;
        }
    }

    static void clear(Context c) {
        prefs(c).edit().remove(KEY_TOKEN).apply();
    }

    static void saveLastRepo(Context c, String owner, String repo, String branch) {
        prefs(c).edit().putString("repo", owner + "/" + repo).putString("branch", branch).apply();
    }

    static String[] lastRepo(Context c) {
        String r = prefs(c).getString("repo", null);
        if (r == null || !r.contains("/")) return null;
        return new String[]{r.split("/", 2)[0], r.split("/", 2)[1],
                prefs(c).getString("branch", "main")};
    }
}
