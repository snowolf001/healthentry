package com.cleanutilityapps.healthentry

import android.app.AlertDialog
import android.app.Activity
import android.os.Bundle

/** Explains the action-driven, write-only V1 permissions. */
class HealthPermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    AlertDialog.Builder(this)
      .setTitle("HealthEntry: health access")
      .setMessage(
        "HealthEntry writes water, caffeine, weight, and blood pressure to Health Connect. " +
          "Nutrition write access is used specifically to save caffeine, not other nutrients. " +
          "Only the permission needed for your chosen action is requested. " +
          "The app does not read health data, keep a health history, or send it to a server. " +
          "It remembers only your preferred weight unit and last successfully submitted weight " +
          "to make the next entry faster. " +
          "Health Connect stores the record; manage or delete it and revoke access there. " +
          "Debug builds log permission status, the write timestamp, amount, record ID, and errors " +
          "to developer tools."
      )
      .setPositiveButton("Close") { _, _ -> finish() }
      .setOnCancelListener { finish() }
      .show()
  }
}
