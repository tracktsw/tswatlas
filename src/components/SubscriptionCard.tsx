import { useMemo, useState } from 'react';
import { Crown, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

// STRIPE IS COMPLETELY DISABLED ON iOS - This link is ONLY for web
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/fZudR12RBaH1cEveGH1gs01';

const SubscriptionCard = () => {
  const navigate = useNavigate();
  const { isPremium: isPremiumFromBackend, isAdmin, isLoading: isBackendLoading, subscriptionEnd, refreshSubscription } = useSubscription();
  const {
    isLoading: isRevenueCatLoading,
    purchaseMonthly,
    restorePurchases,
    getPriceString,
    offeringsStatus,
    offeringsError,
    isUserLoggedIn,
    boundUserId,
    getDebugInfo,
    retryInitialization,
  } = useRevenueCatContext();
  
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  

  // CRITICAL: Runtime platform check
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
  const isPremium = isAdmin || isPremiumFromBackend;
  const isLoading = isBackendLoading;
  
  // CRITICAL: On native mobile, offerings are only ready if user is logged in AND offerings loaded
  const isOfferingsReady = isNativeMobile ? (isUserLoggedIn && offeringsStatus === 'ready') : true;

  const handleUpgrade = async () => {
    // CRITICAL: Log at the VERY START to confirm this function is called
    console.log('[SubscriptionCard] ========== handleUpgrade() CALLED ==========');
    
    const debugInfo = getDebugInfo();
    console.log('[SubscriptionCard] Debug info:', debugInfo);
    console.log('[SubscriptionCard] State:', {
      isCheckoutLoading,
      isNativeIOS,
      isNativeAndroid,
      isNativeMobile,
      isUserLoggedIn,
      offeringsStatus,
      offeringsError,
      isOfferingsReady,
    });

    if (isCheckoutLoading) {
      console.log('[SubscriptionCard] Already loading, returning early');
      return;
    }

    setStatusMessage(null);

    // NATIVE MOBILE PATH (iOS or Android) - STRIPE IS COMPLETELY BLOCKED
    if (isNativeMobile) {
      console.log('[SubscriptionCard] Native mobile path - will use RevenueCat');
      
      // CRITICAL: Must be logged in to purchase
      if (!isUserLoggedIn) {
        console.log('[SubscriptionCard] User not logged in, redirecting to auth');
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        return;
      }

      if (!isOfferingsReady) {
        console.log('[SubscriptionCard] Offerings not ready:', { offeringsStatus, offeringsError });
        const msg = offeringsError || 'Loading subscription options…';
        setStatusMessage(msg);
        toast.error(msg);
        return;
      }
      
      console.log('[SubscriptionCard] All checks passed, calling purchaseMonthly()...');

      setIsCheckoutLoading(true);
      const storeName = isNativeIOS ? 'App Store' : 'Google Play';
      setStatusMessage(`Opening ${storeName}…`);

      try {
        const result = await purchaseMonthly();
        console.log('[SubscriptionCard] Purchase result:', result);

        if (result.success) {
          setStatusMessage('Purchase successful!');
          toast.success('Purchase successful!');
          await refreshSubscription();
        } else if (result.error) {
          setStatusMessage(`Error: ${result.error}`);
          toast.error(result.error);
        } else {
          setStatusMessage('Cancelled');
        }
      } catch (err: any) {
        console.error('[SubscriptionCard] Purchase error:', err);
        setStatusMessage(`Error: ${err.message}`);
        toast.error(err.message || 'Purchase failed');
      }

      setIsCheckoutLoading(false);
      return;
    }

    // WEB PATH - Stripe
    setIsCheckoutLoading(true);
    console.log('[SubscriptionCard] Web - using Stripe');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        toast.error('Please sign in to subscribe');
        navigate('/auth');
        setIsCheckoutLoading(false);
        return;
      }

      const paymentUrl = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(session.user.email)}`;
      window.location.assign(paymentUrl);
    } catch (err) {
      console.error('[SubscriptionCard] Stripe error:', err);
      toast.error('Checkout couldn\'t start. Please try again.');
      setIsCheckoutLoading(false);
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
    setStatusMessage('Restoring…');
    
    try {
      const result = await restorePurchases();

      if (result.isLinkedToOtherAccount) {
        toast.error('This subscription is already linked to another account.');
        setStatusMessage('Linked to another account');
        return;
      }

      // Always trust backend as the source of truth
      const updated = await refreshSubscription();
      if (updated.isPremium) {
        toast.success('Purchases restored!');
        setStatusMessage(null);
      } else {
        toast.error('This subscription is linked to another account.');
        setStatusMessage('Linked to another account');
      }
    } catch (err: any) {
      console.error('[SubscriptionCard] Restore error:', err);
      toast.error('Failed to restore purchases');
      setStatusMessage(null);
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

  const handleManageSubscription = async () => {
    if (isPortalLoading) return;

    setIsPortalLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in');
        setIsPortalLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || data?.error) {
        if (data?.error?.includes('No Stripe customer')) {
          toast.error('No active subscription found.');
        } else {
          toast.error('Failed to open subscription portal.');
        }
        setIsPortalLoading(false);
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
      } else {
        toast.error('Failed to open subscription portal.');
        setIsPortalLoading(false);
      }
    } catch (err) {
      console.error('[SubscriptionCard] Portal error:', err);
      toast.error('Failed to open subscription portal.');
      setIsPortalLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Checking subscription...</span>
        </div>
      </div>
    );
  }

  // Premium active
  if (isPremium || isAdmin) {
    return (
      <div className="glass-card p-4 border-2 border-primary/30">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Premium Active</h3>
              {isAdmin && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin 
                ? 'You have full access as an admin.'
                : subscriptionEnd 
                  ? `Renews on ${format(parseISO(subscriptionEnd), 'MMMM d, yyyy')}`
                  : 'You have full access to all features.'}
            </p>
            {/* Web users: Manage via Stripe portal */}
            {!isAdmin && !isNativeMobile && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 gap-2"
                onClick={handleManageSubscription}
                disabled={isPortalLoading}
              >
                {isPortalLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening...
                  </>
                ) : (
                  'Manage Subscription'
                )}
              </Button>
            )}
          </div>
          <button 
            onClick={refreshSubscription}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

      </div>
    );
  }

  // Not premium - show upgrade UI
  const priceString = isNativeMobile ? getPriceString() : '£5.99';
  const isButtonLoading = isCheckoutLoading || isRevenueCatLoading;

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
      console.error('[SubscriptionCard] Button click error:', err);
      toast.error(err?.message || 'Something went wrong');
    }
  };

  // Subscription card matching Settings layout
  return (
    <div className="glass-card p-4 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Upgrade to Premium</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Unlock Photo Diary, full Insights, Community, Journal, and AI Coach.
          </p>
          
          <p className="text-xs text-muted-foreground mt-3">
            14-day free trial. Then {priceString}/month. Cancel anytime.
          </p>
          
          <Button 
            size="sm" 
            variant="gold"
            className="mt-2 gap-2"
            onClick={handleButtonClick}
            disabled={isButtonLoading}
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
              className="mt-2 gap-2 text-muted-foreground"
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

          {/* Android debug info */}
          {isNativeAndroid && (
            <p className="text-[10px] text-muted-foreground/60 mt-3 font-mono break-all">
              android={String(isNativeAndroid)} | loggedIn={String(isUserLoggedIn)} | offerings={offeringsStatus} | err={offeringsError ?? 'none'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCard;
