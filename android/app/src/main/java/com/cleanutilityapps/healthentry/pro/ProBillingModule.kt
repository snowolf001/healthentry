package com.cleanutilityapps.healthentry.pro

import com.android.billingclient.api.*
import com.cleanutilityapps.healthentry.NativeProBillingSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import org.json.JSONArray
import org.json.JSONObject

class ProBillingModule(context: ReactApplicationContext) : NativeProBillingSpec(context), PurchasesUpdatedListener {
    private var pendingPurchase: Promise? = null
    private var client: BillingClient? = null

    override fun getName() = NAME

    private fun billing(): BillingClient {
        client?.let { return it }
        return BillingClient.newBuilder(reactApplicationContext)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build().also { client = it }
    }

    private fun connect(onReady: (BillingClient) -> Unit, onError: (String) -> Unit) {
        val billing = billing()
        if (billing.isReady) { onReady(billing); return }
        billing.startConnection(object : BillingClientStateListener {
            override fun onBillingServiceDisconnected() {}
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) onReady(billing)
                else onError(result.debugMessage.ifBlank { "Google Play Billing unavailable." })
            }
        })
    }

    override fun getState(promise: Promise) {
        connect({ billing ->
            billing.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
            ) { result, purchases ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    promise.resolve(ProAccess.stateJson(reactApplicationContext)); return@queryPurchasesAsync
                }
                val active = purchases.any { it.purchaseState == Purchase.PurchaseState.PURCHASED && it.products.any(PRO_IDS::contains) }
                ProAccess.setPro(reactApplicationContext, active)
                promise.resolve(ProAccess.stateJson(reactApplicationContext))
            }
        }, { promise.resolve(ProAccess.stateJson(reactApplicationContext)) })
    }

    override fun setDebugProOverride(active: Boolean, promise: Promise) {
        ProAccess.setDebugOverride(reactApplicationContext, active)
        promise.resolve(ProAccess.stateJson(reactApplicationContext))
    }

    override fun loadProducts(promise: Promise) {
        connect({ billing ->
            val products = PRO_IDS.map {
                QueryProductDetailsParams.Product.newBuilder().setProductId(it)
                    .setProductType(BillingClient.ProductType.SUBS).build()
            }
            billing.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(products).build()
            ) { result, queryResult ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    promise.reject("billing_products", result.debugMessage); return@queryProductDetailsAsync
                }
                val array = JSONArray()
                queryResult.productDetailsList.forEach { detail ->
                    val offer = detail.subscriptionOfferDetails?.firstOrNull()
                    val phase = offer?.pricingPhases?.pricingPhaseList?.firstOrNull()
                    array.put(JSONObject().put("productId", detail.productId)
                        .put("title", detail.title).put("price", phase?.formattedPrice ?: "")
                        .put("offerToken", offer?.offerToken ?: ""))
                }
                promise.resolve(array.toString())
            }
        }, { promise.reject("billing_connect", it) })
    }

    override fun purchase(productId: String, promise: Promise) {
        if (productId !in PRO_IDS) { promise.reject("billing_product", "Unknown subscription."); return }
        if (pendingPurchase != null) { promise.reject("billing_busy", "A purchase is already in progress."); return }
        connect({ billing ->
            val query = QueryProductDetailsParams.newBuilder().setProductList(listOf(
                QueryProductDetailsParams.Product.newBuilder().setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS).build()
            )).build()
            billing.queryProductDetailsAsync(query) { result, queryResult ->
                val detail = queryResult.productDetailsList.firstOrNull()
                val offer = detail?.subscriptionOfferDetails?.firstOrNull()
                val activity = getCurrentActivity()
                if (result.responseCode != BillingClient.BillingResponseCode.OK || detail == null || offer == null || activity == null) {
                    promise.reject("billing_purchase", result.debugMessage.ifBlank { "Subscription is unavailable." }); return@queryProductDetailsAsync
                }
                pendingPurchase = promise
                UiThreadUtil.runOnUiThread {
                    val params = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(detail).setOfferToken(offer.offerToken).build()
                    val launch = billing.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(params)).build())
                    if (launch.responseCode != BillingClient.BillingResponseCode.OK) {
                        pendingPurchase = null
                        promise.reject("billing_launch", launch.debugMessage)
                    }
                }
            }
        }, { promise.reject("billing_connect", it) })
    }

    override fun restore(promise: Promise) = getState(promise)

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val promise = pendingPurchase ?: return
        if (result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            pendingPurchase = null; promise.resolve(ProAccess.stateJson(reactApplicationContext)); return
        }
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            pendingPurchase = null; promise.reject("billing_update", result.debugMessage); return
        }
        val purchase = purchases?.firstOrNull { it.products.any(PRO_IDS::contains) }
        if (purchase == null) { pendingPurchase = null; promise.reject("billing_purchase", "Purchase was not returned by Google Play."); return }
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            fun finish() {
                ProAccess.setPro(reactApplicationContext, true)
                pendingPurchase = null
                promise.resolve(ProAccess.stateJson(reactApplicationContext))
            }
            if (purchase.isAcknowledged) finish()
            else billing().acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
            ) { ack -> if (ack.responseCode == BillingClient.BillingResponseCode.OK) finish() else {
                pendingPurchase = null; promise.reject("billing_ack", ack.debugMessage)
            }}
        } else {
            pendingPurchase = null
            promise.resolve(ProAccess.stateJson(reactApplicationContext))
        }
    }

    companion object {
        const val NAME = "ProBilling"
        val PRO_IDS = setOf("healthentry_pro_monthly", "healthentry_pro_yearly")
    }
}
