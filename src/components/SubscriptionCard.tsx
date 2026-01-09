import { useState } from 'react';
import { Crown, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const SubscriptionCard = () => {
  const navigate = useNavigate();
  const { isPremium: isPremiumFromBackend, isAdmin, isLoading: isBackendLoading, subscriptionEnd, refreshSubscription } = useSubscription();
  const {
    platform,
    isNative,
    isPurchasing,
    isRestoring,
    statusMessage,
    isOfferingsReady,
    priceString,
    startPurchase,
    restorePurchases,
    retryOfferings,
    isUserLoggedIn,
    isRevenueCatLoading,
  } = usePaymentRouter();
  
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  // Premium is enforced by backend for ALL platforms.
  const isPremium = isAdmin || isPremiumFromBackend;
  const isLoading = isBackendLoading;

  const handleUpgrade = async () => {
    console.log(`[SubscriptionCard] handleUpgrade on platform: ${platform}`);

    // On native, check if user is logged in first
    if (isNative && !isUserLoggedIn) {
      toast.error('Please sign in to subscribe');
      navigate('/auth');
      return;
    }

    // On native, retry offerings if not ready
    if (isNative && !isOfferingsReady) {
      await retryOfferings();
      return;
    }

    // Use unified purchase flow
    await startPurchase();
  };

  const handleRestore = async () => {
    if (!isNative) return;
    await restorePurchases();
  };

  /**
   * Manage subscription via Stripe Customer Portal
   * CRITICAL: This is ONLY available on web platform
   * Native platforms manage subscriptions through App Store / Play Store
   */
  const handleManageSubscription = async () => {
    // HARD RULE: No Stripe on native platforms
    if (isNative) {
      console.log('[SubscriptionCard] Manage subscription not available on native - use App Store/Play Store');
      toast.info('Manage your subscription in your device settings');
      return;
    }

    if (isPortalLoading) return;

    setIsPortalLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in');
        setIsPortalLoading(false);
        return;
      }

      // Call Stripe customer portal edge function (web only)
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
            {/* Manage subscription: Web → Stripe portal, Native → App Store / Play Store */}
            {!isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 gap-2"
                onClick={isNative 
                  ? () => toast.info(platform === 'ios' 
                    ? 'Manage your subscription in Settings → Apple ID → Subscriptions'
                    : 'Manage your subscription in Google Play Store → Payments & subscriptions')
                  : handleManageSubscription
                }
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
  const isButtonLoading = isPurchasing || isRevenueCatLoading;

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
          
          <Button 
            size="sm" 
            variant="gold"
            className="mt-3 gap-2"
            onClick={handleUpgrade}
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
                Unlock · {priceString}/month
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            14 day free trial · {priceString}/month after · Cancel anytime
          </p>

          {/* Status message */}
          {statusMessage && (
            <p className="text-xs text-muted-foreground mt-2">{statusMessage}</p>
          )}

          {/* Native: Restore purchases - only if logged in */}
          {isNative && isUserLoggedIn && (
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

        </div>
      </div>
    </div>
  );
};

export default SubscriptionCard;
