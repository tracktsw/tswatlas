import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react';
import { useRevenueCat, getIsNativeIOS, getIsNativeMobile, type TrialEligibilityStatus } from '@/hooks/useRevenueCat';
import { supabase } from '@/integrations/supabase/client';

interface RevenueCatContextType {
  isNativeMobile: boolean;
  isIOSNative: boolean;
  platformLabel: string;
  isInitialized: boolean;
  isLoading: boolean;
  offeringsStatus: 'idle' | 'loading' | 'ready' | 'error';
  offeringsError: string | null;
  // Single source of truth for premium on iOS
  isPremiumFromRC: boolean;
  appUserId: string | null;
  boundUserId: string | null;
  lastCustomerInfoRefresh: Date | null;
  // Whether user is logged in (required for purchases)
  isUserLoggedIn: boolean;
  // Trial eligibility (store-verified via Apple/Google)
  trialEligibilityStatus: TrialEligibilityStatus;
  isTrialEligible: boolean;
  fetchOfferings: () => Promise<any>;
  purchaseMonthly: () => Promise<{ success: boolean; error?: string; errorCode?: number; isPremiumNow?: boolean }>;
  restorePurchases: () => Promise<{ success: boolean; isPremiumNow: boolean; error?: string; isLinkedToOtherAccount?: boolean }>;
  refreshCustomerInfo: () => Promise<boolean>;
  getPriceString: () => string;
  getDebugInfo: () => Record<string, unknown>;
  retryInitialization: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

export const useRevenueCatContext = () => {
  const context = useContext(RevenueCatContext);
  if (!context) {
    // Return a default context - use actual platform detection
    const isNativeMobile = getIsNativeMobile();
    const isNativeIOS = getIsNativeIOS();
    return {
      isNativeMobile,
      isIOSNative: isNativeIOS,
      platformLabel: isNativeMobile ? (isNativeIOS ? 'ios_native' : 'android_native') : 'web',
      isInitialized: false,
      isLoading: false,
      offeringsStatus: 'idle' as const,
      offeringsError: null,
      isPremiumFromRC: false,
      appUserId: null,
      boundUserId: null,
      lastCustomerInfoRefresh: null,
      isUserLoggedIn: false,
      // Default trial eligibility for non-native/no context
      trialEligibilityStatus: 'unknown' as TrialEligibilityStatus,
      isTrialEligible: false,
      fetchOfferings: async () => null,
      purchaseMonthly: async () => ({ success: false, error: 'Not initialized', errorCode: undefined, isPremiumNow: false }),
      restorePurchases: async () => ({ success: false, isPremiumNow: false, error: 'Not initialized', isLinkedToOtherAccount: false }),
      refreshCustomerInfo: async () => false,
      getPriceString: () => '£5.99',
      getDebugInfo: () => ({ initialized: false }),
      retryInitialization: async () => {},
    };
  }
  return context;
};

interface RevenueCatProviderProps {
  children: ReactNode;
}

export const RevenueCatProvider = ({ children }: RevenueCatProviderProps) => {
  const revenueCat = useRevenueCat();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Retry initialization - useful if initial load failed
  const retryInitialization = useCallback(async () => {
    if (!getIsNativeMobile()) return;

    console.log('[RevenueCatProvider] Retrying initialization...');

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await revenueCat.initialize(session.user.id);
      // Ensure offerings are fetched after a retry as well
      await revenueCat.fetchOfferings();
    } else {
      // CRITICAL: Do NOT fetch offerings without a user - this prevents anonymous purchases
      console.log('[RevenueCatProvider] No user session, cannot initialize');
    }
  }, [revenueCat]);

