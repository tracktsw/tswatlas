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

// Platform detection (runtime)
export const getIsNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// Backwards-compatible constant (do not rely on this for routing logic)
export const isIOSNative = getIsNativeIOS();

const REVENUECAT_IOS_KEY = 'appl_rgvRTJPduIhlItjWllSWcPCuwkn';

export const useRevenueCat = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [offeringsStatus, setOfferingsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [currentOffering, setCurrentOffering] = useState<RevenueCatOffering | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);

  // Initialize RevenueCat - call after user login
  const initialize = useCallback(async (userId: string) => {
    if (!getIsNativeIOS()) {
      console.log('[RevenueCat] Skipping init - not iOS native');
      return;
    }

    if (isInitialized) {
      console.log('[RevenueCat] Already initialized');
      return;
    }

    try {
      console.log('[RevenueCat] Initializing...');
      setOfferingsError(null);
      const { Purchases } = await import('@revenuecat/purchases-capacitor');

      await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
      console.log('[RevenueCat] Configured with API key');

      // Log in with user ID for cross-platform tracking
      await Purchases.logIn({ appUserID: userId });
      console.log('[RevenueCat] Logged in user:', userId);

      setIsInitialized(true);

      // Fetch offerings on init
      await fetchOfferings();
    } catch (error: any) {
      console.error('[RevenueCat] Initialization error:', error);
      setOfferingsStatus('error');
      setOfferingsError(error?.message ?? 'Failed to initialize purchases');
    }
  }, [isInitialized]);

  // Fetch offerings
  const fetchOfferings = useCallback(async () => {
    if (!getIsNativeIOS()) return null;

    setOfferingsStatus('loading');
    setOfferingsError(null);

    try {
      console.log('[RevenueCat] Fetching offerings...');
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');

      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings received:', offerings);

      // Get default offering (current offering or 'default' from all)
      const defaultOffering = offerings?.current ?? offerings?.all?.['default'];

      if (!defaultOffering) {
        setOfferingsStatus('error');
        setOfferingsError('No subscription offering found.');
        return null;
      }

      setCurrentOffering(defaultOffering as RevenueCatOffering);

      // Find monthly package - prefer the monthly shortcut, fallback to searching availablePackages
      const monthly = defaultOffering.monthly ?? defaultOffering.availablePackages?.find(
        (pkg: any) => pkg.packageType === PACKAGE_TYPE.MONTHLY
      );

      if (!monthly) {
        setOfferingsStatus('error');
        setOfferingsError('Monthly subscription package not found.');
        return defaultOffering;
      }

      setMonthlyPackage(monthly as PurchasesPackage);
      console.log('[RevenueCat] Monthly package found:', monthly.product?.priceString);

      setOfferingsStatus('ready');
      return defaultOffering;
    } catch (error: any) {
      console.error('[RevenueCat] Error fetching offerings:', error);
      setOfferingsStatus('error');
      setOfferingsError(error?.message ?? 'Failed to load subscription options.');
      return null;
    }
  }, []);

  // Purchase monthly package - returns structured result for better error handling
  const purchaseMonthly = useCallback(async (): Promise<{ success: boolean; error?: string; errorCode?: number }> => {
    if (!getIsNativeIOS()) {
      console.log('[RevenueCat] Purchase skipped - not iOS native');
      return { success: false, error: 'Not iOS native' };
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
          errorCode: 23 
        };
      }
      
      // Find monthly package
      const monthly = defaultOffering.monthly ?? defaultOffering.availablePackages?.find(
        (pkg: any) => pkg.packageType === PACKAGE_TYPE.MONTHLY
      );
      
      if (!monthly) {
        console.error('[RevenueCat] No monthly package in offerings');
        setIsLoading(false);
        return { success: false, error: 'Monthly subscription not available.' };
      }
      
      // Attempt purchase
      console.log('[RevenueCat] Starting purchase with package:', monthly.identifier);
      const purchaseResult = await Purchases.purchasePackage({ aPackage: monthly as any });
      
      // Detailed logging of purchase result
      console.log('[RevenueCat] Purchase result:', JSON.stringify(purchaseResult, null, 2));
      console.log('[RevenueCat] Customer Info:', JSON.stringify(purchaseResult?.customerInfo, null, 2));
      console.log('[RevenueCat] Active entitlements:', JSON.stringify(purchaseResult?.customerInfo?.entitlements?.active, null, 2));
      
      // Check if premium is active immediately after purchase
      const isPremiumActive = purchaseResult?.customerInfo?.entitlements?.active?.['premium'] !== undefined;
      console.log('[RevenueCat] Premium active after purchase:', isPremiumActive);
      
      // Force sync with RevenueCat servers
      console.log('[RevenueCat] Forcing sync with servers...');
      await Purchases.syncPurchases();
      console.log('[RevenueCat] Sync complete');
      
      setIsLoading(false);
      return { success: true };
      
    } catch (error: any) {
      console.error('[RevenueCat] Purchase error:', error);
      console.error('[RevenueCat] Error code:', error.code);
      console.error('[RevenueCat] Error message:', error.message);
      setIsLoading(false);
      
      // User cancelled
      if (error.code === 1 || error.message?.includes('cancel')) {
        return { success: false }; // No error message for cancellation
      }
      
      // Configuration error (code 23 - products not fetched)
      if (error.code === 23) {
        return { 
          success: false, 
          error: 'Unable to connect to App Store. The subscription may not be ready yet.',
          errorCode: 23
        };
      }
      
      return { 
        success: false, 
        error: 'Purchase failed. Please try again.',
        errorCode: error.code 
      };
    }
  }, []);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isIOSNative) {
      console.log('[RevenueCat] Restore skipped - not iOS native');
      return false;
    }

    setIsLoading(true);
    try {
      console.log('[RevenueCat] Restoring purchases...');
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      const customerInfo = await Purchases.restorePurchases();
      console.log('[RevenueCat] Restore completed:', customerInfo);
      
      // Check if premium entitlement is active
      const isPremiumActive = customerInfo?.customerInfo?.entitlements?.active?.['premium'] !== undefined;
      console.log('[RevenueCat] Premium entitlement after restore:', isPremiumActive);
      
      setIsLoading(false);
      return isPremiumActive;
    } catch (error) {
      console.error('[RevenueCat] Restore error:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  // Get price string for display
  const getPriceString = useCallback((): string => {
    if (monthlyPackage?.product?.priceString) {
      return monthlyPackage.product.priceString;
    }
    return '£5.99'; // Fallback
  }, [monthlyPackage]);

  return {
    isIOSNative: getIsNativeIOS(),
    isInitialized,
    isLoading,
    offeringsStatus,
    offeringsError,
    currentOffering,
    monthlyPackage,
    initialize,
    fetchOfferings,
    purchaseMonthly,
    restorePurchases,
    getPriceString,
  };
};
