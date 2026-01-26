import UIKit
import Capacitor
import FBSDKCoreKit
import AppTrackingTransparency
import AdSupport

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Meta SDK for Facebook Ads Attribution
        ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)
        
        // Debug logging
        print("=== META SDK DEBUG (iOS) ===")
        print("Facebook SDK initialized")
        print("App ID: \(Settings.shared.appID ?? "not set")")
        
        return true
    }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Request App Tracking Transparency authorization when app becomes active
        requestTrackingAuthorization()
    }
    
    private func requestTrackingAuthorization() {
        if #available(iOS 14.5, *) {
            ATTrackingManager.requestTrackingAuthorization { status in
                DispatchQueue.main.async {
                    switch status {
                    case .authorized:
                        // User granted permission - enable tracking
                        Settings.shared.isAutoLogAppEventsEnabled = true
                        Settings.shared.isAdvertiserIDCollectionEnabled = true
                        print("=== ATT DEBUG ===")
                        print("Tracking authorized")
                        print("IDFA: \(ASIdentifierManager.shared().advertisingIdentifier.uuidString)")
                    case .denied:
                        print("=== ATT DEBUG ===")
                        print("Tracking denied by user")
                        Settings.shared.isAdvertiserIDCollectionEnabled = false
                    case .notDetermined:
                        print("=== ATT DEBUG ===")
                        print("Tracking not determined")
                    case .restricted:
                        print("=== ATT DEBUG ===")
                        print("Tracking restricted")
                        Settings.shared.isAdvertiserIDCollectionEnabled = false
                    @unknown default:
                        print("=== ATT DEBUG ===")
                        print("Unknown tracking status")
                    }
                }
            }
        } else {
            // iOS < 14.5: No ATT required, enable tracking directly
            Settings.shared.isAutoLogAppEventsEnabled = true
            Settings.shared.isAdvertiserIDCollectionEnabled = true
            print("=== ATT DEBUG ===")
            print("iOS < 14.5 - ATT not required, tracking enabled")
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state.
    }

    // applicationDidBecomeActive is now handled above with ATT request

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle Facebook SDK URL callback
        if ApplicationDelegate.shared.application(app, open: url, options: options) {
            return true
        }
        // Handle Capacitor URLs
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
