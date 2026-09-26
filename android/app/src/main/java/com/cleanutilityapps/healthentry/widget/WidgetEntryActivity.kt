package com.cleanutilityapps.healthentry.widget

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.cleanutilityapps.healthentry.permissions.HealthPermissionHost
import com.cleanutilityapps.healthentry.permissions.HealthPermissionOwner
import com.cleanutilityapps.healthentry.pro.ProAccess
import java.lang.ref.WeakReference

class WidgetEntryActivity : ReactActivity(), HealthPermissionOwner {
    override lateinit var healthPermissions: HealthPermissionHost
    var sessionId: String = ""
        private set

    override fun onCreate(savedInstanceState: Bundle?) {
        if (!ProAccess.widgetAllowed(this)) {
            intent.data = null
            healthPermissions = HealthPermissionHost(this)
            super.onCreate(savedInstanceState)
            Toast.makeText(this, "Widget trial ended. Upgrade to Pro for continued access.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, com.cleanutilityapps.healthentry.MainActivity::class.java))
            finishAndRemoveTask()
            return
        }
        val action = WidgetPreferences.action(this, intent.data?.host ?: "")
        sessionId = gate.open(action, savedInstanceState != null,
            intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) ?: ""
        // Clear even rejected/restored launches before React or task restoration can inspect them.
        intent.data = null
        healthPermissions = HealthPermissionHost(this)
        super.onCreate(savedInstanceState)
        if (sessionId.isEmpty()) {
            Toast.makeText(this, "Entry unavailable. Tap the widget again when ready.", Toast.LENGTH_SHORT).show()
            finishAndRemoveTask()
        } else current = WeakReference(this)
    }
    override fun onNewIntent(intent: Intent) {
        // One input surface/operation at a time; never queue rapid taps or emit URL events.
        intent.data = null
        setIntent(intent)
        Toast.makeText(this, "Finish the current entry first.", Toast.LENGTH_SHORT).show()
    }
    override fun onDestroy() {
        gate.close(sessionId) // A write already in flight retains its lock until its callback.
        if (current?.get() === this) current = null
        super.onDestroy()
    }
    override fun getMainComponentName() = "HealthEntryWidget"
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        object : DefaultReactActivityDelegate(this, mainComponentName) {
            override fun getLaunchOptions() = Bundle().apply { putString("sessionId", sessionId) }
        }
    companion object {
        val gate = WidgetSessionGate()
        var current: WeakReference<WidgetEntryActivity>? = null
    }
}
