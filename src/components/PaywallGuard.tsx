import { ReactNode, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Lock, Sparkles, Crown, Loader2 } from 'lucide-react';
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
  const { isPremium, isLoading } = useSubscription();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (isUpgrading) return;
    setIsUpgrading(true);

    try {
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
            <Button onClick={handleUpgrade} disabled={isUpgrading} variant="gold" className="gap-2">
              {isUpgrading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  Start 30-day free trial
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              £5.99/month after · Cancel anytime
            </p>
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
        <Button onClick={handleUpgrade} disabled={isUpgrading} variant="gold" className="w-full gap-2" size="lg">
          {isUpgrading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Crown className="w-4 h-4" />
              Start 30-day free trial
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          £5.99/month after · Cancel anytime
        </p>
      </div>
    </div>
  );
};

export default PaywallGuard;
