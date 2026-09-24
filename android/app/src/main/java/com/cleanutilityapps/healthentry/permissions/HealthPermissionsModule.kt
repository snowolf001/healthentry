package com.cleanutilityapps.healthentry.permissions

import com.cleanutilityapps.healthentry.NativeHealthPermissionsSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

class HealthPermissionsModule(context: ReactApplicationContext) : NativeHealthPermissionsSpec(context) {
    override fun getName() = NAME
    override fun requestWritePermission(recordType: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val owner = reactApplicationContext.currentActivity as? HealthPermissionOwner
            if (owner == null) promise.reject("permission_unavailable", "Open HealthEntry to grant permission.")
            else owner.healthPermissions.request(recordType, promise)
        }
    }
    override fun requestReadPermissions(recordTypes: com.facebook.react.bridge.ReadableArray, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val owner = reactApplicationContext.currentActivity as? HealthPermissionOwner
            if (owner == null) promise.reject("permission_unavailable", "Open HealthEntry to grant permission.")
            else owner.healthPermissions.requestRead(
                (0 until recordTypes.size()).mapNotNull { recordTypes.getString(it) },
                promise
            )
        }
    }

    override fun isHistoryReadAvailable(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val owner = reactApplicationContext.currentActivity as? HealthPermissionOwner
            if (owner == null) promise.resolve(false)
            else promise.resolve(owner.healthPermissions.isHistoryReadAvailable())
        }
    }

    override fun requestHistoryReadPermission(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val owner = reactApplicationContext.currentActivity as? HealthPermissionOwner
            if (owner == null) promise.reject("permission_unavailable", "Open HealthEntry to grant permission.")
            else owner.healthPermissions.requestHistoryRead(promise)
        }
    }

    companion object { const val NAME = "HealthPermissions" }
}
