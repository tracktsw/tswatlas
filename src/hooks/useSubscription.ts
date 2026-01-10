import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

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
  const wasPremiumRef = useRef<boolean | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  // Track previous premium status
  if (data && wasPremiumRef.current === null) {
    wasPremiumRef.current = data.isPremium;
  }

  const refreshSubscription = useCallback(async () => {
    const previousPremium = wasPremiumRef.current;
    
    // Invalidate cache first to ensure ALL components see fresh data immediately
    await queryClient.invalidateQueries({ queryKey: ['subscription'] });
    
    const result = await refetch();
    const nowPremium = result.data?.isPremium ?? false;
    
    // Show confirmation toast when user becomes premium
    if (nowPremium && previousPremium === false) {
      toast.success('Premium activated! Enjoy all features.', {
        duration: 4000,
      });
    }
    
    wasPremiumRef.current = nowPremium;
    
    return {
      isPremium: nowPremium,
      isAdmin: result.data?.isAdmin ?? false,
      isLoading: false,
      subscriptionEnd: result.data?.subscriptionEnd ?? null,
      error: result.error?.message ?? null,
    };
  }, [queryClient, refetch]);

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
