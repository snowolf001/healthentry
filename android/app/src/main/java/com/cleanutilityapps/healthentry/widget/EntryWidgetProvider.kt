package com.cleanutilityapps.healthentry.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.cleanutilityapps.healthentry.R

// Providers only launch the private foreground entry Activity. No health work here.
abstract class EntryWidgetProvider(private val layout: Int, private val action: String) : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val intent = Intent(context, WidgetEntryActivity::class.java).apply {
            // Qualify the provider preset: this Intent's action is null inside apply.
            data = Uri.parse("healthentry-widget://${this@EntryWidgetProvider.action}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        for (id in ids) {
            val views = RemoteViews(context.packageName, layout)
            views.setOnClickPendingIntent(R.id.widget_action, pending)
            manager.updateAppWidget(id, views)
        }
    }
}
class WaterWidgetProvider : EntryWidgetProvider(R.layout.water_widget, "water")
class CoffeeWidgetProvider : EntryWidgetProvider(R.layout.coffee_widget, "coffee")
class WeightWidgetProvider : EntryWidgetProvider(R.layout.weight_widget, "weight")
