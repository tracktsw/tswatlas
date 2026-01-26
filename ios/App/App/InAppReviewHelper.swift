import StoreKit
import UIKit

/// Helper class for requesting in-app reviews using StoreKit
/// This is called from JavaScript via a Capacitor plugin bridge
@objc public class InAppReviewHelper: NSObject {
    
    private static let hasRequestedReviewKey = "hasRequestedInAppReview"
    
    /// Check if a review has already been requested
    @objc public static var hasAlreadyRequested: Bool {
        return UserDefaults.standard.bool(forKey: hasRequestedReviewKey)
    }
    
    /// Request an in-app review using StoreKit
    /// - Returns: true if the request was made, false if already requested or failed
    @objc public static func requestReview() -> Bool {
        // Only request once per user
        if hasAlreadyRequested {
            print("=== InAppReview: Already requested, skipping ===")
            return false
        }
        
        // Mark as requested immediately to prevent duplicate calls
        UserDefaults.standard.set(true, forKey: hasRequestedReviewKey)
        
        // Ensure we're on the main thread and app is active
        DispatchQueue.main.async {
            guard let windowScene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else {
                print("=== InAppReview: No active window scene ===")
                return
            }
            
            print("=== InAppReview: Requesting review ===")
            SKStoreReviewController.requestReview(in: windowScene)
        }
        
        return true
    }
    
    /// Reset the review request flag (for testing purposes only)
    @objc public static func resetReviewFlag() {
        UserDefaults.standard.set(false, forKey: hasRequestedReviewKey)
        print("=== InAppReview: Reset flag ===")
    }
}
