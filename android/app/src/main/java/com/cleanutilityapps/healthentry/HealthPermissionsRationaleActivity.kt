package com.cleanutilityapps.healthentry

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Health Connect sends its Privacy Policy / permission-rationale intents here.
 * Keep this destination identical to the privacy policy supplied in Play Console.
 */
class HealthPermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val privacyPolicy = Uri.parse("https://cleanutilityapps.com/healthentry/privacy/")
    try {
      startActivity(Intent(Intent.ACTION_VIEW, privacyPolicy))
    } finally {
      finish()
    }
  }
}
