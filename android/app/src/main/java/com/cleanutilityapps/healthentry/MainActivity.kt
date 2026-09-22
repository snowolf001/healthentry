package com.cleanutilityapps.healthentry

import android.os.Bundle
import android.content.Intent
import com.cleanutilityapps.healthentry.permissions.HealthPermissionHost
import com.cleanutilityapps.healthentry.permissions.HealthPermissionOwner
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity(), HealthPermissionOwner {

  override lateinit var healthPermissions: HealthPermissionHost

  override fun onCreate(savedInstanceState: Bundle?) {
    // Widgets have their own private Activity; old development URLs are inert.
    intent.data = null
    super.onCreate(savedInstanceState)
    healthPermissions = HealthPermissionHost(this)
  }

  override fun onNewIntent(intent: Intent) {
    intent.data = null
    setIntent(intent)
    super.onNewIntent(intent)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "QuickHealthInput"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
