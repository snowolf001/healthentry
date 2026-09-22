package com.cleanutilityapps.healthentry.widget

import java.util.UUID

// Process-local delivery state only. Never store values, health records, or receipts.
class WidgetSessionGate {
    private data class Session(val id: String, val action: String, var claimed: Boolean = false, var writing: Boolean = false)
    private var active: Session? = null

    @Synchronized fun open(action: String?, restored: Boolean, fromHistory: Boolean): String? {
        if (restored || fromHistory || active != null || action !in setOf("water", "coffee", "weight")) return null
        return UUID.randomUUID().toString().also { active = Session(it, action!!) }
    }
    @Synchronized fun consume(id: String): String? {
        val session = active?.takeIf { it.id == id && !it.claimed } ?: return null
        session.claimed = true
        return session.action
    }
    @Synchronized fun beginWrite(id: String): Boolean {
        val session = active?.takeIf { it.id == id && it.claimed && !it.writing } ?: return false
        session.writing = true
        return true
    }
    @Synchronized fun endWrite(id: String) { active?.takeIf { it.id == id }?.writing = false }
    @Synchronized fun close(id: String): Boolean {
        if (active?.let { it.id == id && !it.writing } != true) return false
        active = null
        return true
    }
}
