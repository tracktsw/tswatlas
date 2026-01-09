/**
 * Unified Payment Router
 * 
 * CRITICAL: This is the SINGLE entry point for all purchase flows.
 * - Web → Stripe only (payment link redirect)
 * - iOS → RevenueCat (Apple IAP via StoreKit)
 * - Android → RevenueCat (Google Play Billing)
 * 
 * HARD RULES:
 * - No Stripe constants/imports reachable in native (ios/android) builds
 * - iOS must not present external payment links
 * - Stripe code is dynamically loaded ONLY when platform === 'web'
 */

import { useState, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { useSubscription } from '@/hooks/useSubscription';

export type PaymentPlatform = 'web' | 'ios' | 'android';

export interface PaymentRouterState {
  platform: PaymentPlatform;
  isNative: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  statusMessage: string | null;
  isOfferingsReady: boolean;
  priceString: string;
}

export interface PurchaseResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
}

export interface RestoreResult {
  success: boolean;
  isPremiumNow: boolean;
  error?: string;
  isLinkedToOtherAccount?: boolean;
}

/**
 * Platform detection using Capacitor.getPlatform()
 * This determines which payment provider to use.
 */
export const getPaymentPlatform = (): PaymentPlatform => {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return 'web';
};

export const isNativePlatform = (): boolean => {
  const platform = getPaymentPlatform();
  return platform === 'ios' || platform === 'android';
};

/**
 * STRIPE CONFIG - Web only
 * This function is ONLY called when platform === 'web'
 * It returns the Stripe payment link URL
 */
const getStripePaymentLink = (): string => {
  // CRITICAL: This should never be called on native platforms
  if (isNativePlatform()) {
    console.error('[PaymentRouter] FATAL: Stripe accessed on native platform!');
    throw new Error('Stripe is not available on native platforms');
  }
  return 'https://buy.stripe.com/fZudR12RBaH1cEveGH1gs01';
};

