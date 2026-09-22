package com.cleanutilityapps.healthentry.widget

import android.app.Application
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.view.View
import android.widget.TextView
import com.cleanutilityapps.healthentry.R
import org.junit.Assert.*
import org.junit.Test
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

// Use actual provider/RemoteViews/PendingIntent construction, not a hand-built action string.
// A plain Application keeps React Native and Health Connect out of these launch tests.
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = Application::class)
class EntryWidgetProviderTest {
    private val application = RuntimeEnvironment.getApplication()
    private val widgets = shadowOf(AppWidgetManager.getInstance(application))
    @Before fun resetPreferences() {
        application.getSharedPreferences("widget_preferences", 0).edit().clear().commit()
    }

    private fun click(id: Int): Intent {
        assertTrue(widgets.getViewFor(id).findViewById<View>(R.id.widget_action).performClick())
        // Android parcels each delivery. Robolectric returns its stored object, so copy it
        // before the Activity-style data clearing below to avoid mutating the PendingIntent.
        return Intent(requireNotNull(shadowOf(application).nextStartedActivity))
    }

    @Test fun firstWaterClickContainsPresetAndIsAcceptedExactlyOnce() {
        val widget = widgets.createWidget(WaterWidgetProvider::class.java, R.layout.water_widget)
        val intent = click(widget)
        assertEquals("healthentry-widget://water", intent.data.toString())
        assertEquals(WidgetEntryActivity::class.java.name, intent.component?.className)
        assertEquals(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP, intent.flags)
        val gate = WidgetSessionGate()
        val id = requireNotNull(gate.open(WidgetPreferences.action(application, intent.data?.host ?: ""), false,
            intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0))
        intent.data = null // Same consumption boundary as WidgetEntryActivity.
        assertEquals("water:8", gate.consume(id))
        assertNull(gate.consume(id))
        assertTrue(gate.beginWrite(id))
        assertFalse(gate.beginWrite(id))
        assertNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, false))
        assertFalse(gate.close(id)) // Destruction cannot release an in-flight write.
        gate.endWrite(id)
        assertTrue(gate.close(id))
        assertNull(gate.open(intent.data?.host, false, false)) // Cleared intent cannot replay.
        val next = requireNotNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, false))
        assertNotEquals(id, next)
        assertNull(gate.consume(id))
        assertFalse(gate.close(id)) // Old callback cannot close the new entry.
        assertEquals("water:8", gate.consume(next))
    }

    @Test fun coffeeOpensPrivateEntryAndRejectsStaleOrRepeatedSessions() {
        val widget = widgets.createWidget(CoffeeWidgetProvider::class.java, R.layout.coffee_widget)
        val intent = click(widget)
        assertEquals(WidgetEntryActivity::class.java.name, intent.component?.className)
        assertEquals("coffee", intent.data?.host)
        val gate = WidgetSessionGate()
        val id = requireNotNull(gate.open(WidgetPreferences.action(application, intent.data?.host ?: ""), false, false))
        intent.data = null
        assertEquals("coffee:ask", gate.consume(id))
        assertFalse(gate.beginWrite("stale"))
        assertNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, false))
        assertTrue(gate.beginWrite(id))
        assertFalse(gate.beginWrite(id))
        gate.endWrite(id)
        assertTrue(gate.close(id))
        assertFalse(gate.beginWrite(id))
        assertNull(gate.open(intent.data?.host, false, false))
        assertNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), true, false))
        assertNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, true))
    }

    @Test fun independentProvidersDoNotShareAnAccidentalNullPendingIntent() {
        val water = widgets.createWidget(WaterWidgetProvider::class.java, R.layout.water_widget)
        val coffee = widgets.createWidget(CoffeeWidgetProvider::class.java, R.layout.coffee_widget)
        val weight = widgets.createWidget(WeightWidgetProvider::class.java, R.layout.weight_widget)
        assertEquals("water", click(water).data?.host)
        assertEquals("coffee", click(coffee).data?.host)
        assertEquals("weight", click(weight).data?.host)
        assertEquals("water", click(water).data?.host)
    }

    @Test fun malformedOrRestoredDeliveryDoesNotPoisonTheNextLegitimateClick() {
        val widget = widgets.createWidget(WaterWidgetProvider::class.java, R.layout.water_widget)
        val gate = WidgetSessionGate()
        assertNull(gate.open("null", false, false)) // Original physical-device failure.
        assertNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), true, false))
        assertNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, true))
        val id = requireNotNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, false))
        assertEquals("water:8", gate.consume(id))
        assertTrue(gate.close(id))
        assertNotNull(gate.open(WidgetPreferences.action(application, click(widget).data?.host ?: ""), false, false))
    }

    @Test fun changingPreferencesRefreshesExistingCaptionsAndNextActions() {
        val water = widgets.createWidget(WaterWidgetProvider::class.java, R.layout.water_widget)
        val coffee = widgets.createWidget(CoffeeWidgetProvider::class.java, R.layout.coffee_widget)
        assertEquals("8 oz", widgets.getViewFor(water).findViewById<TextView>(R.id.widget_caption).text)
        assertEquals("Coffee", widgets.getViewFor(coffee).findViewById<TextView>(R.id.widget_caption).text)
        WidgetPreferences.save(application, 20.0, "coffee12")
        assertEquals("20 oz", widgets.getViewFor(water).findViewById<TextView>(R.id.widget_caption).text)
        assertEquals("12 oz", widgets.getViewFor(coffee).findViewById<TextView>(R.id.widget_caption).text)
        assertEquals("water:20", WidgetPreferences.action(application, click(water).data?.host ?: ""))
        assertEquals("coffee:coffee12", WidgetPreferences.action(application, click(coffee).data?.host ?: ""))
        WidgetPreferences.save(application, 20.0, "ask")
        assertEquals("Coffee", widgets.getViewFor(coffee).findViewById<TextView>(R.id.widget_caption).text)
        assertEquals("coffee:ask", WidgetPreferences.action(application, click(coffee).data?.host ?: ""))
    }
}
