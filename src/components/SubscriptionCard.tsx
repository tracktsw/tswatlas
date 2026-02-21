import { Crown, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getTermsUrl, getManageSubscriptionUrl, PRIVACY_POLICY_URL, type Platform } from '@/utils/platformLinks';
const SubscriptionCard = () => {
  const navigate = useNavigate();
  const revenueCat = useRevenueCatContext();
  const { isPremium, isAdmin, isLoading: isBackendLoading, subscriptionEnd, refreshSubscription } = useSubscription();
  const {
    platform,
    isNative,
    isPurchasing,
    isRestoring,
    statusMessage,
    isOfferingsReady,
    priceString,
    isTrialEligible,
    isTrialEligibilityPending,
    startPurchase,
    restorePurchases,
    retryOfferings,
    isUserLoggedIn,
    isRevenueCatLoading,
  } = usePaymentRouter();
  
  // Prevent a brief non-premium flash on native while RevenueCat initializes/validates.
  const isNativePending = isNative && isUserLoggedIn && !revenueCat.isInitialized;
  // Also wait for trial eligibility to be determined
  const isLoading = isBackendLoading || isNativePending || isTrialEligibilityPending;

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
            {/* Subscription management links for native platforms */}
            {!isAdmin && isNative && (
              <div className="flex flex-wrap items-center gap-1 mt-3 text-xs">
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="text-primary underline hover:opacity-80 disabled:opacity-50"
                >
                  {isRestoring ? 'Restoring...' : 'Restore Purchases'}
                </button>
                <span className="text-muted-foreground">|</span>
                <a
                  href={getManageSubscriptionUrl(platform as Platform)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:opacity-80"
                >
                  Manage Subscription
                </a>
                <span className="text-muted-foreground">|</span>
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:opacity-80"
                >
                  Privacy Policy
                </a>
                <span className="text-muted-foreground">|</span>
                <a
                  href={getTermsUrl(platform as Platform)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:opacity-80"
                >
                  Terms of Use
                </a>
              </div>
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
            Unlock Photo Diary, full Insights, Community, Journal, and TrackTSW Coach.
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
                {isTrialEligible 
                  ? `Start 14-Day Free Trial · ${priceString}/month`
                  : `Subscribe – ${priceString}/month`}
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            {isTrialEligible 
              ? `${priceString}/month after 14-day free trial. Auto-renewable. Cancel anytime.`
              : `${priceString}/month. Auto-renewable. Cancel anytime.`}
          </p>
          
          <p className="text-xs text-muted-foreground mt-1">
            By subscribing, you agree to our{' '}
            <a 
              href={getTermsUrl(platform as Platform)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              Terms of Use
            </a>{' '}
            and{' '}
            <a 
              href={PRIVACY_POLICY_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              Privacy Policy
            </a>.
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