export const usePaymentRouter = () => {
  const navigate = useNavigate();
  const { refreshSubscription } = useSubscription();
  
  // RevenueCat context - only used on native platforms
  const revenueCatContext = useRevenueCatContext();
  
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Memoized platform detection
  const platform = useMemo(() => getPaymentPlatform(), []);
  const isNative = useMemo(() => isNativePlatform(), []);

  // Offerings ready state - only relevant for native
  const isOfferingsReady = useMemo(() => {
    if (!isNative) return true; // Web doesn't need offerings
    return revenueCatContext.isUserLoggedIn && revenueCatContext.offeringsStatus === 'ready';
  }, [isNative, revenueCatContext.isUserLoggedIn, revenueCatContext.offeringsStatus]);

  // Price string - from RevenueCat on native, fallback on web
  const priceString = useMemo(() => {
    if (isNative) {
      return revenueCatContext.getPriceString();
    }
    return '£5.99'; // Web Stripe price
  }, [isNative, revenueCatContext]);

  /**
   * SINGLE ENTRY POINT FOR ALL PURCHASES
   * 
   * Routes to the correct payment provider based on platform:
   * - Web → Stripe
   * - iOS/Android → RevenueCat
   */
  const startPurchase = useCallback(async (): Promise<PurchaseResult> => {
    if (isPurchasing) {
      return { success: false, error: 'Purchase already in progress' };
    }

    console.log(`[PaymentRouter] Starting purchase on platform: ${platform}`);
    setStatusMessage(null);
    setIsPurchasing(true);

    try {
      // NATIVE PLATFORMS (iOS/Android) → RevenueCat
      if (isNative) {
        // CRITICAL: Must be logged in to purchase on native
        if (!revenueCatContext.isUserLoggedIn) {
          toast.error('Please sign in to subscribe');
          navigate('/auth');
          setIsPurchasing(false);
          return { success: false, error: 'Not signed in' };
        }

        // Check if offerings are ready
        if (!isOfferingsReady) {
          const msg = revenueCatContext.offeringsError || 'Loading subscription options…';
          setStatusMessage(msg);
          toast.error(msg);
          setIsPurchasing(false);
          return { success: false, error: msg };
        }

        setStatusMessage(platform === 'ios' ? 'Opening App Store…' : 'Opening Play Store…');
        
        console.log('[PaymentRouter] Native purchase starting:', {
          platform,
          isOfferingsReady,
          offeringsStatus: revenueCatContext.offeringsStatus,
        });

        const result = await revenueCatContext.purchaseMonthly();
        console.log('[PaymentRouter] RevenueCat purchase result:', result);

        if (result.success) {
          setStatusMessage('Purchase successful!');
          toast.success('Purchase successful!');
          await refreshSubscription();
          setIsPurchasing(false);
          return { success: true };
        } else if (result.error) {
          setStatusMessage(`Error: ${result.error}`);
          toast.error(result.error);
          setIsPurchasing(false);
          return { success: false, error: result.error };
        } else {
          // User cancelled
          setStatusMessage(null);
          setIsPurchasing(false);
          return { success: false, cancelled: true };
        }
      }

      // WEB PLATFORM → Stripe
      // CRITICAL: This code path is ONLY reachable when platform === 'web'
      console.log('[PaymentRouter] Web platform - using Stripe checkout');

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        setIsPurchasing(false);
        return { success: false, error: 'Not signed in' };
      }

      // Get Stripe payment link - this function validates platform === 'web'
      const stripePaymentLink = getStripePaymentLink();
      const paymentUrl = `${stripePaymentLink}?prefilled_email=${encodeURIComponent(session.user.email)}`;
      window.location.assign(paymentUrl);
      
      // Note: isPurchasing stays true as we're navigating away
      return { success: true }; // Redirecting to Stripe checkout

    } catch (err: any) {
      console.error('[PaymentRouter] Purchase error:', err);
      const errorMsg = err.message || 'Purchase failed';
      setStatusMessage(`Error: ${errorMsg}`);
      toast.error(errorMsg);
      setIsPurchasing(false);
      return { success: false, error: errorMsg };
    }
  }, [
    isPurchasing,
    platform,
    isNative,
    isOfferingsReady,
    revenueCatContext,
    refreshSubscription,
    navigate
  ]);

  /**
   * Restore purchases - ONLY available on native platforms
   */
  const restorePurchases = useCallback(async (): Promise<RestoreResult> => {
    if (!isNative) {
      console.log('[PaymentRouter] Restore not available on web');
      return { success: false, isPremiumNow: false, error: 'Not available on web' };
    }

    if (isRestoring) {
      return { success: false, isPremiumNow: false, error: 'Restore already in progress' };
    }

    if (!revenueCatContext.isUserLoggedIn) {
      toast.error('Please sign in to restore purchases');
      navigate('/auth');
      return { success: false, isPremiumNow: false, error: 'Not signed in' };
    }

    console.log('[PaymentRouter] Starting restore on platform:', platform);
    setIsRestoring(true);
    setStatusMessage('Restoring purchases…');

    try {
      const result = await revenueCatContext.restorePurchases();
      console.log('[PaymentRouter] Restore result:', result);

      if (result.isLinkedToOtherAccount) {
        setStatusMessage('Subscription linked to another account');
        toast.error('This subscription is already linked to another account.');
        setIsRestoring(false);
        return { 
          success: false, 
          isPremiumNow: false, 
          isLinkedToOtherAccount: true,
          error: 'Linked to another account'
        };
      }

      // Always trust backend as source of truth
      const updated = await refreshSubscription();
      if (updated.isPremium) {
        setStatusMessage('Purchases restored!');
        toast.success('Purchases restored! Premium activated.');
        setIsRestoring(false);
        return { success: true, isPremiumNow: true };
      } else {
        setStatusMessage('Subscription not available for this account');
        toast.error('This subscription is linked to another account.');
        setIsRestoring(false);
        return { success: false, isPremiumNow: false, error: 'Linked to another account' };
      }
    } catch (err: any) {
      console.error('[PaymentRouter] Restore error:', err);
      const errorMsg = err.message || 'Restore failed';
      setStatusMessage(`Restore failed: ${errorMsg}`);
      toast.error('Failed to restore purchases');
      setIsRestoring(false);
      return { success: false, isPremiumNow: false, error: errorMsg };
    }
  }, [isNative, isRestoring, platform, revenueCatContext, refreshSubscription, navigate]);

  /**
   * Retry loading offerings - ONLY for native platforms
   */
  const retryOfferings = useCallback(async () => {
    if (!isNative) return;

    if (!revenueCatContext.isUserLoggedIn) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }

    setStatusMessage('Retrying…');
    await revenueCatContext.retryInitialization();
    setStatusMessage(null);
  }, [isNative, revenueCatContext, navigate]);

  /**
   * Clear status message
   */
  const clearStatus = useCallback(() => {
    setStatusMessage(null);
  }, []);

  return {
    // Platform info
    platform,
    isNative,
    
    // State
    isPurchasing,
    isRestoring,
    statusMessage,
    isOfferingsReady,
    priceString,
    
    // Actions
    startPurchase,
    restorePurchases,
    retryOfferings,
    clearStatus,
    
    // RevenueCat passthrough for native-specific needs
    isUserLoggedIn: revenueCatContext.isUserLoggedIn,
    isRevenueCatLoading: revenueCatContext.isLoading,
  };
};
