import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionState {
  isPremium: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  subscriptionEnd: string | null;
  error: string | null;
}

export const useSubscription = () => {
  const [state, setState] = useState<SubscriptionState>({
    isPremium: false,
    isAdmin: false,
    isLoading: true,
    subscriptionEnd: null,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    console.log('[SUBSCRIPTION] checkSubscription called');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('[SUBSCRIPTION] No session - user not authenticated');
        setState({
          isPremium: false,
          isAdmin: false,
          isLoading: false,
          subscriptionEnd: null,
          error: null,
        });
        return;
      }

      console.log('[SUBSCRIPTION] Session found, invoking check-subscription function...');
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('[SUBSCRIPTION] Function invocation error:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      if (data?.error) {
        console.error('[SUBSCRIPTION] API error:', data.error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error,
        }));
        return;
      }

      console.log('[SUBSCRIPTION] Response received:', {
        subscribed: data.subscribed,
        isAdmin: data.isAdmin,
        subscriptionEnd: data.subscription_end
      });

      setState({
        isPremium: data.subscribed || data.isAdmin,
        isAdmin: data.isAdmin || false,
        isLoading: false,
        subscriptionEnd: data.subscription_end || null,
        error: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[SUBSCRIPTION] Exception:', errorMessage);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check subscription status',
      }));
    }
  }, []);

  useEffect(() => {
    console.log('[SUBSCRIPTION] Hook mounted - checking subscription');
    checkSubscription();

    // Re-check subscription every minute
    const interval = setInterval(() => {
      console.log('[SUBSCRIPTION] Periodic refresh triggered');
      checkSubscription();
    }, 60000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[SUBSCRIPTION] Auth state changed:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkSubscription();
      } else if (event === 'SIGNED_OUT') {
        setState({
          isPremium: false,
          isAdmin: false,
          isLoading: false,
          subscriptionEnd: null,
          error: null,
        });
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [checkSubscription]);

  const refreshSubscription = useCallback(() => {
    console.log('[SUBSCRIPTION] Manual refresh triggered');
    setState(prev => ({ ...prev, isLoading: true }));
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    refreshSubscription,
  };
};
