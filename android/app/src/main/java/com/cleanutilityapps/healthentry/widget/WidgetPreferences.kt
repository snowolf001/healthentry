package com.cleanutilityapps.healthentry.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import org.json.JSONObject

data class WidgetDefaults(val waterOz: Double = 8.0, val coffeeDefault: String = "ask", val moveMinutes: Int = 5)

object WidgetPreferences {
    private const val STORE = "widget_preferences"
    private const val WATER = "water_oz"
    private const val COFFEE = "coffee_default"
    private const val MOVE_MINUTES = "move_minutes"
    val coffeeValues = setOf("ask", "coffee8", "coffee12", "coffee16", "espresso1", "espresso2", "espresso3")

    fun load(context: Context): WidgetDefaults {
        val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)
        val water = preferences.getString(WATER, "8")?.toDoubleOrNull()?.takeIf { it.isFinite() && it in 1.0..99.0 } ?: 8.0
        val coffee = preferences.getString(COFFEE, "ask")?.takeIf { it in coffeeValues } ?: "ask"
        val moveMinutes = preferences.getInt(MOVE_MINUTES, 5).takeIf { it in 1..240 } ?: 5
        return WidgetDefaults(water, coffee, moveMinutes)
    }

    fun save(context: Context, waterOz: Double, coffeeDefault: String, moveMinutes: Double) {
        require(waterOz.isFinite() && waterOz in 1.0..99.0)
        require(coffeeDefault in coffeeValues)
        require(moveMinutes.isFinite() && moveMinutes % 1.0 == 0.0 && moveMinutes in 1.0..240.0)
        check(context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit()
            .putString(WATER, waterOz.toString()).putString(COFFEE, coffeeDefault)
            .putInt(MOVE_MINUTES, moveMinutes.toInt()).commit())
        refresh(context)
    }

    fun json(context: Context): String = load(context).let {
        JSONObject().put("waterOz", it.waterOz).put("coffeeDefault", it.coffeeDefault)
            .put("moveMinutes", it.moveMinutes).toString()
    }

    fun action(context: Context, widget: String): String? {
        val value = load(context)
        return when (widget) {
            "water" -> "water:${format(value.waterOz)}"
            "coffee" -> "coffee:${value.coffeeDefault}"
            "weight" -> "weight"
            else -> null
        }
    }

    fun waterCaption(value: Double) = "${format(value)} oz"
    fun coffeeCaption(value: String) = when (value) {
        "coffee8" -> "8 oz"; "coffee12" -> "12 oz"; "coffee16" -> "16 oz"
        "espresso1" -> "1 shot"; "espresso2" -> "2 shots"; "espresso3" -> "3 shots"
        else -> "Coffee"
    }
    private fun format(value: Double) = if (value % 1.0 == 0.0) value.toInt().toString() else value.toString()

    fun refresh(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        listOf(WaterWidgetProvider::class.java, CoffeeWidgetProvider::class.java).forEach { provider ->
            val ids = manager.getAppWidgetIds(ComponentName(context, provider))
            when (provider) {
                WaterWidgetProvider::class.java -> WaterWidgetProvider().onUpdate(context, manager, ids)
                CoffeeWidgetProvider::class.java -> CoffeeWidgetProvider().onUpdate(context, manager, ids)
            }
        }
    }
}
