package com.cleanutilityapps.healthentry.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import android.widget.Toast
import androidx.lifecycle.Lifecycle
import com.cleanutilityapps.healthentry.NativeWidgetActionsSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

class WidgetActionsModule(context: ReactApplicationContext) : NativeWidgetActionsSpec(context) {
    override fun getName() = NAME
    override fun loadWidgetDiscovery(promise: Promise) {
        try {
            val manager = AppWidgetManager.getInstance(reactApplicationContext)
            val providers = listOf(
                WaterWidgetProvider::class.java,
                CoffeeWidgetProvider::class.java,
                WeightWidgetProvider::class.java,
                ExerciseWidgetProvider::class.java,
            )
            val hasWidget = providers.any { manager.getAppWidgetIds(ComponentName(reactApplicationContext, it)).isNotEmpty() }
            val dismissed = WidgetPreferences.isDiscoveryDismissed(reactApplicationContext)
            val pinSupported = Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported
            promise.resolve("{\"dismissed\":$dismissed,\"hasWidget\":$hasWidget,\"pinSupported\":$pinSupported}")
        } catch (error: Exception) {
            promise.reject("widget_discovery_load", "Could not load widget discovery state", error)
        }
    }
    override fun dismissWidgetDiscovery(promise: Promise) {
        try { WidgetPreferences.dismissDiscovery(reactApplicationContext); promise.resolve(null) }
        catch (error: Exception) { promise.reject("widget_discovery_save", "Could not dismiss widget discovery", error) }
    }
    override fun requestPinWidget(widget: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < 26) { promise.resolve(false); return }
            val provider = when (widget) {
                "water" -> WaterWidgetProvider::class.java
                "coffee" -> CoffeeWidgetProvider::class.java
                "weight" -> WeightWidgetProvider::class.java
                "exercise" -> ExerciseWidgetProvider::class.java
                else -> { promise.reject("widget_type", "Unknown widget type"); return }
            }
            val manager = AppWidgetManager.getInstance(reactApplicationContext)
            if (!manager.isRequestPinAppWidgetSupported) { promise.resolve(false); return }
            promise.resolve(manager.requestPinAppWidget(ComponentName(reactApplicationContext, provider), null, null))
        } catch (error: Exception) {
            promise.reject("widget_pin", "Could not request Home Screen widget", error)
        }
    }
    override fun loadPreferences(promise: Promise) {
        try { promise.resolve(WidgetPreferences.json(reactApplicationContext)) }
        catch (error: Exception) { promise.reject("preferences_load", "Could not load widget preferences", error) }
    }
    override fun loadRecentQuickEntries(promise: Promise) {
        try { promise.resolve(WidgetPreferences.recentQuickEntriesJson(reactApplicationContext)) }
        catch (error: Exception) { promise.reject("quick_entries_load", "Could not load recent quick entries", error) }
    }
    override fun saveRecentWaterOz(value: Double, promise: Promise) {
        try { WidgetPreferences.saveRecentWaterOz(reactApplicationContext, value); promise.resolve(null) }
        catch (error: Exception) { promise.reject("quick_entries_save", "Could not save recent water amount", error) }
    }
    override fun saveRecentMoveMinutes(value: Double, promise: Promise) {
        try { WidgetPreferences.saveRecentMoveMinutes(reactApplicationContext, value); promise.resolve(null) }
        catch (error: Exception) { promise.reject("quick_entries_save", "Could not save recent exercise duration", error) }
    }
    override fun savePreferences(waterOz: Double, coffeeDefault: String, moveMinutes: Double, moveName: String, promise: Promise) {
        try {
            WidgetPreferences.save(reactApplicationContext, waterOz, coffeeDefault, moveMinutes, moveName)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("preferences_save", "Could not save widget preferences", error)
        }
    }
    override fun consumeLaunch(sessionId: String, promise: Promise) {
        promise.resolve(WidgetEntryActivity.gate.consume(sessionId))
    }
    override fun beginWrite(sessionId: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val activity = WidgetEntryActivity.current?.get()
            val foreground = activity?.sessionId == sessionId &&
                activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            promise.resolve(foreground && WidgetEntryActivity.gate.beginWrite(sessionId))
        }
    }
    override fun endWrite(sessionId: String, promise: Promise) {
        WidgetEntryActivity.gate.endWrite(sessionId)
        promise.resolve(null)
    }
    override fun finish(sessionId: String, message: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            if (WidgetEntryActivity.gate.close(sessionId)) {
                if (message.isNotEmpty()) Toast.makeText(reactApplicationContext, message, Toast.LENGTH_SHORT).show()
                WidgetEntryActivity.current?.get()?.takeIf { it.sessionId == sessionId }?.finishAndRemoveTask()
            }
            promise.resolve(null)
        }
    }
    companion object { const val NAME = "WidgetActions" }
}
