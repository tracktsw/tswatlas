/**
 * Platform-aware URLs for Terms of Use and subscription management.
 * Centralizes platform-specific link logic to ensure consistency across the app.
 */

export type Platform = 'ios' | 'android' | 'web';

/**
 * Returns the appropriate Terms of Use URL based on platform.
 * - iOS: Apple's standard EULA
 * - Android: Google Play Terms
 * - Web: Falls back to Apple EULA (can be customized)
 */
export const getTermsUrl = (platform: Platform): string => {
  switch (platform) {
    case 'ios':
      return 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
    case 'android':
      return 'https://play.google.com/about/play-terms/';
    default:
      // Web fallback - using Apple EULA as default
      return 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  }
};

/**
 * Returns the subscription management URL based on platform.
 * - iOS: App Store subscriptions
 * - Android: Google Play subscriptions
 * - Web: Stripe Customer Portal (handled separately)
 */
export const getManageSubscriptionUrl = (platform: Platform): string => {
  switch (platform) {
    case 'ios':
      return 'https://apps.apple.com/account/subscriptions';
    case 'android':
      return 'https://play.google.com/store/account/subscriptions';
    default:
      return '';
  }
};

/**
 * Privacy Policy URL - same across all platforms
 */
export const PRIVACY_POLICY_URL = 'https://tracktsw.com/privacy';
