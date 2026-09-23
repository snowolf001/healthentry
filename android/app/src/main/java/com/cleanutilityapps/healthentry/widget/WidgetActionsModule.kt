package com.cleanutilityapps.healthentry.widget

import android.widget.Toast
import androidx.lifecycle.Lifecycle
import com.cleanutilityapps.healthentry.NativeWidgetActionsSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

class WidgetActionsModule(context: ReactApplicationContext) : NativeWidgetActionsSpec(context) {
    override fun getName() = NAME
    override fun loadPreferences(promise: Promise) {
        try { promise.resolve(WidgetPreferences.json(reactApplicationContext)) }
        catch (error: Exception) { promise.reject("preferences_load", "Could not load widget preferences", error) }
    }
    override fun savePreferences(waterOz: Double, coffeeDefault: String, moveMinutes: Double, promise: Promise) {
        try {
            WidgetPreferences.save(reactApplicationContext, waterOz, coffeeDefault, moveMinutes)
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
