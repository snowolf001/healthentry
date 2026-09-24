package com.cleanutilityapps.healthentry.pro

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ProBillingPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == ProBillingModule.NAME) ProBillingModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(ProBillingModule.NAME to ReactModuleInfo(ProBillingModule.NAME, ProBillingModule.NAME, false, false, false, true))
    }
}
