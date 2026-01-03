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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState({
          isPremium: false,
          isAdmin: false,
          isLoading: false,
          subscriptionEnd: null,
          error: null,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      if (data?.error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error,
        }));
        return;
      }

      setState({
        isPremium: data.subscribed || data.isAdmin,
        isAdmin: data.isAdmin || false,
        isLoading: false,
        subscriptionEnd: data.subscription_end || null,
        error: null,
      });
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check subscription status',
      }));
    }
  }, []);

  useEffect(() => {
    checkSubscription();

    // Re-check subscription every 5 minutes
    const interval = setInterval(() => {
      checkSubscription();
    }, 5 * 60 * 1000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
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
    setState(prev => ({ ...prev, isLoading: true }));
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    refreshSubscription,
  };
};
