import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

interface SubscriptionData {
  isPremium: boolean;
  isAdmin: boolean;
  subscriptionEnd: string | null;
}

const fetchSubscription = async (): Promise<SubscriptionData> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return {
      isPremium: false,
      isAdmin: false,
      subscriptionEnd: null,
    };
  }

  const { data, error } = await supabase.functions.invoke('check-subscription', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error || data?.error) {
    console.error('Subscription check error:', error?.message || data?.error);
    return {
      isPremium: false,
      isAdmin: false,
      subscriptionEnd: null,
    };
  }

  return {
    isPremium: Boolean(data.subscribed || data.isAdmin),
    isAdmin: Boolean(data.isAdmin),
    subscriptionEnd: data.subscription_end || null,
  };
};

export const useSubscription = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  const refreshSubscription = useCallback(async () => {
    const result = await refetch();
    return {
      isPremium: result.data?.isPremium ?? false,
      isAdmin: result.data?.isAdmin ?? false,
      isLoading: false,
      subscriptionEnd: result.data?.subscriptionEnd ?? null,
      error: result.error?.message ?? null,
    };
  }, [refetch]);

  // Invalidate subscription on auth changes
  // This is handled by the query's automatic refetch on mount

  return {
    isPremium: data?.isPremium ?? false,
    isAdmin: data?.isAdmin ?? false,
    isLoading,
    subscriptionEnd: data?.subscriptionEnd ?? null,
    error: error?.message ?? null,
    refreshSubscription,
  };
};
