import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRevenueCat, getIsNativeIOS } from '@/hooks/useRevenueCat';
import { supabase } from '@/integrations/supabase/client';

interface RevenueCatContextType {
  isIOSNative: boolean;
  platformLabel: string;
  isInitialized: boolean;
  isLoading: boolean;
  offeringsStatus: 'idle' | 'loading' | 'ready' | 'error';
  offeringsError: string | null;
  fetchOfferings: () => Promise<any>;
  purchaseMonthly: () => Promise<{ success: boolean; error?: string; errorCode?: number }>;
  restorePurchases: () => Promise<boolean>;
  getPriceString: () => string;
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
      offeringsStatus: 'idle',
      offeringsError: null,
      fetchOfferings: async () => null,
      purchaseMonthly: async () => ({ success: false, error: 'Not initialized', errorCode: undefined }),
      restorePurchases: async () => false,
      getPriceString: () => '£5.99',
    };
  }
  return context;
};

interface RevenueCatProviderProps {
  children: ReactNode;
}

export const RevenueCatProvider = ({ children }: RevenueCatProviderProps) => {
  const revenueCat = useRevenueCat();

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
        await revenueCat.initialize(session.user.id);
      } else {
        // Still attempt to fetch offerings so the UI can show a clear status.
        console.log('[RevenueCatProvider] No user session yet; fetching offerings (no purchase until signed in)');
        await revenueCat.fetchOfferings();
      }
    };

    initializeWithUser();

    // Re-initialize on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        console.log('[RevenueCatProvider] User signed in, initializing RevenueCat');
        await revenueCat.initialize(session.user.id);
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
    fetchOfferings: revenueCat.fetchOfferings,
    purchaseMonthly: revenueCat.purchaseMonthly,
    restorePurchases: revenueCat.restorePurchases,
    getPriceString: revenueCat.getPriceString,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
};
