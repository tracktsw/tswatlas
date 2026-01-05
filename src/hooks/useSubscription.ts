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

  const checkSubscription = useCallback(async (): Promise<SubscriptionState> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const next: SubscriptionState = {
          isPremium: false,
          isAdmin: false,
          isLoading: false,
          subscriptionEnd: null,
          error: null,
        };
        setState(next);
        return next;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        const next: SubscriptionState = {
          isPremium: false,
          isAdmin: false,
          isLoading: false,
          subscriptionEnd: null,
          error: error.message,
        };
        setState(next);
        return next;
      }

      if (data?.error) {
        const next: SubscriptionState = {
          isPremium: false,
          isAdmin: false,
          isLoading: false,
          subscriptionEnd: null,
          error: data.error,
        };
        setState(next);
        return next;
      }

      const next: SubscriptionState = {
        isPremium: Boolean(data.subscribed || data.isAdmin),
        isAdmin: Boolean(data.isAdmin),
        isLoading: false,
        subscriptionEnd: data.subscription_end || null,
        error: null,
      };

      setState(next);
      return next;
    } catch {
      const next: SubscriptionState = {
        isPremium: false,
        isAdmin: false,
        isLoading: false,
        subscriptionEnd: null,
        error: 'Failed to check subscription status',
      };
      setState(next);
      return next;
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

  const refreshSubscription = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    return checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    refreshSubscription,
  };
};
