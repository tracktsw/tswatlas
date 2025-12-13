import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Lock, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaywallGuardProps {
  children: ReactNode;
  feature?: string;
  showBlurred?: boolean;
}

const PaywallGuard = ({ children, feature = 'This feature', showBlurred = false }: PaywallGuardProps) => {
  const { isPremium, isLoading } = useSubscription();

  const handleUpgrade = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to subscribe');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast.error('Failed to start checkout');
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout');
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
            <Button onClick={handleUpgrade} className="gap-2">
              <Crown className="w-4 h-4" />
              Upgrade to Premium
            </Button>
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
        <Button onClick={handleUpgrade} className="w-full gap-2" size="lg">
          <Crown className="w-4 h-4" />
          Get Premium - £5.99/month
        </Button>
        <p className="text-xs text-muted-foreground">
          Cancel anytime. Your data stays private.
        </p>
      </div>
    </div>
  );
};

export default PaywallGuard;
