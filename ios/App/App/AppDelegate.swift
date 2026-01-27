import UIKit
import Capacitor
import FacebookCore
import FacebookAEM  // Change from FBAEMKit to FacebookAEM
import AppTrackingTransparency

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        print("=== App Starting ===")
        
        // Initialize Facebook SDK
        ApplicationDelegate.shared.application(
            application,
            didFinishLaunchingWithOptions: launchOptions
        )
        print("=== Facebook SDK initialized ===")
        
        // Enable AEM
        print("=== About to enable AEM ===")
        AEMReporter.enable()
        print("=== Facebook AEM enabled ===")
        
        print("App ID: \(Settings.shared.appID ?? "Not set")")
        
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        print("=== App became active ===")
        
        if #available(iOS 14.5, *) {
            ATTrackingManager.requestTrackingAuthorization { status in
                DispatchQueue.main.async {
                    print("=== ATT Status: \(status.rawValue) ===")
                    
                    switch status {
                    case .authorized:
                        print("✅ Tracking Authorized")
                        Settings.shared.isAdvertiserTrackingEnabled = true
                    case .denied:
                        print("❌ Tracking Denied")
                        Settings.shared.isAdvertiserTrackingEnabled = false
                    case .restricted:
                        print("⚠️ Tracking Restricted")
                        Settings.shared.isAdvertiserTrackingEnabled = false
                    case .notDetermined:
                        print("❓ Tracking Not Determined")
                    @unknown default:
                        print("❓ Unknown Tracking Status")
                    }
                }
            }
        } else {
            Settings.shared.isAdvertiserTrackingEnabled = true
            print("=== iOS < 14.5: Tracking enabled by default ===")
        }
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        print("=== URL Opened: \(url) ===")
        
        // Handle AEM URL for conversion tracking
        AEMReporter.handle(url)
        
        // Handle Facebook SDK URL callback
        if ApplicationDelegate.shared.application(app, open: url, options: options) {
            print("✅ Facebook SDK handled URL")
            return true
        }
        
        // Handle Capacitor URLs
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
