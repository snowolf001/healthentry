package com.cleanutilityapps.healthentry.pro

import android.content.Context
import com.cleanutilityapps.healthentry.BuildConfig

object ProAccess {
    private const val STORE = "pro_access"
    private const val ACTIVE = "active"
    private const val WIDGET_TRIAL_STARTED = "widget_trial_started_ms"
    private const val DEBUG_OVERRIDE = "debug_pro_override"
    private const val TRIAL_MS = 1L * 24 * 60 * 60 * 1000 // TEMP: 1 day for Free vs Pro testing

    fun isPro(context: Context): Boolean =
        debugOverride(context) || context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getBoolean(ACTIVE, false)

    fun debugOverride(context: Context): Boolean =
        BuildConfig.DEBUG && context.getSharedPreferences(STORE, Context.MODE_PRIVATE).getBoolean(DEBUG_OVERRIDE, false)

    fun setDebugOverride(context: Context, active: Boolean) {
        if (BuildConfig.DEBUG) context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putBoolean(DEBUG_OVERRIDE, active).apply()
    }

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
            .put("debugProOverride", debugOverride(context))
            .put("widgetTrialStarted", started > 0L)
            .put("widgetTrialDaysRemaining", kotlin.math.ceil(remaining / 86400000.0).toInt())
            .toString()
    }
}
