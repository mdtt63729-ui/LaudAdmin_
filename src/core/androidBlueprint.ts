export interface BlueprintFile {
  path: string;
  description: string;
  content: string;
}

export const ANDROID_BLUEPRINT_FILES: BlueprintFile[] = [
  {
    path: 'gradle/libs.versions.toml',
    description: 'Centralized Gradle Version Catalog for Kotlin, Compose BOM, Material 3, Serialization & Security',
    content: `[versions]
agp = "8.7.3"
kotlin = "2.1.0"
composeBom = "2025.02.00"
navigationCompose = "2.8.8"
coroutines = "1.10.1"
serialization = "1.8.0"
okhttp = "4.12.0"
securityCrypto = "1.1.0-alpha06"
lifecycle = "2.8.7"

[libraries]
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-icons = { group = "androidx.compose.material.icons", name = "icons-extended" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }
androidx-lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
androidx-security-crypto = { group = "androidx.security", name = "security-crypto", version.ref = "securityCrypto" }`,
  },
  {
    path: 'app/src/main/java/com/laudadmin/core/security/KeystoreTokenStore.kt',
    description: 'Android Keystore-backed encrypted PAT storage (zero plaintext persistence or logs)',
    content: `package com.laudadmin.core.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class KeystoreTokenStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "lauda_keystore_vault",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    suspend fun saveToken(pat: String) = withContext(Dispatchers.IO) {
        prefs.edit().putString(KEY_PAT, pat.trim()).apply()
    }

    suspend fun readToken(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_PAT, null)
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit().remove(KEY_PAT).apply()
    }

    private companion object {
        const val KEY_PAT = "encrypted_github_pat"
    }
}`,
  },
  {
    path: 'app/src/main/java/com/laudadmin/core/json/JsonTreeEngine.kt',
    description: 'Type-safe kotlinx.serialization JsonElement editor preserving unknown properties and types',
    content: `package com.laudadmin.core.json

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

object JsonTreeEngine {
    private val prettyJson = Json {
        prettyPrint = true
        encodeDefaults = true
        ignoreUnknownKeys = false
    }

    suspend fun parse(raw: String): Result<JsonElement> = withContext(Dispatchers.Default) {
        runCatching { Json.parseToJsonElement(raw) }
    }

    suspend fun serialize(element: JsonElement): String = withContext(Dispatchers.Default) {
        prettyJson.encodeToString(JsonElement.serializer(), element)
    }

    fun updateAtPath(root: JsonElement, path: List<String>, newValue: JsonElement): JsonElement {
        if (path.isEmpty()) return newValue
        val head = path.first()
        val tail = path.drop(1)
        return when (root) {
            is JsonObject -> JsonObject(root.toMutableMap().apply {
                val child = this[head] ?: return@apply
                this[head] = updateAtPath(child, tail, newValue)
            })
            is JsonArray -> {
                val idx = head.toIntOrNull() ?: return root
                JsonArray(root.toMutableList().apply {
                    if (idx in indices) this[idx] = updateAtPath(this[idx], tail, newValue)
                })
            }
            else -> root
        }
    }
}`,
  },
  {
    path: 'app/src/main/java/com/laudadmin/presentation/dashboard/JsonDashboardScreen.kt',
    description: 'Two-column Material 3 dashboard displaying stripped filenames without .json suffix',
    content: `package com.laudadmin.presentation.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

data class JsonFileCardUi(
    val path: String,
    val displayName: String, // e.g., "kind_master" (never ".json")
    val directory: String
)

@Composable
fun JsonDashboardGrid(
    files: List<JsonFileCardUi>,
    onFileClick: (JsonFileCardUi) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 160.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = modifier.fillMaxSize()
    ) {
        items(files, key = { it.path }) { item ->
            ElevatedCard(
                onClick = { onFileClick(item) },
                shape = MaterialTheme.shapes.large
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = item.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = item.directory.ifEmpty { "root" },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}`,
  },
];
