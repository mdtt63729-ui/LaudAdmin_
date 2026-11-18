package com.laudadmin.core.json

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

class UndoRedoManager<T>(
    private val maxSteps: Int = 80
) {
    private val undoStack = ArrayDeque<T>()
    private val redoStack = ArrayDeque<T>()

    val canUndo: Boolean get() = undoStack.isNotEmpty()
    val canRedo: Boolean get() = redoStack.isNotEmpty()

    fun pushState(previousState: T) {
        if (undoStack.size >= maxSteps) undoStack.removeFirst()
        undoStack.addLast(previousState)
        redoStack.clear()
    }

    fun undo(currentState: T): T? {
        if (undoStack.isEmpty()) return null
        redoStack.addLast(currentState)
        return undoStack.removeLast()
    }

    fun redo(currentState: T): T? {
        if (redoStack.isEmpty()) return null
        undoStack.addLast(currentState)
        return redoStack.removeLast()
    }

    fun clear() {
        undoStack.clear()
        redoStack.clear()
    }
}

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
}
