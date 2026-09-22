package com.cleanutilityapps.healthentry.widget

import com.cleanutilityapps.healthentry.permissions.HealthPermissionsModule
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class WidgetActionsPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = when (name) {
        WidgetActionsModule.NAME -> WidgetActionsModule(reactContext)
        HealthPermissionsModule.NAME -> HealthPermissionsModule(reactContext)
        else -> null
    }
    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        listOf(WidgetActionsModule.NAME, HealthPermissionsModule.NAME).associateWith { name ->
            ReactModuleInfo(name, name, false, false, false, true)
        }
    }
}
