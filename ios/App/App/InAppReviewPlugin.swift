import Capacitor

/// Capacitor plugin to bridge JavaScript calls to native StoreKit review
@objc(InAppReviewPlugin)
public class InAppReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "InAppReviewPlugin"
    public let jsName = "InAppReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasAlreadyRequested", returnType: CAPPluginReturnPromise)
    ]
    
    /// Request an in-app review
    @objc func requestReview(_ call: CAPPluginCall) {
        let result = InAppReviewHelper.requestReview()
        call.resolve([
            "requested": result
        ])
    }
    
    /// Check if a review has already been requested
    @objc func hasAlreadyRequested(_ call: CAPPluginCall) {
        call.resolve([
            "hasRequested": InAppReviewHelper.hasAlreadyRequested
        ])
    }
}
