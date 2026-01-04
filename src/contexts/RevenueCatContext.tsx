import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRevenueCat, isIOSNative } from '@/hooks/useRevenueCat';
import { supabase } from '@/integrations/supabase/client';

interface RevenueCatContextType {
  isIOSNative: boolean;
  isInitialized: boolean;
  isLoading: boolean;
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
      isIOSNative,
      isInitialized: false,
      isLoading: false,
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
    if (!isIOSNative) {
      console.log('[RevenueCatProvider] Not iOS native, skipping initialization');
      return;
    }

    const initializeWithUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        console.log('[RevenueCatProvider] Initializing with user:', session.user.id);
        await revenueCat.initialize(session.user.id);
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
  }, [revenueCat.initialize]);

  const value: RevenueCatContextType = {
    isIOSNative: revenueCat.isIOSNative,
    isInitialized: revenueCat.isInitialized,
    isLoading: revenueCat.isLoading,
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
