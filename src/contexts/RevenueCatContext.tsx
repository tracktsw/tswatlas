import { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react';
import { useRevenueCat, getIsNativeIOS } from '@/hooks/useRevenueCat';
import { supabase } from '@/integrations/supabase/client';

interface RevenueCatContextType {
  isIOSNative: boolean;
  platformLabel: string;
  isInitialized: boolean;
  isLoading: boolean;
  offeringsStatus: 'idle' | 'loading' | 'ready' | 'error';
  offeringsError: string | null;
  // Single source of truth for premium on iOS
  isPremiumFromRC: boolean;
  appUserId: string | null;
  lastCustomerInfoRefresh: Date | null;
  fetchOfferings: () => Promise<any>;
  purchaseMonthly: () => Promise<{ success: boolean; error?: string; errorCode?: number; isPremiumNow?: boolean }>;
  restorePurchases: () => Promise<{ success: boolean; isPremiumNow: boolean; error?: string }>;
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
    return {
      isIOSNative: getIsNativeIOS(),
      platformLabel: getIsNativeIOS() ? 'ios_native' : 'web_or_other',
      isInitialized: false,
      isLoading: false,
      offeringsStatus: 'idle' as const,
      offeringsError: null,
      isPremiumFromRC: false,
      appUserId: null,
      lastCustomerInfoRefresh: null,
      fetchOfferings: async () => null,
      purchaseMonthly: async () => ({ success: false, error: 'Not initialized', errorCode: undefined, isPremiumNow: false }),
      restorePurchases: async () => ({ success: false, isPremiumNow: false, error: 'Not initialized' }),
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

  // Retry initialization - useful if initial load failed
  const retryInitialization = useCallback(async () => {
    if (!getIsNativeIOS()) return;
    
    console.log('[RevenueCatProvider] Retrying initialization...');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await revenueCat.initialize(session.user.id);
    } else {
      // No user - just fetch offerings for display
      await revenueCat.fetchOfferings();
    }
  }, [revenueCat]);

  // Initialize RevenueCat when user is authenticated (iOS only)
  useEffect(() => {
    if (!getIsNativeIOS()) {
      console.log('[RevenueCatProvider] Not iOS native, skipping initialization');
      return;
    }

    const initializeWithUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        console.log('[RevenueCatProvider] Initializing with user:', session.user.id);
        setCurrentUserId(session.user.id);
        await revenueCat.initialize(session.user.id);
      } else {
        // Still attempt to fetch offerings so the UI can show a clear status
        console.log('[RevenueCatProvider] No user session yet; fetching offerings only');
        await revenueCat.fetchOfferings();
      }
    };

    initializeWithUser();

    // Re-initialize on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log('[RevenueCatProvider] User signed in, initializing RevenueCat');
        setCurrentUserId(session.user.id);
        await revenueCat.initialize(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log('[RevenueCatProvider] User signed out');
        setCurrentUserId(null);
        // Note: RevenueCat SDK handles logout internally
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [revenueCat.initialize, revenueCat.fetchOfferings]);

  const isNativeIOS = getIsNativeIOS();

  const value: RevenueCatContextType = {
    isIOSNative: isNativeIOS,
    platformLabel: isNativeIOS ? 'ios_native' : 'web_or_other',
    isInitialized: revenueCat.isInitialized,
    isLoading: revenueCat.isLoading,
    offeringsStatus: revenueCat.offeringsStatus,
    offeringsError: revenueCat.offeringsError,
    isPremiumFromRC: revenueCat.isPremiumFromRC,
    appUserId: revenueCat.appUserId,
    lastCustomerInfoRefresh: revenueCat.lastCustomerInfoRefresh,
    fetchOfferings: revenueCat.fetchOfferings,
    purchaseMonthly: revenueCat.purchaseMonthly,
    restorePurchases: revenueCat.restorePurchases,
    refreshCustomerInfo: revenueCat.refreshCustomerInfo,
    getPriceString: revenueCat.getPriceString,
    getDebugInfo: revenueCat.getDebugInfo,
    retryInitialization,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
};
