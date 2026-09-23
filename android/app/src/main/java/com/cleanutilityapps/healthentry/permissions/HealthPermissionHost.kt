package com.cleanutilityapps.healthentry.permissions

import androidx.activity.ComponentActivity
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Promise

interface HealthPermissionOwner { val healthPermissions: HealthPermissionHost }

// Each Activity owns its launcher. No global launcher pointing at a destroyed Activity.
class HealthPermissionHost(private val activity: ComponentActivity) : DefaultLifecycleObserver {
    private var pending: Promise? = null
    private var permission: String? = null
    private var launched = false
    private val launcher = activity.registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val result = pending
        val expected = permission
        pending = null
        permission = null
        launched = false
        result?.resolve(expected != null && expected in granted)
    }
    init { activity.lifecycle.addObserver(this) }

    fun request(recordType: String, promise: Promise) {
        if (pending != null) {
            promise.reject("permission_busy", "A permission request is already open.")
            return
        }
        val requested = when (recordType) {
            "Hydration" -> HealthPermission.getWritePermission(HydrationRecord::class)
            "Nutrition" -> HealthPermission.getWritePermission(NutritionRecord::class)
            "Weight" -> HealthPermission.getWritePermission(WeightRecord::class)
            "BloodPressure" -> HealthPermission.getWritePermission(BloodPressureRecord::class)
            "ExerciseSession" -> HealthPermission.getWritePermission(ExerciseSessionRecord::class)
            else -> null
        }
        if (requested == null || activity.lifecycle.currentState == Lifecycle.State.DESTROYED) {
            promise.reject("permission_unavailable", "Permission request unavailable.")
            return
        }
        pending = promise
        permission = requested
        launchIfResumed()
    }
    private fun launchIfResumed() {
        val requested = permission ?: return
        if (launched || !activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) return
        launched = true
        try { launcher.launch(setOf(requested)) } catch (error: Exception) {
            pending?.reject("permission_cancelled", "Permission request cancelled.", error)
            pending = null
            permission = null
            launched = false
        }
    }
    override fun onResume(owner: LifecycleOwner) { launchIfResumed() }
    override fun onDestroy(owner: LifecycleOwner) {
        pending?.reject("permission_cancelled", "Permission request cancelled.")
        pending = null
        permission = null
    }
}
