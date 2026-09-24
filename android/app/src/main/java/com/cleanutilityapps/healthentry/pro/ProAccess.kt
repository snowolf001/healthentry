package com.cleanutilityapps.healthentry.pro

import android.content.Context

object ProAccess {
    private const val STORE = "pro_access"
    private const val ACTIVE = "active"
    private const val WIDGET_TRIAL_STARTED = "widget_trial_started_ms"
    private const val TRIAL_MS = 14L * 24 * 60 * 60 * 1000

    fun isPro(context: Context): Boolean =
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getBoolean(ACTIVE, false)

    fun setPro(context: Context, active: Boolean) {
        context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putBoolean(ACTIVE, active).apply()
    }

    fun widgetAllowed(context: Context, nowMs: Long = System.currentTimeMillis()): Boolean {
        if (isPro(context)) return true
        val prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
        var started = prefs.getLong(WIDGET_TRIAL_STARTED, 0L)
        if (started == 0L) {
            started = nowMs
            prefs.edit().putLong(WIDGET_TRIAL_STARTED, started).apply()
        }
        return nowMs - started < TRIAL_MS
    }

    fun stateJson(context: Context, nowMs: Long = System.currentTimeMillis()): String {
        val prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
        val started = prefs.getLong(WIDGET_TRIAL_STARTED, 0L)
        val remaining = if (started == 0L) TRIAL_MS else (TRIAL_MS - (nowMs - started)).coerceAtLeast(0L)
        return org.json.JSONObject()
            .put("isPro", isPro(context))
            .put("widgetTrialStarted", started > 0L)
            .put("widgetTrialDaysRemaining", kotlin.math.ceil(remaining / 86400000.0).toInt())
            .toString()
    }
}
