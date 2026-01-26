import { ReactNode, useState, useEffect, useRef } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { Lock, Sparkles, Crown, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackPaywallShown, trackUpgradeClicked } from '@/utils/analytics';
import { getTermsUrl, PRIVACY_POLICY_URL, type Platform } from '@/utils/platformLinks';

interface PaywallGuardProps {
  children: ReactNode;
  feature?: string;
  showBlurred?: boolean;
}

// Map route paths to paywall locations
const getPaywallLocation = (pathname: string): 'coach' | 'insights' | 'photos' | 'journal' | 'community' | 'settings' | 'other' => {
  if (pathname.includes('coach')) return 'coach';
  if (pathname.includes('insights')) return 'insights';
  if (pathname.includes('photo')) return 'photos';
  if (pathname.includes('journal')) return 'journal';
  if (pathname.includes('community')) return 'community';
  if (pathname.includes('settings')) return 'settings';
  return 'other';
};

const PaywallGuard = ({ children, feature = 'This feature', showBlurred = false }: PaywallGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const revenueCat = useRevenueCatContext();
  const { isPremium, isAdmin, isLoading: isBackendLoading } = useSubscription();
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
  
  const [upgradeAttempted, setUpgradeAttempted] = useState(false);
  const hasTrackedPaywallRef = useRef(false);

  const effectiveIsPremium = isAdmin || isPremium;
  const paywallLocation = getPaywallLocation(location.pathname);

  // Prevent a brief paywall flash on native while RevenueCat initializes/validates.
  const isNativePending = isNative && isUserLoggedIn && !revenueCat.isInitialized;
  const isLoading = isBackendLoading || isNativePending;

  // Track paywall_shown once when paywall is actually displayed
  useEffect(() => {
    if (!isLoading && !effectiveIsPremium && !hasTrackedPaywallRef.current) {
      trackPaywallShown(feature, paywallLocation);
      hasTrackedPaywallRef.current = true;
    }
  }, [isLoading, effectiveIsPremium, feature, paywallLocation]);

  // Auto-hide paywall when premium becomes active
  useEffect(() => {
    if (effectiveIsPremium && upgradeAttempted) {
      console.log('[PaywallGuard] Premium detected, closing paywall');
      setUpgradeAttempted(false);
    }
  }, [effectiveIsPremium, upgradeAttempted]);

  const handleUpgrade = async () => {
    console.log(`[PaywallGuard] handleUpgrade on platform: ${platform}`);
    
    // Track upgrade button click
    trackUpgradeClicked(feature, paywallLocation, priceString);
    
    setUpgradeAttempted(true);

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

  // Loading state
  if (isLoading && !effectiveIsPremium) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Premium - show content
  if (effectiveIsPremium) {
    return <>{children}</>;
  }

  const isButtonLoading = isPurchasing || isRevenueCatLoading;

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
            
            <Button
              onClick={handleUpgrade}
              disabled={isButtonLoading}
              variant="gold"
              className="gap-2"
            >
              {isButtonLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  Start 14-Day Free Trial · {priceString}/month
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground mt-2">
              {priceString}/month after 14-day free trial. Auto-renewable. Cancel anytime.
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
        <Button
          onClick={handleUpgrade}
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
              Start 14-Day Free Trial · {priceString}/month
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          {priceString}/month after 14-day free trial. Auto-renewable. Cancel anytime.
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
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}

        {/* Native: Restore purchases - only if logged in */}
        {isNative && isUserLoggedIn && (
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
