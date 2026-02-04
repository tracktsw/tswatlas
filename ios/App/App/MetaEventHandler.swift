import WebKit
import FacebookCore

/// Handles Meta (Facebook) App Events from the Capacitor webview JavaScript bridge.
/// Events are received via WKScriptMessageHandler and forwarded to the Facebook SDK.
class MetaEventHandler: NSObject, WKScriptMessageHandler {
    
    /// Maps JS event names to Facebook SDK standard event constants
    private func getAppEventName(_ eventName: String) -> AppEvents.Name {
        switch eventName {
        case "StartTrial":
            return .startTrial
        case "Subscribe":
            return .subscribe
        case "CompletedRegistration":
            return .completedRegistration
        case "InitiatedCheckout":
            return .initiatedCheckout
        case "Purchase":
            return .purchased
        default:
            return AppEvents.Name(eventName) // Custom events
        }
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let eventName = body["eventName"] as? String else {
            print("[MetaEventHandler] Invalid message format")
            return
        }
        
        let parameters = body["parameters"] as? [String: Any] ?? [:]
        
        print("[MetaEventHandler] Logging event: \(eventName) with parameters: \(parameters)")
        
        // Get the mapped event name (standard or custom)
        let appEventName = getAppEventName(eventName)
        
        // Convert parameters to AppEvents.ParametersDictionary
        var appEventParams: [AppEvents.ParameterName: Any] = [:]
        for (key, value) in parameters {
            appEventParams[AppEvents.ParameterName(key)] = value
        }
        
        // Log the event to Facebook SDK
        if appEventParams.isEmpty {
            AppEvents.shared.logEvent(appEventName)
        } else {
            AppEvents.shared.logEvent(appEventName, parameters: appEventParams)
        }
        
        print("[MetaEventHandler] Event logged successfully: \(eventName) -> \(appEventName.rawValue)")
    }
}
