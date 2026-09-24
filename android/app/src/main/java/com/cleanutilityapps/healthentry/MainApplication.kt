package com.cleanutilityapps.healthentry

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.cleanutilityapps.healthentry.preferences.WeightPreferencesPackage
import com.cleanutilityapps.healthentry.widget.WidgetActionsPackage
import com.cleanutilityapps.healthentry.pro.ProBillingPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(WeightPreferencesPackage())
          add(WidgetActionsPackage())
          add(ProBillingPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
