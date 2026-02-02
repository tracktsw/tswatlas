import WebKit
import FacebookCore

/// Handles Meta (Facebook) App Events from the Capacitor webview JavaScript bridge.
/// Events are received via WKScriptMessageHandler and forwarded to the Facebook SDK.
class MetaEventHandler: NSObject, WKScriptMessageHandler {
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let eventName = body["eventName"] as? String else {
            print("[MetaEventHandler] Invalid message format")
            return
        }
        
        let parameters = body["parameters"] as? [String: Any] ?? [:]
        
        print("[MetaEventHandler] Logging event: \(eventName) with parameters: \(parameters)")
        
        // Convert parameters to AppEvents.ParametersDictionary
        var appEventParams: [AppEvents.ParameterName: Any] = [:]
        for (key, value) in parameters {
            appEventParams[AppEvents.ParameterName(key)] = value
        }
        
        // Log the event to Facebook SDK
        if appEventParams.isEmpty {
            AppEvents.shared.logEvent(AppEvents.Name(eventName))
        } else {
            AppEvents.shared.logEvent(AppEvents.Name(eventName), parameters: appEventParams)
        }
        
        print("[MetaEventHandler] Event logged successfully: \(eventName)")
    }
}
