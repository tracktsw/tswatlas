import { ReactNode, useMemo, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSubscription } from '@/hooks/useSubscription';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { Lock, Sparkles, Crown, Loader2, RotateCcw, RefreshCw, Bug, LogIn } from 'lucide-react';
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
    isPremiumFromRC,
    isUserLoggedIn,
    boundUserId,
    getDebugInfo,
    retryInitialization,
  } = useRevenueCatContext();
  
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // CRITICAL: Check platform at runtime
  const isNativeIOS = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',
    []
  );
  
  // Admin always gets premium access, regardless of platform
  // On iOS: Check RevenueCat OR admin status
  // On Web: Check backend (Stripe) OR admin status
  const isPremium = isAdmin || (isNativeIOS ? isPremiumFromRC : isPremiumFromBackend);
  // On iOS, also wait for backend to load (for admin check) before denying access
  const isLoading = isNativeIOS ? (isRevenueCatLoading || isBackendLoading) : isBackendLoading;
  
  // CRITICAL: On iOS, offerings are only ready if user is logged in AND offerings loaded
  const isOfferingsReady = isNativeIOS ? (isUserLoggedIn && offeringsStatus === 'ready') : true;

  // Auto-hide paywall when premium becomes active
  useEffect(() => {
    if (isPremium && isUpgrading) {
      console.log('[PaywallGuard] Premium detected, closing paywall');
      setIsUpgrading(false);
      setStatusMessage(null);
    }
  }, [isPremium, isUpgrading]);

  const handleUpgrade = async () => {
    if (isUpgrading) return;

    const debugInfo = getDebugInfo();
    console.log('[PaywallGuard] handleUpgrade called:', debugInfo);

    setStatusMessage(null);

    // iOS NATIVE PATH - STRIPE IS COMPLETELY BLOCKED
    if (isNativeIOS) {
      // CRITICAL: Must be logged in to purchase
      if (!isUserLoggedIn) {
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        return;
      }

      // If offerings aren't ready, show error + retry button (NEVER fall back to Stripe)
      if (!isOfferingsReady) {
        const msg = offeringsError || 'Loading subscription options…';
        setStatusMessage(msg);
        toast.error(msg);
        return;
      }

      setIsUpgrading(true);
      setStatusMessage('Opening App Store…');

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
    if (isRestoring || !isNativeIOS) return;
    
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
        // CRITICAL: Subscription belongs to different account
        setStatusMessage('Subscription linked to another account');
        toast.error('This subscription is already linked to another account.');
      } else if (result.isPremiumNow) {
        setStatusMessage('Purchases restored!');
        toast.success('Purchases restored! Premium activated.');
        // Also refresh backend
        await refreshSubscription();
      } else {
        setStatusMessage('No purchases found');
        toast.info('No previous purchases found');
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
  const priceString = isNativeIOS ? getPriceString() : '£5.99';
  const isButtonLoading = isUpgrading || isRevenueCatLoading;
  const isSubscribeDisabled = isButtonLoading || (isNativeIOS && !isOfferingsReady);

  // Debug panel (iOS only)
  const debugPanel = isNativeIOS && showDebug && (
    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-left text-xs font-mono space-y-1">
      <div className="font-bold text-foreground mb-2">RevenueCat Debug</div>
      {Object.entries(getDebugInfo()).map(([key, value]) => (
        <div key={key} className="flex justify-between">
          <span className="text-muted-foreground">{key}:</span>
          <span className="text-foreground">{String(value)}</span>
        </div>
      ))}
    </div>
  );

  // Blurred content overlay
  if (showBlurred) {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
          <div className="text-center p-6 max-w-sm">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Premium Feature</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {feature} is available with Premium.
            </p>
            
            {/* CRITICAL: Show sign in button if not logged in on iOS */}
            {isNativeIOS && !isUserLoggedIn ? (
              <Button onClick={() => navigate('/auth')} variant="gold" className="gap-2">
                <LogIn className="w-4 h-4" />
                Sign in to Subscribe
              </Button>
            ) : (
              <>
                {/* Subscribe Button */}
                <Button onClick={handleUpgrade} disabled={isSubscribeDisabled} variant="gold" className="gap-2">
                  {isButtonLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing…
                    </>
                  ) : isNativeIOS && !isOfferingsReady ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4" />
                      Start 14-day free trial
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-muted-foreground mt-2">
                  {priceString}/month after · Cancel anytime
                </p>
              </>
            )}

            {/* iOS: Retry button if offerings failed */}
            {isNativeIOS && isUserLoggedIn && offeringsStatus === 'error' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={handleRetryOfferings}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            )}

            {/* Status message */}
            {statusMessage && (
              <p className="text-xs text-muted-foreground mt-2">{statusMessage}</p>
            )}

            {/* iOS: Restore purchases - only if logged in */}
            {isNativeIOS && isUserLoggedIn && (
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

            {/* Debug toggle */}
            {isNativeIOS && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 gap-1 text-muted-foreground text-xs"
                onClick={() => setShowDebug(!showDebug)}
              >
                <Bug className="w-3 h-3" />
                {showDebug ? 'Hide' : 'Show'} Debug
              </Button>
            )}

            {debugPanel}
          </div>
        </div>
      </div>
    );
  }

  // Full paywall screen
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h2 className="font-display text-xl font-bold text-foreground mb-2">
        Unlock {feature}
      </h2>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Get full access to all features including Photo Diary, full Insights, Community, Journal, and AI Coach.
      </p>
      
      <div className="space-y-3 w-full max-w-xs">
        {/* CRITICAL: Show sign in button if not logged in on iOS */}
        {isNativeIOS && !isUserLoggedIn ? (
          <Button onClick={() => navigate('/auth')} variant="gold" className="w-full gap-2" size="lg">
            <LogIn className="w-4 h-4" />
            Sign in to Subscribe
          </Button>
        ) : (
          <>
            {/* Subscribe Button */}
            <Button onClick={handleUpgrade} disabled={isSubscribeDisabled} variant="gold" className="w-full gap-2" size="lg">
              {isButtonLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : isNativeIOS && !isOfferingsReady ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading subscription…
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  Start 14-day free trial
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              {priceString}/month after · Cancel anytime
            </p>
          </>
        )}

        {/* iOS: Retry button if offerings failed */}
        {isNativeIOS && isUserLoggedIn && offeringsStatus === 'error' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleRetryOfferings}
          >
            <RefreshCw className="w-4 h-4" />
            Retry loading subscription
          </Button>
        )}

        {/* Status message */}
        {statusMessage && (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}

        {/* iOS: Restore purchases - only if logged in */}
        {isNativeIOS && isUserLoggedIn && (
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

        {/* Debug toggle */}
        {isNativeIOS && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground text-xs"
            onClick={() => setShowDebug(!showDebug)}
          >
            <Bug className="w-3 h-3" />
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </Button>
        )}

        {debugPanel}
      </div>
    </div>
  );
};

export default PaywallGuard;
