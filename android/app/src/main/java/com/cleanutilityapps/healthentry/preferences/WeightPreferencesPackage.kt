package com.cleanutilityapps.healthentry.preferences

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class WeightPreferencesPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == WeightPreferencesModule.NAME) WeightPreferencesModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(WeightPreferencesModule.NAME to ReactModuleInfo(
            WeightPreferencesModule.NAME, WeightPreferencesModule.NAME,
            false, false, false, true,
        ))
    }
}
