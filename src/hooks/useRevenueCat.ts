import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

// RevenueCat types (since we import dynamically)
interface PurchasesPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    priceString: string;
    price: number;
    currencyCode: string;
    subscriptionPeriod?: string;
  };
  offeringIdentifier: string;
}

interface RevenueCatOffering {
  identifier: string;
  serverDescription: string;
  availablePackages: PurchasesPackage[];
  monthly?: PurchasesPackage;
}

interface CustomerInfo {
  entitlements: {
    active: Record<string, {
      identifier: string;
      isActive: boolean;
      willRenew: boolean;
      periodType: string;
      latestPurchaseDate: string;
      originalPurchaseDate: string;
      expirationDate: string | null;
      productIdentifier: string;
    }>;
    all: Record<string, unknown>;
  };
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  originalAppUserId: string;
}

// Platform detection (runtime) - MUST be called at runtime, not module load
export const getIsNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
export const getIsNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export const getIsNativeMobile = () => getIsNativeIOS() || getIsNativeAndroid();

// Backwards-compatible constant - DO NOT use for routing logic, use getIsNativeIOS()
export const isIOSNative = getIsNativeIOS();

const REVENUECAT_IOS_KEY = 'appl_rgvRTJPduIhlItjWllSWcPCuwkn';
const REVENUECAT_ANDROID_KEY = 'goog_AptGipsbvRtbMTkDAeqPcEauAGJ';

const getRevenueCatKey = () => {
  if (getIsNativeIOS()) return REVENUECAT_IOS_KEY;
  if (getIsNativeAndroid()) return REVENUECAT_ANDROID_KEY;
  return null;
};

// CRITICAL: The entitlement identifier MUST match exactly what's in RevenueCat dashboard
const PREMIUM_ENTITLEMENT_ID = 'premium';

// Get the correct offering identifier based on platform
const getOfferingIdentifier = () => {
  if (getIsNativeIOS()) return 'default';
  if (getIsNativeAndroid()) return 'default2';
  return 'default';
};

export interface RevenueCatState {
  isIOSNative: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  offeringsStatus: 'idle' | 'loading' | 'ready' | 'error';
  offeringsError: string | null;
  currentOffering: RevenueCatOffering | null;
  monthlyPackage: PurchasesPackage | null;
  // Single source of truth for premium status from RevenueCat
  isPremiumFromRC: boolean;
  customerInfo: CustomerInfo | null;
  appUserId: string | null;
  lastCustomerInfoRefresh: Date | null;
  // The internal user ID we initialized with - MUST match for premium access
  boundUserId: string | null;
}

