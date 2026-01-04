import { ReactNode, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSubscription } from '@/hooks/useSubscription';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { Lock, Sparkles, Crown, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaywallGuardProps {
  children: ReactNode;
  feature?: string;
  showBlurred?: boolean;
}

const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/fZudR12RBaH1cEveGH1gs01';

const PaywallGuard = ({ children, feature = 'This feature', showBlurred = false }: PaywallGuardProps) => {
  const { isPremium, isLoading, refreshSubscription } = useSubscription();
  const { isLoading: isRevenueCatLoading, purchaseMonthly, restorePurchases, getPriceString } = useRevenueCatContext();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Check platform at runtime - CRITICAL for correct IAP routing
  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  const handleUpgrade = async () => {
    if (isUpgrading) return;
    
    console.log('[PaywallGuard] Platform check:', {
      isNativeIOS,
      isNativePlatform: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform()
    });
    
    setIsUpgrading(true);

    try {
      // iOS Native: Use RevenueCat IAP - Stripe must NEVER open
      if (isNativeIOS) {
        console.log('[PaywallGuard] iOS Native - using RevenueCat');
        const result = await purchaseMonthly();
        
        if (result.success) {
          console.log('[PaywallGuard] RevenueCat purchase completed, refreshing subscription...');
          toast.success('Purchase successful! Activating your subscription...');
          await refreshSubscription();
        } else if (result.error) {
          console.error('[PaywallGuard] RevenueCat error:', result.error, 'code:', result.errorCode);
          toast.error(result.error);
        }
        // No toast for user cancellation (when error is undefined but success is false)
        
        setIsUpgrading(false);
        return;
      }

      // Web: Use Stripe Payment Link
      console.log('[PaywallGuard] Starting checkout...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        console.error('[PaywallGuard] No auth session or email');
        toast.error('Please sign in to subscribe');
        setIsUpgrading(false);
        return;
      }

      // Redirect to Stripe Payment Link with prefilled email
      const paymentUrl = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(session.user.email)}`;
      console.log('[PaywallGuard] Redirecting to Payment Link...');
      window.location.assign(paymentUrl);
      // Note: isUpgrading stays true as we're navigating away
    } catch (err) {
      console.error('[PaywallGuard] Checkout error:', err);
      toast.error('Failed to start checkout');
      setIsUpgrading(false);
    }
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    
    setIsRestoring(true);
    console.log('[PaywallGuard] Starting restore purchases...');
    
    try {
      const success = await restorePurchases();
      
      if (success) {
        console.log('[PaywallGuard] Restore successful, refreshing subscription...');
        toast.success('Purchases restored! Activating your subscription...');
        await refreshSubscription();
      } else {
        console.log('[PaywallGuard] No purchases to restore');
        toast.info('No previous purchases found');
      }
    } catch (err) {
      console.error('[PaywallGuard] Restore error:', err);
      toast.error('Failed to restore purchases');
    }
    
    setIsRestoring(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  // Get price string - from RevenueCat on iOS, fallback for web
  const priceString = isNativeIOS ? getPriceString() : '£5.99';
  const isButtonLoading = isUpgrading || isRevenueCatLoading;

  // Show blurred content with overlay
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
            <Button onClick={handleUpgrade} disabled={isButtonLoading} variant="gold" className="gap-2">
              {isButtonLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isNativeIOS ? 'Processing...' : 'Loading...'}
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
            {/* Restore purchases - iOS only */}
            {isNativeIOS && (
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
                    Restoring...
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
        <Button onClick={handleUpgrade} disabled={isButtonLoading} variant="gold" className="w-full gap-2" size="lg">
          {isButtonLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isNativeIOS ? 'Processing...' : 'Loading...'}
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
        {/* Restore purchases - iOS only */}
        {isNativeIOS && (
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
                Restoring...
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
