import UIKit
import Capacitor
import AppTrackingTransparency
import FBSDKCoreKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var hasRequestedATT = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
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

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Request ATT permission when app becomes active (only once)
        if #available(iOS 14.5, *) {
            if !hasRequestedATT {
                hasRequestedATT = true
                // Small delay to ensure app is fully active
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    ATTrackingManager.requestTrackingAuthorization { status in
                        DispatchQueue.main.async {
                            switch status {
                            case .authorized:
                                print("=== ATT: Authorized ===")
                                Settings.shared.isAutoLogAppEventsEnabled = true
                                Settings.shared.isAdvertiserIDCollectionEnabled = true
                            case .denied:
                                print("=== ATT: Denied ===")
                                Settings.shared.isAutoLogAppEventsEnabled = false
                                Settings.shared.isAdvertiserIDCollectionEnabled = false
                            case .restricted:
                                print("=== ATT: Restricted ===")
                                Settings.shared.isAutoLogAppEventsEnabled = false
                                Settings.shared.isAdvertiserIDCollectionEnabled = false
                            case .notDetermined:
                                print("=== ATT: Not Determined ===")
                            @unknown default:
                                print("=== ATT: Unknown ===")
                            }
                        }
                    }
                }
            }
        } else {
            // iOS < 14.5: Tracking is allowed by default
            Settings.shared.isAutoLogAppEventsEnabled = true
            Settings.shared.isAdvertiserIDCollectionEnabled = true
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url.
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