export const useRevenueCat = () => {
  // CRITICAL: All state defaults to false/null - premium is NEVER assumed
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [offeringsStatus, setOfferingsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [currentOffering, setCurrentOffering] = useState<RevenueCatOffering | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  
  // CRITICAL: Premium defaults to FALSE - must be explicitly confirmed from RevenueCat
  const [isPremiumFromRC, setIsPremiumFromRC] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [lastCustomerInfoRefresh, setLastCustomerInfoRefresh] = useState<Date | null>(null);
  
  // CRITICAL: Track the internal user ID we bound to RevenueCat
  // Premium access is ONLY valid when this matches the current logged-in user
  // This ref is cleared on logout and set on login
  const boundUserIdRef = useRef<string | null>(null);
  const [boundUserId, setBoundUserId] = useState<string | null>(null);

  // Helper to check premium from CustomerInfo
  // CRITICAL: Also validates that the subscription belongs to the bound user
  const checkPremiumFromCustomerInfo = useCallback((info: CustomerInfo | null, expectedUserId?: string): boolean => {
    if (!info) return false;
    
    // SECURITY: Verify the originalAppUserId matches the user we initialized with
    const originalAppUserId = info.originalAppUserId;
    const userIdToCheck = expectedUserId || boundUserIdRef.current;
    
    if (userIdToCheck && originalAppUserId && originalAppUserId !== userIdToCheck) {
      console.warn('[RevenueCat] SECURITY: Subscription belongs to different user!', {
        expectedUserId: userIdToCheck,
        originalAppUserId,
      });
      return false;
    }
    
    // Check if the premium entitlement exists in active entitlements
    const premiumEntitlement = info.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
    const isActive = premiumEntitlement !== undefined;
    
    console.log('[RevenueCat] Premium check:', {
      entitlementId: PREMIUM_ENTITLEMENT_ID,
      hasEntitlement: !!premiumEntitlement,
      isActive,
      allActiveEntitlements: Object.keys(info.entitlements?.active || {}),
      boundUserId: userIdToCheck,
      originalAppUserId,
    });
    
    return isActive;
  }, []);

  // Refresh CustomerInfo - call this after any purchase/restore
  const refreshCustomerInfo = useCallback(async (): Promise<boolean> => {
    if (!getIsNativeMobile()) return false;

    try {
      console.log('[RevenueCat] Refreshing CustomerInfo...');
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      const result = await Purchases.getCustomerInfo();
      const info = result?.customerInfo as CustomerInfo;
      
      console.log('[RevenueCat] CustomerInfo received:', JSON.stringify(info, null, 2));
      
      setCustomerInfo(info);
      setLastCustomerInfoRefresh(new Date());
      
      // Update premium status (with user validation)
      const isPremium = checkPremiumFromCustomerInfo(info);
      setIsPremiumFromRC(isPremium);
      
      // Get app user ID for debugging
      const appUserIdResult = await Purchases.getAppUserID();
      setAppUserId(appUserIdResult?.appUserID || null);
      
      console.log('[RevenueCat] State updated:', {
        isPremium,
        appUserId: appUserIdResult?.appUserID,
        boundUserId: boundUserIdRef.current,
        refreshTime: new Date().toISOString(),
      });
      
      return isPremium;
    } catch (error) {
      console.error('[RevenueCat] Error refreshing CustomerInfo:', error);
      return false;
    }
  }, [checkPremiumFromCustomerInfo]);

  // Initialize RevenueCat - call ONLY after user login with their internal user ID
  // CRITICAL: Never allow anonymous IDs - always require explicit user ID
  // CRITICAL: Each Supabase user ID = unique RevenueCat customer, NO aliasing allowed
  const initialize = useCallback(async (userId: string) => {
    if (!getIsNativeMobile()) {
      console.log('[RevenueCat] Skipping init - not native mobile');
      return;
    }

    const apiKey = getRevenueCatKey();
    if (!apiKey) {
      console.error('[RevenueCat] No API key for platform:', Capacitor.getPlatform());
      return;
    }

    if (!userId) {
      console.error('[RevenueCat] SECURITY: Cannot initialize without user ID!');
      return;
    }

    // If already initialized with the same user, just refresh
    if (isInitialized && boundUserIdRef.current === userId) {
      console.log('[RevenueCat] Already initialized with same user, refreshing CustomerInfo...');
      await refreshCustomerInfo();
      return;
    }

    // If initialized with a different user, we need to FULLY reset first
    if (isInitialized || boundUserIdRef.current) {
      console.log('[RevenueCat] Previous user detected, performing FULL reset first...');
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        await Purchases.logOut();
        try {
          await Purchases.invalidateCustomerInfoCache();
        } catch (e) {
          // Cache invalidation is best-effort
        }
        // Clear all local state
        setIsPremiumFromRC(false);
        setCustomerInfo(null);
        setAppUserId(null);
        boundUserIdRef.current = null;
        setBoundUserId(null);
        setIsInitialized(false);
      } catch (e) {
        console.error('[RevenueCat] Error during reset:', e);
      }
    }

    try {
      console.log('[RevenueCat] Initializing with NEW user:', userId);
      setOfferingsError(null);
      const { Purchases } = await import('@revenuecat/purchases-capacitor');

      // CRITICAL: Pass appUserID directly in configure() to prevent ANY anonymous ID creation
      // This ensures the subscription is ALWAYS bound to the authenticated user from the start
      await Purchases.configure({ 
        apiKey,
        appUserID: userId 
      });
      console.log('[RevenueCat] Configured with API key for platform:', Capacitor.getPlatform(), 'user:', userId);

      // Store the bound user ID BEFORE fetching customer info
      boundUserIdRef.current = userId;
      setBoundUserId(userId);
      setIsInitialized(true);
      
      // Fetch CustomerInfo and VALIDATE it matches the expected user
      const { Purchases: P } = await import('@revenuecat/purchases-capacitor');
      const result = await P.getCustomerInfo();
      const info = result?.customerInfo as CustomerInfo;
      
      console.log('[RevenueCat] CustomerInfo for user:', {
        expectedUserId: userId,
        actualOriginalAppUserId: info?.originalAppUserId,
        activeEntitlements: Object.keys(info?.entitlements?.active || {}),
      });
      
      // CRITICAL SECURITY: If originalAppUserId doesn't match, this user has NO premium
      // This catches the case where RevenueCat aliased to a different customer
      if (info?.originalAppUserId && info.originalAppUserId !== userId) {
        console.warn('[RevenueCat] SECURITY: RevenueCat returned different originalAppUserId!', {
          expected: userId,
          actual: info.originalAppUserId,
        });
        // The subscription belongs to someone else - this user is NOT premium
        setIsPremiumFromRC(false);
        setCustomerInfo(null);
      } else {
        // User ID matches - check for premium normally
        setCustomerInfo(info);
        setLastCustomerInfoRefresh(new Date());
        const isPremium = checkPremiumFromCustomerInfo(info, userId);
        setIsPremiumFromRC(isPremium);
      }
      
      // Get app user ID for debugging
      const appUserIdResult = await P.getAppUserID();
      setAppUserId(appUserIdResult?.appUserID || null);

      // Note: fetchOfferings will be called separately by the context after init
    } catch (error: any) {
      console.error('[RevenueCat] Initialization error:', error);
      setOfferingsStatus('error');
      setOfferingsError(error?.message ?? 'Failed to initialize purchases');
    }
  }, [isInitialized, checkPremiumFromCustomerInfo, refreshCustomerInfo]);

  // Logout from RevenueCat - MUST be called when user logs out
  // CRITICAL: This clears premium status immediately and FULLY resets RevenueCat identity
  // This ensures a new account on the same device gets a FRESH RevenueCat customer, not an alias
  const logout = useCallback(async () => {
    console.log('[RevenueCat] Logout called - FULL RESET of all subscription state');
    
    // CRITICAL: Clear ALL local state FIRST before any async operations
    // This ensures premium access is revoked immediately, even if RevenueCat calls fail
    setIsPremiumFromRC(false);
    setCustomerInfo(null);
    setAppUserId(null);
    boundUserIdRef.current = null;
    setBoundUserId(null);
    setIsInitialized(false);
    setLastCustomerInfoRefresh(null);
    setCurrentOffering(null);
    setMonthlyPackage(null);
    setOfferingsStatus('idle');
    setOfferingsError(null);
    
    if (!getIsNativeMobile()) {
      console.log('[RevenueCat] Not native mobile, state cleared');
      return;
    }

    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      // CRITICAL: Call logOut to fully reset RevenueCat identity
      // This ensures the NEXT configure() call creates a FRESH customer, not an alias
      // Without this, RevenueCat may alias the new user ID to the old customer
      await Purchases.logOut();
      console.log('[RevenueCat] Logged out from RevenueCat - identity fully reset');
      
      // Double-check: invalidate customer info cache by getting fresh state
      // This forces RevenueCat to not carry over any cached entitlements
      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log('[RevenueCat] Customer info cache invalidated');
      } catch (cacheError) {
        // Cache invalidation is best-effort
        console.log('[RevenueCat] Cache invalidation skipped:', cacheError);
      }
      
    } catch (error) {
      // Even on error, state is already cleared above
      console.error('[RevenueCat] RevenueCat logout error (state already cleared):', error);
    }
  }, []);

  // Fetch offerings
  const fetchOfferings = useCallback(async () => {
    if (!getIsNativeMobile()) return null;

    setOfferingsStatus('loading');
    setOfferingsError(null);

    try {
      console.log('[RevenueCat] Fetching offerings...');
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');

      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings received:', JSON.stringify(offerings, null, 2));

      // Get platform-specific offering identifier
      const offeringId = getOfferingIdentifier();
      console.log('[RevenueCat] Looking for offering:', offeringId, 'Available:', Object.keys(offerings?.all || {}));
      
      // Get default offering (current offering or platform-specific from all)
      const defaultOffering = offerings?.current ?? offerings?.all?.[offeringId];

      if (!defaultOffering) {
        console.error('[RevenueCat] No default offering found for platform:', offeringId);
        setOfferingsStatus('error');
        setOfferingsError('No subscription offering found. Please try again later.');
        return null;
      }

      setCurrentOffering(defaultOffering as RevenueCatOffering);

      // Find monthly package - prefer the monthly shortcut, fallback to searching availablePackages
      const monthly = defaultOffering.monthly ?? defaultOffering.availablePackages?.find(
        (pkg: any) => pkg.packageType === PACKAGE_TYPE.MONTHLY
      );

      if (!monthly) {
        console.error('[RevenueCat] No monthly package in offering');
        setOfferingsStatus('error');
        setOfferingsError('Monthly subscription package not found.');
        return defaultOffering;
      }

      setMonthlyPackage(monthly as PurchasesPackage);
      console.log('[RevenueCat] Monthly package found:', {
        identifier: monthly.identifier,
        price: monthly.product?.priceString,
        productId: monthly.product?.identifier,
      });

      setOfferingsStatus('ready');
      return defaultOffering;
    } catch (error: any) {
      console.error('[RevenueCat] Error fetching offerings:', error);
      setOfferingsStatus('error');
      setOfferingsError(error?.message ?? 'Failed to load subscription options.');
      return null;
    }
  }, []);

  // Purchase monthly package
  // CRITICAL: Requires user to be logged in first
  const purchaseMonthly = useCallback(async (): Promise<{ 
    success: boolean; 
    error?: string; 
    errorCode?: number;
    isPremiumNow?: boolean;
  }> => {
    if (!getIsNativeMobile()) {
      console.log('[RevenueCat] Purchase skipped - not native mobile');
      return { success: false, error: 'Not native mobile', isPremiumNow: false };
    }

    // SECURITY: Must be logged in to purchase
    if (!boundUserIdRef.current) {
      console.error('[RevenueCat] SECURITY: Cannot purchase without being logged in!');
      return { success: false, error: 'Please sign in first', isPremiumNow: false };
    }

    setIsLoading(true);
    
    try {
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');
      
      // Fetch offerings fresh - don't rely on potentially stale state
      console.log('[RevenueCat] Fetching offerings for purchase...');
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings result:', JSON.stringify(offerings, null, 2));
      
      // Get platform-specific offering
      const offeringId = getOfferingIdentifier();
      const defaultOffering = offerings?.current ?? offerings?.all?.[offeringId];
      
      if (!defaultOffering || !defaultOffering.availablePackages?.length) {
        console.error('[RevenueCat] No offerings available for platform:', offeringId);
        setIsLoading(false);
        return { 
          success: false, 
          error: 'Unable to load subscription. Please try again later.',
          errorCode: 23,
          isPremiumNow: false,
        };
      }
      
      // Find monthly package
      const monthly = defaultOffering.monthly ?? defaultOffering.availablePackages?.find(
        (pkg: any) => pkg.packageType === PACKAGE_TYPE.MONTHLY
      );
      
      if (!monthly) {
        console.error('[RevenueCat] No monthly package in offerings');
        setIsLoading(false);
        return { success: false, error: 'Monthly subscription not available.', isPremiumNow: false };
      }
      
      // Attempt purchase
      console.log('[RevenueCat] Starting purchase with package:', monthly.identifier);
      const purchaseResult = await Purchases.purchasePackage({ aPackage: monthly as any });
      
      // Detailed logging of purchase result
      console.log('[RevenueCat] Purchase result:', JSON.stringify(purchaseResult, null, 2));
      
      const resultCustomerInfo = purchaseResult?.customerInfo as CustomerInfo;
      
      // Update state with new CustomerInfo
      setCustomerInfo(resultCustomerInfo);
      setLastCustomerInfoRefresh(new Date());
      
      // Check premium status from returned CustomerInfo (with user validation)
      const isPremiumNow = checkPremiumFromCustomerInfo(resultCustomerInfo, boundUserIdRef.current || undefined);
      setIsPremiumFromRC(isPremiumNow);
      
      console.log('[RevenueCat] Post-purchase state:', {
        isPremiumNow,
        activeEntitlements: Object.keys(resultCustomerInfo?.entitlements?.active || {}),
        boundUserId: boundUserIdRef.current,
      });
      
      // Force sync with RevenueCat servers (belt and suspenders)
      console.log('[RevenueCat] Forcing sync with servers...');
      await Purchases.syncPurchases();
      console.log('[RevenueCat] Sync complete');
      
      setIsLoading(false);
      return { success: true, isPremiumNow };
      
    } catch (error: any) {
      console.error('[RevenueCat] Purchase error:', error);
      console.error('[RevenueCat] Error code:', error.code);
      console.error('[RevenueCat] Error message:', error.message);
      setIsLoading(false);
      
      // User cancelled (code 1)
      if (error.code === 1 || error.message?.includes('cancel')) {
        return { success: false, isPremiumNow: false }; // No error message for cancellation
      }
      
      // Configuration error (code 23 - products not fetched)
      if (error.code === 23) {
        return { 
          success: false, 
          error: 'Unable to connect to Play Store. Please try again.',
          errorCode: 23,
          isPremiumNow: false,
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Purchase failed. Please try again.',
        errorCode: error.code,
        isPremiumNow: false,
      };
    }
  }, [checkPremiumFromCustomerInfo]);

  // Restore purchases
  // CRITICAL: Validates that restored subscription belongs to current user
  const restorePurchases = useCallback(async (): Promise<{ 
    success: boolean; 
    isPremiumNow: boolean; 
    error?: string;
    isLinkedToOtherAccount?: boolean;
  }> => {
    if (!getIsNativeMobile()) {
      console.log('[RevenueCat] Restore skipped - not native mobile');
      return { success: false, isPremiumNow: false, error: 'Not native mobile' };
    }

    // SECURITY: Must be logged in to restore
    if (!boundUserIdRef.current) {
      console.error('[RevenueCat] SECURITY: Cannot restore without being logged in!');
      return { success: false, isPremiumNow: false, error: 'Please sign in first' };
    }

    setIsLoading(true);
    try {
      console.log('[RevenueCat] Restoring purchases for user:', boundUserIdRef.current);
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      const result = await Purchases.restorePurchases();
      const restoredCustomerInfo = result?.customerInfo as CustomerInfo;
      
      console.log('[RevenueCat] Restore result:', JSON.stringify(restoredCustomerInfo, null, 2));
      
      // CRITICAL SECURITY CHECK: Verify the restored subscription belongs to this user
      const originalAppUserId = restoredCustomerInfo?.originalAppUserId;
      const currentUserId = boundUserIdRef.current;
      
      if (originalAppUserId && originalAppUserId !== currentUserId) {
        console.warn('[RevenueCat] SECURITY: Restored subscription belongs to different account!', {
          currentUserId,
          originalAppUserId,
        });
        setIsLoading(false);
        return { 
          success: false, 
          isPremiumNow: false, 
          error: 'This subscription is already linked to another account.',
          isLinkedToOtherAccount: true,
        };
      }
      
      // Update state with restored CustomerInfo
      setCustomerInfo(restoredCustomerInfo);
      setLastCustomerInfoRefresh(new Date());
      
      // Check premium status (with user ID validation)
      const isPremiumNow = checkPremiumFromCustomerInfo(restoredCustomerInfo, currentUserId);
      setIsPremiumFromRC(isPremiumNow);
      
      console.log('[RevenueCat] Post-restore state:', {
        isPremiumNow,
        activeEntitlements: Object.keys(restoredCustomerInfo?.entitlements?.active || {}),
        originalAppUserId,
        currentUserId,
      });
      
      setIsLoading(false);
      return { success: true, isPremiumNow };
    } catch (error: any) {
      console.error('[RevenueCat] Restore error:', error);
      setIsLoading(false);
      return { success: false, isPremiumNow: false, error: error.message || 'Restore failed' };
    }
  }, [checkPremiumFromCustomerInfo]);

  // Get price string for display
  const getPriceString = useCallback((): string => {
    if (monthlyPackage?.product?.priceString) {
      return monthlyPackage.product.priceString;
    }
    return '£5.99'; // Fallback
  }, [monthlyPackage]);

  // Get debug info
  const getDebugInfo = useCallback(() => ({
    platform: getIsNativeMobile() ? Capacitor.getPlatform() : 'web',
    isNativePlatform: Capacitor.isNativePlatform(),
    capacitorPlatform: Capacitor.getPlatform(),
    isNativeMobile: getIsNativeMobile(),
    isInitialized,
    offeringsStatus,
    offeringsError,
    packagesCount: currentOffering?.availablePackages?.length ?? 0,
    isPremiumFromRC,
    appUserId,
    boundUserId: boundUserIdRef.current,
    originalAppUserId: customerInfo?.originalAppUserId,
    lastCustomerInfoRefresh: lastCustomerInfoRefresh?.toISOString() ?? null,
    activeEntitlements: Object.keys(customerInfo?.entitlements?.active || {}),
    premiumEntitlementId: PREMIUM_ENTITLEMENT_ID,
  }), [isInitialized, offeringsStatus, offeringsError, currentOffering, isPremiumFromRC, appUserId, lastCustomerInfoRefresh, customerInfo]);

  return {
    isIOSNative: getIsNativeIOS(),
    isInitialized,
    isLoading,
    offeringsStatus,
    offeringsError,
    currentOffering,
    monthlyPackage,
    isPremiumFromRC,
    customerInfo,
    appUserId,
    boundUserId,
    lastCustomerInfoRefresh,
    initialize,
    logout,
    fetchOfferings,
    purchaseMonthly,
    restorePurchases,
    refreshCustomerInfo,
    getPriceString,
    getDebugInfo,
  };
};