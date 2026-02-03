import { ReactNode, useState, useEffect, useRef } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { Lock, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
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
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-coral/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-coral" />
            </div>
            <h3 className="font-display font-bold text-foreground mb-1 text-lg">
              Something you're doing could be making this worse
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              We look for patterns in your check-ins and compare them with what others commonly report.
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
                  Start 14-Day Free Trial – {priceString}/month
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground mt-3">
              {priceString}/month after free trial · Cancel anytime
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your tracking stays free either way.
            </p>
            
            <p className="text-xs text-muted-foreground mt-2">
              <a 
                href={getTermsUrl(platform as Platform)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                Terms
              </a>
              {' · '}
              <a 
                href={PRIVACY_POLICY_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                Privacy
              </a>
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

  // Full paywall screen - comparison table design
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="bg-background/95 backdrop-blur-sm px-5 py-6 max-w-md rounded-2xl shadow-lg border border-border/50">
        {/* Header */}
        <div className="text-center mb-5">
          <h3 className="font-display font-bold text-lg text-foreground mb-2 leading-tight">
            {feature === 'AI Coach' 
              ? 'Most People With TSW Miss the Things That Make It Worse'
              : 'You Might Be Slowing Your Own TSW Recovery Without Realising It'}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {feature === 'AI Coach'
              ? 'Gain access to the AI coach powered by Gemini to make learning what you should do for your skin quick and easy.'
              : 'Premium highlights behaviours and exposures commonly linked to flare worsening — so you can adjust earlier.'}
          </p>
        </div>

        {/* Compare Features Table */}
        <div className="mb-5">
          <h4 className="font-display font-semibold text-sm text-foreground text-center mb-3">
            Compare features
          </h4>
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            {/* Table Header */}
            <div className="grid grid-cols-3 bg-muted/50 border-b border-border">
              <div className="p-2"></div>
              <div className="p-2 text-center font-medium text-muted-foreground">Free</div>
              <div className="p-2 text-center font-semibold text-foreground bg-primary/10">Premium</div>
            </div>
            {/* Feature Rows */}
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Daily check-ins</div>
              <div className="p-2 text-center text-muted-foreground">✓</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Weekly overview</div>
              <div className="p-2 text-center text-muted-foreground">✓</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Community access</div>
              <div className="p-2 text-center text-muted-foreground">✓</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Journal access</div>
              <div className="p-2 text-center text-muted-foreground">✓</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Photo uploads</div>
              <div className="p-2 text-center text-muted-foreground">Limited</div>
              <div className="p-2 text-center text-primary bg-primary/5">Unlimited</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Photo comparison</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Treatment impact insights</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Trigger detection</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Food & product analysis</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Mood, pain & sleep trends</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3 border-b border-border">
              <div className="p-2 text-foreground">Flare calendar</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
            <div className="grid grid-cols-3">
              <div className="p-2 text-foreground">AI coach</div>
              <div className="p-2 text-center text-muted-foreground">✗</div>
              <div className="p-2 text-center text-primary bg-primary/5">✓</div>
            </div>
          </div>
        </div>

        {/* Subscribe Button */}
        <Button 
          onClick={handleUpgrade} 
          disabled={isButtonLoading} 
          variant="gold" 
          className="w-full gap-2" 
          size="default"
        >
          {isButtonLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              Start 14-Day Free Trial – {priceString}/month
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {priceString}/month after free trial · Cancel anytime
        </p>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Your tracking stays free whether you subscribe or not.
        </p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          <a 
            href={getTermsUrl(platform as Platform)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline"
          >
            Terms
          </a>
          {' · '}
          <a 
            href={PRIVACY_POLICY_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy
          </a>
        </p>

        {/* Status message */}
        {statusMessage && (
          <p className="text-sm text-muted-foreground mt-2 text-center">{statusMessage}</p>
        )}

        {/* Native: Restore purchases - only if logged in */}
        {isNative && isUserLoggedIn && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 gap-2 text-muted-foreground w-full"
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
