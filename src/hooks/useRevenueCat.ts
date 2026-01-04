import { useState, useCallback } from 'react';
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

// Backwards-compatible constant - DO NOT use for routing logic, use getIsNativeIOS()
export const isIOSNative = getIsNativeIOS();

const REVENUECAT_IOS_KEY = 'appl_rgvRTJPduIhlItjWllSWcPCuwkn';

// CRITICAL: The entitlement identifier MUST match exactly what's in RevenueCat dashboard
const PREMIUM_ENTITLEMENT_ID = 'premium';

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
}

export const useRevenueCat = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [offeringsStatus, setOfferingsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [currentOffering, setCurrentOffering] = useState<RevenueCatOffering | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  
  // Single source of truth for premium status
  const [isPremiumFromRC, setIsPremiumFromRC] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [lastCustomerInfoRefresh, setLastCustomerInfoRefresh] = useState<Date | null>(null);

  // Helper to check premium from CustomerInfo
  const checkPremiumFromCustomerInfo = useCallback((info: CustomerInfo | null): boolean => {
    if (!info) return false;
    
    // Check if the premium entitlement exists in active entitlements
    const premiumEntitlement = info.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
    const isActive = premiumEntitlement !== undefined;
    
    console.log('[RevenueCat] Premium check:', {
      entitlementId: PREMIUM_ENTITLEMENT_ID,
      hasEntitlement: !!premiumEntitlement,
      isActive,
      allActiveEntitlements: Object.keys(info.entitlements?.active || {}),
    });
    
    return isActive;
  }, []);

  // Refresh CustomerInfo - call this after any purchase/restore
  const refreshCustomerInfo = useCallback(async (): Promise<boolean> => {
    if (!getIsNativeIOS()) return false;

    try {
      console.log('[RevenueCat] Refreshing CustomerInfo...');
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      const result = await Purchases.getCustomerInfo();
      const info = result?.customerInfo as CustomerInfo;
      
      console.log('[RevenueCat] CustomerInfo received:', JSON.stringify(info, null, 2));
      
      setCustomerInfo(info);
      setLastCustomerInfoRefresh(new Date());
      
      // Update premium status
      const isPremium = checkPremiumFromCustomerInfo(info);
      setIsPremiumFromRC(isPremium);
      
      // Get app user ID for debugging
      const appUserIdResult = await Purchases.getAppUserID();
      setAppUserId(appUserIdResult?.appUserID || null);
      
      console.log('[RevenueCat] State updated:', {
        isPremium,
        appUserId: appUserIdResult?.appUserID,
        refreshTime: new Date().toISOString(),
      });
      
      return isPremium;
    } catch (error) {
      console.error('[RevenueCat] Error refreshing CustomerInfo:', error);
      return false;
    }
  }, [checkPremiumFromCustomerInfo]);

  // Initialize RevenueCat - call after user login
  const initialize = useCallback(async (userId: string) => {
    if (!getIsNativeIOS()) {
      console.log('[RevenueCat] Skipping init - not iOS native');
      return;
    }

    if (isInitialized) {
      console.log('[RevenueCat] Already initialized, refreshing CustomerInfo...');
      await refreshCustomerInfo();
      return;
    }

    try {
      console.log('[RevenueCat] Initializing with user:', userId);
      setOfferingsError(null);
      const { Purchases } = await import('@revenuecat/purchases-capacitor');

      await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
      console.log('[RevenueCat] Configured with API key');

      // Log in with user ID for cross-platform tracking
      // This ensures the same user ID is used across sessions
      const loginResult = await Purchases.logIn({ appUserID: userId });
      console.log('[RevenueCat] Logged in:', {
        userId,
        created: loginResult?.created,
      });

      setIsInitialized(true);
      
      // Fetch CustomerInfo to set initial premium status
      await refreshCustomerInfo();

      // Fetch offerings on init
      await fetchOfferings();
    } catch (error: any) {
      console.error('[RevenueCat] Initialization error:', error);
      setOfferingsStatus('error');
      setOfferingsError(error?.message ?? 'Failed to initialize purchases');
    }
  }, [isInitialized, refreshCustomerInfo]);

  // Fetch offerings
  const fetchOfferings = useCallback(async () => {
    if (!getIsNativeIOS()) return null;

    setOfferingsStatus('loading');
    setOfferingsError(null);

    try {
      console.log('[RevenueCat] Fetching offerings...');
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');

      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings received:', JSON.stringify(offerings, null, 2));

      // Get default offering (current offering or 'default' from all)
      const defaultOffering = offerings?.current ?? offerings?.all?.['default'];

      if (!defaultOffering) {
        console.error('[RevenueCat] No default offering found');
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
  const purchaseMonthly = useCallback(async (): Promise<{ 
    success: boolean; 
    error?: string; 
    errorCode?: number;
    isPremiumNow?: boolean;
  }> => {
    if (!getIsNativeIOS()) {
      console.log('[RevenueCat] Purchase skipped - not iOS native');
      return { success: false, error: 'Not iOS native', isPremiumNow: false };
    }

    setIsLoading(true);
    
    try {
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');
      
      // Fetch offerings fresh - don't rely on potentially stale state
      console.log('[RevenueCat] Fetching offerings for purchase...');
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings result:', JSON.stringify(offerings, null, 2));
      
      const defaultOffering = offerings?.current ?? offerings?.all?.['default'];
      
      if (!defaultOffering || !defaultOffering.availablePackages?.length) {
        console.error('[RevenueCat] No offerings available');
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
      
      // Check premium status from returned CustomerInfo
      const isPremiumNow = checkPremiumFromCustomerInfo(resultCustomerInfo);
      setIsPremiumFromRC(isPremiumNow);
      
      console.log('[RevenueCat] Post-purchase state:', {
        isPremiumNow,
        activeEntitlements: Object.keys(resultCustomerInfo?.entitlements?.active || {}),
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
          error: 'Unable to connect to App Store. Please try again.',
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
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; isPremiumNow: boolean; error?: string }> => {
    if (!getIsNativeIOS()) {
      console.log('[RevenueCat] Restore skipped - not iOS native');
      return { success: false, isPremiumNow: false, error: 'Not iOS native' };
    }

    setIsLoading(true);
    try {
      console.log('[RevenueCat] Restoring purchases...');
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      const result = await Purchases.restorePurchases();
      const restoredCustomerInfo = result?.customerInfo as CustomerInfo;
      
      console.log('[RevenueCat] Restore result:', JSON.stringify(restoredCustomerInfo, null, 2));
      
      // Update state with restored CustomerInfo
      setCustomerInfo(restoredCustomerInfo);
      setLastCustomerInfoRefresh(new Date());
      
      // Check premium status
      const isPremiumNow = checkPremiumFromCustomerInfo(restoredCustomerInfo);
      setIsPremiumFromRC(isPremiumNow);
      
      console.log('[RevenueCat] Post-restore state:', {
        isPremiumNow,
        activeEntitlements: Object.keys(restoredCustomerInfo?.entitlements?.active || {}),
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
    platform: getIsNativeIOS() ? 'ios_native' : 'web_or_other',
    isNativePlatform: Capacitor.isNativePlatform(),
    capacitorPlatform: Capacitor.getPlatform(),
    isInitialized,
    offeringsStatus,
    offeringsError,
    packagesCount: currentOffering?.availablePackages?.length ?? 0,
    isPremiumFromRC,
    appUserId,
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
    lastCustomerInfoRefresh,
    initialize,
    fetchOfferings,
    purchaseMonthly,
    restorePurchases,
    refreshCustomerInfo,
    getPriceString,
    getDebugInfo,
  };
};
