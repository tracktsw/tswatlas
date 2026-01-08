import { ReactNode, useMemo, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSubscription } from '@/hooks/useSubscription';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { Crown, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PaywallGuardProps {
  children: ReactNode;
  feature?: string;
  showBlurred?: boolean;
}

// STRIPE IS COMPLETELY DISABLED ON iOS - This link is ONLY for web
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/fZudR12RBaH1cEveGH1gs01';

const PaywallGuard = ({ children, feature = 'This feature', showBlurred = false }: PaywallGuardProps) => {
  const navigate = useNavigate();
  const { isPremium: isPremiumFromBackend, isAdmin, isLoading: isBackendLoading, refreshSubscription } = useSubscription();
  const {
    isLoading: isRevenueCatLoading,
    isInitialized,
    purchaseMonthly,
    restorePurchases,
    refreshCustomerInfo,
    getPriceString,
    offeringsStatus,
    offeringsError,
    isUserLoggedIn,
    boundUserId,
    retryInitialization,
  } = useRevenueCatContext();
  
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // CRITICAL: Check platform at runtime
  const isNativeIOS = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',
    []
  );
  
  const isNativeAndroid = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
    []
  );
  
  const isNativeMobile = isNativeIOS || isNativeAndroid;
  
  // Premium is enforced by backend for ALL platforms.
  // RevenueCat is used for purchasing/restoring only; the backend decides access.
  const isPremium = isAdmin || isPremiumFromBackend;
  const isLoading = isBackendLoading;
  
  // CRITICAL: On native mobile, offerings are only ready if user is logged in AND offerings loaded
  const isOfferingsReady = isNativeMobile ? (isUserLoggedIn && offeringsStatus === 'ready') : true;

  // Auto-hide paywall when premium becomes active
  useEffect(() => {
    if (isPremium && isUpgrading) {
      console.log('[PaywallGuard] Premium detected, closing paywall');
      setIsUpgrading(false);
      setStatusMessage(null);
    }
  }, [isPremium, isUpgrading]);

  const handleUpgrade = async () => {
    // CRITICAL: Log at the VERY START to confirm this function is called
    console.log('[PaywallGuard] ========== handleUpgrade() CALLED ==========');
    console.log('[PaywallGuard] State:', {
      isUpgrading,
      isNativeIOS,
      isNativeAndroid,
      isNativeMobile,
      isUserLoggedIn,
      offeringsStatus,
      offeringsError,
      isOfferingsReady,
    });

    if (isUpgrading) {
      console.log('[PaywallGuard] Already upgrading, returning early');
      return;
    }

    setStatusMessage(null);

    // NATIVE MOBILE PATH (iOS or Android) - STRIPE IS COMPLETELY BLOCKED
    if (isNativeMobile) {
      console.log('[PaywallGuard] Native mobile path - will use RevenueCat');
      
      // CRITICAL: Must be logged in to purchase
      if (!isUserLoggedIn) {
        console.log('[PaywallGuard] User not logged in, redirecting to auth');
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        return;
      }

      // If offerings aren't ready, show error + retry button (NEVER fall back to Stripe)
      if (!isOfferingsReady) {
        console.log('[PaywallGuard] Offerings not ready:', { offeringsStatus, offeringsError });
        const msg = offeringsError || 'Loading subscription options…';
        setStatusMessage(msg);
        toast.error(msg);
        return;
      }
      
      console.log('[PaywallGuard] All checks passed, calling purchaseMonthly()...');

      setIsUpgrading(true);
      const storeName = isNativeIOS ? 'App Store' : 'Google Play';
      setStatusMessage(`Opening ${storeName}…`);

      try {
        const result = await purchaseMonthly();
        console.log('[PaywallGuard] Purchase result:', result);

        if (result.success) {
          setStatusMessage('Purchase successful! Activating…');
          toast.success('Purchase successful!');
          
          // Premium should already be set from purchaseMonthly
          // But also refresh backend to sync
          if (result.isPremiumNow) {
            console.log('[PaywallGuard] Premium active immediately!');
          }
          
          // Also refresh backend subscription status
          await refreshSubscription();
          setStatusMessage(null);
        } else if (result.error) {
          console.error('[PaywallGuard] Purchase error:', result.error);
          setStatusMessage(`Error: ${result.error}`);
          toast.error(result.error);
        } else {
          // User cancelled
          setStatusMessage('Purchase cancelled');
          console.log('[PaywallGuard] User cancelled purchase');
        }
      } catch (err: any) {
        console.error('[PaywallGuard] Purchase exception:', err);
        setStatusMessage(`Error: ${err.message || 'Unknown error'}`);
        toast.error(err.message || 'Purchase failed');
      }

      setIsUpgrading(false);
      return;
    }

    // WEB PATH - Use Stripe
    setIsUpgrading(true);
    console.log('[PaywallGuard] Web - using Stripe');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        setIsUpgrading(false);
        return;
      }

      const paymentUrl = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(session.user.email)}`;
      window.location.assign(paymentUrl);
      // Note: isUpgrading stays true as we're navigating away
    } catch (err) {
      console.error('[PaywallGuard] Stripe error:', err);
      toast.error('Failed to start checkout');
      setIsUpgrading(false);
    }
  };

  const handleRestore = async () => {
    if (isRestoring || !isNativeMobile) return;
    
    // CRITICAL: Must be logged in to restore
    if (!isUserLoggedIn) {
      toast.error('Please sign in to restore purchases');
      navigate('/auth');
      return;
    }
    
    setIsRestoring(true);
    setStatusMessage('Restoring purchases…');
    console.log('[PaywallGuard] Starting restore...');
    
    try {
      const result = await restorePurchases();
      console.log('[PaywallGuard] Restore result:', result);

      if (result.isLinkedToOtherAccount) {
        setStatusMessage('Subscription linked to another account');
        toast.error('This subscription is already linked to another account.');
        return;
      }

      // Always trust backend as the source of truth
      const updated = await refreshSubscription();
      if (updated.isPremium) {
        setStatusMessage('Purchases restored!');
        toast.success('Purchases restored! Premium activated.');
      } else {
        setStatusMessage('Subscription not available for this account');
        toast.error('This subscription is linked to another account.');
      }
    } catch (err: any) {
      console.error('[PaywallGuard] Restore error:', err);
      setStatusMessage(`Restore failed: ${err.message || 'Unknown error'}`);
      toast.error('Failed to restore purchases');
    }
    
    setIsRestoring(false);
  };

  const handleRetryOfferings = async () => {
    if (!isUserLoggedIn) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }
    setStatusMessage('Retrying…');
    await retryInitialization();
    setStatusMessage(null);
  };

  // Loading state
  if (isLoading && !isPremium) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Premium - show content
  if (isPremium) {
    return <>{children}</>;
  }

  // Get price string
  const priceString = isNativeMobile ? getPriceString() : '£5.99';
  const isButtonLoading = isUpgrading || isRevenueCatLoading;

  const handleButtonClick = async () => {
    try {
      // Keep original button label; choose behavior based on native mobile state
      if (isNativeMobile && !isUserLoggedIn) {
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        return;
      }
      if (isNativeMobile && !isOfferingsReady) {
        await handleRetryOfferings();
        return;
      }
      await handleUpgrade();
    } catch (err: any) {
      console.error('[PaywallGuard] Button click error:', err);
      toast.error(err?.message || 'Something went wrong');
    }
  };

  // Blurred content overlay
  if (showBlurred) {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
          <div className="text-center p-6 max-w-sm">
            {/* Value proposition headline */}
            <h2 className="text-xl font-bold text-foreground mb-4">
              Subscribe to get full access to Photo Diary, advanced Insight analysis and AI Coach
            </h2>
            
            <p className="text-xs text-muted-foreground mb-3">
              14-day free trial. Then {priceString}/month. Cancel anytime.
            </p>
            
            <Button
              onClick={handleButtonClick}
              disabled={isButtonLoading}
              variant="gold"
              className="gap-2 w-full"
            >
              {isButtonLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  Unlock – {priceString}/month
                </>
              )}
            </Button>

            {/* Status message */}
            {statusMessage && (
              <p className="text-xs text-muted-foreground mt-2">{statusMessage}</p>
            )}

            {/* Native mobile: Restore purchases - only if logged in */}
            {isNativeMobile && isUserLoggedIn && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 gap-2 text-muted-foreground"
                onClick={handleRestore}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Restoring…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    Restore purchases
                  </>
                )}
              </Button>
            )}

          </div>
        </div>
      </div>
    );
  }

  // Full paywall screen
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Value proposition headline */}
      <h1 className="text-2xl font-bold text-foreground mb-4 max-w-xs">
        Subscribe to get full access to Photo Diary, advanced Insight analysis and AI Coach
      </h1>
      
      <div className="space-y-3 w-full max-w-xs">
        <p className="text-xs text-muted-foreground">
          14-day free trial. Then {priceString}/month. Cancel anytime.
        </p>
        
        <Button
          onClick={handleButtonClick}
          disabled={isButtonLoading}
          variant="gold"
          className="w-full gap-2"
          size="lg"
        >
          {isButtonLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Crown className="w-4 h-4" />
              Unlock – {priceString}/month
            </>
          )}
        </Button>

        {/* Status message */}
        {statusMessage && (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}

        {/* Native mobile: Restore purchases - only if logged in */}
        {isNativeMobile && isUserLoggedIn && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Restoring…
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                Restore purchases
              </>
            )}
          </Button>
        )}

      </div>
    </div>
  );
};

export default PaywallGuard;
