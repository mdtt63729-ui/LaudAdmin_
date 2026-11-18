package com.laudadmin.data.github

import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

@Serializable
data class FileCommitDto(
    val sha: String,
    val message: String,
    val authorName: String,
    val date: String
)

class GitHubRepository(
    private val tokenProvider: suspend () -> String?
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchFileHistory(
        owner: String,
        repo: String,
        path: String,
        branch: String
    ): Result<List<FileCommitDto>> = withContext(Dispatchers.IO) {
        runCatching {
            val token = tokenProvider()
            val req = Request.Builder()
                .url("https://api.github.com/repos/$owner/$repo/commits?path=$path&sha=$branch&per_page=25")
                .apply { if (!token.isNullOrBlank()) header("Authorization", "Bearer $token") }
                .header("Accept", "application/vnd.github+json")
                .build()

            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) error("GitHub HTTP ${res.code}")
                val body = res.body?.string().orEmpty()
                val arr = org.json.JSONArray(body)
                buildList {
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        val commit = obj.getJSONObject("commit")
                        val author = commit.optJSONObject("author")
                        add(
                            FileCommitDto(
                                sha = obj.getString("sha"),
                                message = commit.getString("message"),
                                authorName = author?.optString("name", "Unknown") ?: "Unknown",
                                date = author?.optString("date", "") ?: ""
                            )
                        )
                    }
                }
            }
        }
    }

    suspend fun commitWithConflictCheck(
        owner: String,
        repo: String,
        path: String,
        branch: String,
        content: String,
        commitMessage: String,
        expectedSha: String
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val token = tokenProvider() ?: error("GitHub PAT required")
            val encoded = Base64.encodeToString(content.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
            val payload = JSONObject().apply {
                put("message", commitMessage)
                put("content", encoded)
                put("sha", expectedSha)
                put("branch", branch)
            }
            val req = Request.Builder()
                .url("https://api.github.com/repos/$owner/$repo/contents/$path")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .put(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            client.newCall(req).execute().use { res ->
                if (res.code == 409) error("Remote file changed (SHA conflict)")
                if (!res.isSuccessful) error("Commit failed (HTTP ${res.code})")
                val respJson = JSONObject(res.body?.string().orEmpty())
                respJson.getJSONObject("content").getString("sha")
            }
        }
    }
}
