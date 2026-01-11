import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useRef, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';

interface SubscriptionData {
  isPremium: boolean;
  isAdmin: boolean;
  subscriptionEnd: string | null;
}

// LocalStorage cache for instant premium UI on app load
const SUBSCRIPTION_CACHE_KEY = 'subscription_cache';
const CACHE_VERSION = 1;

interface CachedSubscription {
  userId: string;
  isPremium: boolean;
  isAdmin: boolean;
  subscriptionEnd: string | null;
  cachedAt: number;
  version: number;
}

const getCachedSubscription = (userId: string): SubscriptionData | null => {
  try {
    const cached = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedSubscription = JSON.parse(cached);
    
    // Validate cache: must match user ID and version
    if (data.userId !== userId || data.version !== CACHE_VERSION) {
      return null;
    }
    
    // Cache is valid for 24 hours (safety net, React Query handles freshness)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - data.cachedAt > maxAge) {
      return null;
    }
    
    return {
      isPremium: data.isPremium,
      isAdmin: data.isAdmin,
      subscriptionEnd: data.subscriptionEnd,
    };
  } catch {
    return null;
  }
};

const setCachedSubscription = (userId: string, data: SubscriptionData) => {
  try {
    const cached: CachedSubscription = {
      userId,
      isPremium: data.isPremium,
      isAdmin: data.isAdmin,
      subscriptionEnd: data.subscriptionEnd,
      cachedAt: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
};

const clearCachedSubscription = () => {
  try {
    localStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
};

const fetchSubscription = async (userId: string | null): Promise<SubscriptionData> => {
  // No user = no premium
  if (!userId) {
    return {
      isPremium: false,
      isAdmin: false,
      subscriptionEnd: null,
    };
  }

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
  const revenueCat = useRevenueCatContext();
  const isNative = Capacitor.isNativePlatform();
  const wasPremiumRef = useRef<boolean | null>(null);

  // `undefined` means "auth not resolved yet" (prevents free UI flash on first paint)
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const currentUserIdRef = useRef<string | null | undefined>(undefined);

  // Track auth state changes and clear cache on logout/login
  useEffect(() => {
    const getInitialUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const initialUserId = user?.id ?? null;
      currentUserIdRef.current = initialUserId;
      setUserId(initialUserId);
    };
    getInitialUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      const prevUserId = currentUserIdRef.current;

      // Clear subscription cache when user changes (logout or different user login)
      if (newUserId !== prevUserId) {
        queryClient.removeQueries({ queryKey: ['subscription'] });
        wasPremiumRef.current = null;
        clearCachedSubscription();
      }

      currentUserIdRef.current = newUserId;
      setUserId(newUserId);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: () => fetchSubscription(userId ?? null),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    // Only run query once auth has been resolved (userId is null or a string)
    enabled: userId !== undefined,
    // Use cached data as initial value for instant premium UI
    initialData: () => (typeof userId === 'string' ? getCachedSubscription(userId) ?? undefined : undefined),
    // Mark initial data as stale so it refetches in background
    initialDataUpdatedAt: 0,
    // OPTIMIZED: Show cached data immediately, don't wait for background refresh
    placeholderData: (previousData) => previousData,
  });

  // Cache subscription data when successfully fetched
  useEffect(() => {
    if (data && userId) {
      setCachedSubscription(userId, data);
    }
  }, [data, userId]);

  // Track previous premium status
  if (data && wasPremiumRef.current === null) {
    wasPremiumRef.current = data.isPremium;
  }

  const refreshSubscription = useCallback(async () => {
    const previousPremium = wasPremiumRef.current;
    
    // Invalidate cache first to ensure ALL components see fresh data immediately
    await queryClient.invalidateQueries({ queryKey: ['subscription', userId] });
    
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
  }, [queryClient, refetch, userId]);

  const effectiveIsPremium = (data?.isPremium ?? false) || (isNative && revenueCat.isPremiumFromRC);
  const effectiveIsAdmin = data?.isAdmin ?? false;

  return {
    // IMPORTANT: On native mobile, premium can be determined by RevenueCat entitlements
    // to prevent paywall/UI flash while backend subscription status syncs.
    isPremium: effectiveIsPremium,
    isAdmin: effectiveIsAdmin,
    // OPTIMIZED: Only show loading when auth is resolving OR we have no data at all
    // If we have cached data, show it immediately (isFetching handles background refresh)
    isLoading: userId === undefined ? true : (isLoading && !data),
    subscriptionEnd: data?.subscriptionEnd ?? null,
    error: error?.message ?? null,
    refreshSubscription,
  };
};
