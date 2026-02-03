import { ReactNode, useState, useEffect, useRef } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { Lock, AlertTriangle, Loader2, RotateCcw, LucideIcon, CheckCircle } from 'lucide-react';
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

  // Pattern discovery bullet points
  const patternBullets = [
    "What commonly precedes your flares",
    "What's linked to longer vs shorter flares",
    "What others often wish they'd stopped earlier",
  ];

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

  // Full paywall screen - new conversion-focused copy
  return (
    <div className="flex flex-col items-center justify-center py-12 px-5 text-center max-w-md mx-auto">
      {/* Icon */}
      <div className="w-14 h-14 mb-5 rounded-full bg-coral/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-coral" />
      </div>
      
      {/* Headline - emotionally strong */}
      <h2 className="font-display text-2xl font-bold text-foreground mb-3 leading-tight">
        Your last flare may not have been random
      </h2>
      
      {/* Subheadline */}
      <p className="text-muted-foreground mb-6 leading-relaxed">
        We look for patterns in your check-ins—and compare them with what others commonly report—to help you spot what may be making things worse.
      </p>
      
      {/* Bullet points - concrete outcomes */}
      <div className="w-full space-y-3 mb-6 text-left">
        {patternBullets.map((bullet, index) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <span className="text-sm text-foreground">{bullet}</span>
          </div>
        ))}
      </div>
      
      <div className="space-y-3 w-full">
        {/* CTA Button with price */}
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
              Start 14-Day Free Trial – {priceString}/month
            </>
          )}
        </Button>
        
        {/* Reassurance text */}
        <div className="space-y-1 pt-1">
          <p className="text-xs text-muted-foreground">
            {priceString}/month after free trial · Cancel anytime
          </p>
          <p className="text-xs text-muted-foreground">
            Your tracking stays free either way.
          </p>
        </div>
        
        <p className="text-xs text-muted-foreground pt-1">
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
