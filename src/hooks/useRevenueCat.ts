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

// Platform detection
export const isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const REVENUECAT_IOS_KEY = 'appl_rgvRTJPduIhlItjWllSWcPCuwkn';

export const useRevenueCat = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentOffering, setCurrentOffering] = useState<RevenueCatOffering | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);

  // Initialize RevenueCat - call after user login
  const initialize = useCallback(async (userId: string) => {
    if (!isIOSNative) {
      console.log('[RevenueCat] Skipping init - not iOS native');
      return;
    }

    if (isInitialized) {
      console.log('[RevenueCat] Already initialized');
      return;
    }

    try {
      console.log('[RevenueCat] Initializing...');
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
      console.log('[RevenueCat] Configured with API key');
      
      // Log in with user ID for cross-platform tracking
      await Purchases.logIn({ appUserID: userId });
      console.log('[RevenueCat] Logged in user:', userId);
      
      setIsInitialized(true);
      
      // Fetch offerings on init
      await fetchOfferings();
    } catch (error) {
      console.error('[RevenueCat] Initialization error:', error);
    }
  }, [isInitialized]);

  // Fetch offerings
  const fetchOfferings = useCallback(async () => {
    if (!isIOSNative) return null;

    try {
      console.log('[RevenueCat] Fetching offerings...');
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');
      
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings received:', offerings);
      
      // Get default offering (current offering or 'default' from all)
      const defaultOffering = offerings?.current ?? offerings?.all?.['default'];
      
      if (defaultOffering) {
        setCurrentOffering(defaultOffering as RevenueCatOffering);
        
        // Find monthly package - prefer the monthly shortcut, fallback to searching availablePackages
        const monthly = defaultOffering.monthly ?? defaultOffering.availablePackages?.find(
          (pkg: any) => pkg.packageType === PACKAGE_TYPE.MONTHLY
        );
        
        if (monthly) {
          setMonthlyPackage(monthly as PurchasesPackage);
          console.log('[RevenueCat] Monthly package found:', monthly.product?.priceString);
        }
      }
      
      return defaultOffering;
    } catch (error) {
      console.error('[RevenueCat] Error fetching offerings:', error);
      return null;
    }
  }, []);

  // Purchase monthly package
  const purchaseMonthly = useCallback(async (): Promise<boolean> => {
    if (!isIOSNative) {
      console.log('[RevenueCat] Purchase skipped - not iOS native');
      return false;
    }

    if (!monthlyPackage) {
      console.error('[RevenueCat] No monthly package available');
      // Try to fetch offerings first
      await fetchOfferings();
      if (!monthlyPackage) {
        return false;
      }
    }

    setIsLoading(true);
    try {
      console.log('[RevenueCat] Starting purchase...');
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      const purchaseResult = await Purchases.purchasePackage({ 
        aPackage: monthlyPackage as any 
      });
      
      console.log('[RevenueCat] Purchase completed:', purchaseResult);
      
      // Check if premium entitlement is now active
      const customerInfo = purchaseResult.customerInfo;
      const isPremiumActive = customerInfo?.entitlements?.active?.['premium'] !== undefined;
      
      console.log('[RevenueCat] Premium entitlement active:', isPremiumActive);
      
      setIsLoading(false);
      return true; // Purchase initiated - backend will verify
    } catch (error: any) {
      console.error('[RevenueCat] Purchase error:', error);
      
      // Check if user cancelled
      if (error.code === 1 || error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        console.log('[RevenueCat] Purchase cancelled by user');
      }
      
      setIsLoading(false);
      return false;
    }
  }, [monthlyPackage, fetchOfferings]);

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
    isIOSNative,
    isInitialized,
    isLoading,
    currentOffering,
    monthlyPackage,
    initialize,
    fetchOfferings,
    purchaseMonthly,
    restorePurchases,
    getPriceString,
  };
};
