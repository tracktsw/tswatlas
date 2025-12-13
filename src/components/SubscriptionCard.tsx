import { Crown, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const SubscriptionCard = () => {
  const { isPremium, isAdmin, isLoading, subscriptionEnd, refreshSubscription } = useSubscription();

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

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in');
        return;
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast.error('Failed to open subscription portal');
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Portal error:', err);
      toast.error('Failed to open subscription portal');
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

  if (isPremium) {
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
            {!isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 gap-2"
                onClick={handleManageSubscription}
              >
                <ExternalLink className="w-4 h-4" />
                Manage Subscription
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
            className="mt-3 gap-2"
            onClick={handleUpgrade}
          >
            <Crown className="w-4 h-4" />
            Get Premium - £5.99/month
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCard;
