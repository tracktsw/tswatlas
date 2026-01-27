import Foundation
import Capacitor
import AppTrackingTransparency
import FBSDKCoreKit

@objc(ATTPlugin)
public class ATTPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ATTPlugin"
    public let jsName = "ATT"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]
    
    @objc func requestTracking(_ call: CAPPluginCall) {
        if #available(iOS 14.5, *) {
            DispatchQueue.main.async {
                ATTrackingManager.requestTrackingAuthorization { status in
                    DispatchQueue.main.async {
                        let statusString = self.statusToString(status)
                        
                        // Configure Meta SDK based on authorization status
                        switch status {
                        case .authorized:
                            print("=== ATT Plugin: Authorized ===")
                            Settings.shared.isAutoLogAppEventsEnabled = true
                            Settings.shared.isAdvertiserIDCollectionEnabled = true
                        case .denied, .restricted:
                            print("=== ATT Plugin: Denied/Restricted ===")
                            Settings.shared.isAutoLogAppEventsEnabled = false
                            Settings.shared.isAdvertiserIDCollectionEnabled = false
                        case .notDetermined:
                            print("=== ATT Plugin: Not Determined ===")
                        @unknown default:
                            print("=== ATT Plugin: Unknown ===")
                        }
                        
                        call.resolve([
                            "status": statusString
                        ])
                    }
                }
            }
        } else {
            // iOS < 14.5: Tracking is allowed by default
            Settings.shared.isAutoLogAppEventsEnabled = true
            Settings.shared.isAdvertiserIDCollectionEnabled = true
            call.resolve([
                "status": "authorized"
            ])
        }
    }
    
    @objc func getStatus(_ call: CAPPluginCall) {
        if #available(iOS 14, *) {
            let status = ATTrackingManager.trackingAuthorizationStatus
            call.resolve([
                "status": statusToString(status)
            ])
        } else {
            call.resolve([
                "status": "authorized"
            ])
        }
    }
    
    @available(iOS 14, *)
    private func statusToString(_ status: ATTrackingManager.AuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "notDetermined"
        @unknown default:
            return "unknown"
        }
    }
}