  // Initialize RevenueCat ONLY when user is authenticated (native mobile only)
  // CRITICAL: Never initialize without a logged-in user
  useEffect(() => {
    if (!getIsNativeMobile()) {
      console.log('[RevenueCatProvider] Not native mobile, skipping initialization');
      return;
    }

    const initializeWithUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        console.log('[RevenueCatProvider] Initializing with user:', session.user.id);
        setCurrentUserId(session.user.id);
        setIsUserLoggedIn(true);
        await revenueCat.initialize(session.user.id);
        // Fetch offerings after initialization
        await revenueCat.fetchOfferings();
      } else {
        // CRITICAL: No user = no RevenueCat initialization
        // This prevents anonymous purchases
        console.log('[RevenueCatProvider] No user session, RevenueCat not initialized');
        setCurrentUserId(null);
        setIsUserLoggedIn(false);
      }

      // Mark auth as resolved (prevents a brief free UI flash before RevenueCat initializes)
      setAuthChecked(true);
    };

    initializeWithUser();

    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[RevenueCatProvider] Auth state change:', event, 'userId:', session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log('[RevenueCatProvider] User signed in, initializing RevenueCat with user:', session.user.id);
        setCurrentUserId(session.user.id);
        setIsUserLoggedIn(true);
        setAuthChecked(true);
        // Initialize RevenueCat with the new user's ID
        // This will fetch entitlements and set premium status based on THIS user's subscription
        await revenueCat.initialize(session.user.id);
        // Fetch offerings after initialization
        await revenueCat.fetchOfferings();
      } else if (event === 'SIGNED_OUT') {
        console.log('[RevenueCatProvider] User signed out - CLEARING ALL SUBSCRIPTION STATE');
        setAuthChecked(true);
        // CRITICAL: Clear local state FIRST
        setCurrentUserId(null);
        setIsUserLoggedIn(false);
        // CRITICAL: Logout from RevenueCat to clear premium status and reset to anonymous
        // This ensures a new account on the same device does NOT inherit any subscription
        await revenueCat.logout();
      } else if (event === 'TOKEN_REFRESHED' && session?.user?.id) {
        setAuthChecked(true);
        // Token refresh - ensure we're still initialized with the same user
        if (currentUserId !== session.user.id) {
          console.log('[RevenueCatProvider] User ID changed on token refresh, re-initializing');
          // Different user - clear old state and initialize with new user
          await revenueCat.logout();
          setCurrentUserId(session.user.id);
          setIsUserLoggedIn(true);
          await revenueCat.initialize(session.user.id);
          await revenueCat.fetchOfferings();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [revenueCat.initialize, revenueCat.logout, revenueCat.fetchOfferings]);

  const isNativeMobile = getIsNativeMobile();
  const isNativeIOS = getIsNativeIOS();

  const value: RevenueCatContextType = {
    isNativeMobile,
    isIOSNative: isNativeIOS,
    platformLabel: isNativeMobile ? (isNativeIOS ? 'ios_native' : 'android_native') : 'web',
    isInitialized: revenueCat.isInitialized,
    isLoading: revenueCat.isLoading,
    offeringsStatus: revenueCat.offeringsStatus,
    offeringsError: revenueCat.offeringsError,
    isPremiumFromRC: revenueCat.isPremiumFromRC,
    appUserId: revenueCat.appUserId,
    boundUserId: revenueCat.boundUserId,
    lastCustomerInfoRefresh: revenueCat.lastCustomerInfoRefresh,
    isUserLoggedIn,
    // Trial eligibility from RevenueCat (store-verified)
    trialEligibilityStatus: revenueCat.trialEligibilityStatus,
    isTrialEligible: revenueCat.isTrialEligible,
    fetchOfferings: revenueCat.fetchOfferings,
    purchaseMonthly: revenueCat.purchaseMonthly,
    restorePurchases: revenueCat.restorePurchases,
    refreshCustomerInfo: revenueCat.refreshCustomerInfo,
    getPriceString: revenueCat.getPriceString,
    getDebugInfo: revenueCat.getDebugInfo,
    retryInitialization,
  };

  // On native, block rendering until we've resolved auth at least once.
  // This prevents a brief "free" UI flash before RevenueCat initializes and/or cache is applied.
  if (getIsNativeMobile() && !authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
};
