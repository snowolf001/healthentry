package com.cleanutilityapps.healthentry.preferences

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.cleanutilityapps.healthentry.NativeWeightPreferencesSpec
import org.json.JSONObject
import java.util.concurrent.Executors

class WeightPreferencesModule(context: ReactApplicationContext) : NativeWeightPreferencesSpec(context) {
    private val preferences = context.getSharedPreferences("weight_input_preferences", Context.MODE_PRIVATE)
    // Ordered IO away from the UI thread. commit() lets JS distinguish durable-save failures.
    private val io = Executors.newSingleThreadExecutor()

    override fun getName() = NAME

    override fun load(promise: Promise) {
        io.execute {
            try {
                promise.resolve(preferences.getString("value", "{}"))
            } catch (error: Exception) {
                promise.reject("preferences_load", "Could not load weight preferences", error)
            }
        }
    }

    override fun save(value: String, promise: Promise) {
        io.execute {
            try {
                val input = JSONObject(value)
                val unit = input.getString("unit")
                require(unit == "lb" || unit == "kg")
                val kg = if (input.isNull("lastEnteredWeightKg")) null else input.getDouble("lastEnteredWeightKg")
                require(kg == null || (kg.isFinite() && kg >= 10 && kg <= 450))
                // Whitelist precisely two fields; never persist timestamps or extra data.
                val clean = JSONObject().put("unit", unit).put("lastEnteredWeightKg", kg ?: JSONObject.NULL)
                if (!preferences.edit().putString("value", clean.toString()).commit()) {
                    throw IllegalStateException("Preference commit failed")
                }
                promise.resolve(null)
            } catch (error: Exception) {
                promise.reject("preferences_save", "Could not save weight preferences", error)
            }
        }
    }

    override fun invalidate() {
        io.shutdown()
        super.invalidate()
    }

    companion object { const val NAME = "WeightPreferences" }
}
