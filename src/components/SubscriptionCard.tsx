import { useState } from 'react';
import { Crown, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Capacitor } from '@capacitor/core';

const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/fZudR12RBaH1cEveGH1gs01';

const SubscriptionCard = () => {
  const { isPremium, isAdmin, isLoading, subscriptionEnd, refreshSubscription } = useSubscription();
  const { isIOSNative, isLoading: isRevenueCatLoading, purchaseMonthly, restorePurchases, getPriceString } = useRevenueCatContext();
  
  // Double-click protection: track in-flight requests
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleUpgrade = async () => {
    // Guard against double-clicks
    if (isCheckoutLoading) {
      console.log('[UPGRADE] Blocked - request already in flight');
      return;
    }

    // Debug platform detection
    console.log('[UPGRADE] Platform detection:', {
      isIOSNative,
      isNativePlatform: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform()
    });

    setIsCheckoutLoading(true);

    try {
      // iOS Native: Use RevenueCat IAP
      if (isIOSNative) {
        console.log('[UPGRADE] iOS Native - using RevenueCat');
        const success = await purchaseMonthly();
        
        if (success) {
          console.log('[UPGRADE] RevenueCat purchase completed, refreshing subscription...');
          toast.success('Purchase successful! Activating your subscription...');
          // Refresh subscription status from backend
          await refreshSubscription();
        } else {
          console.log('[UPGRADE] RevenueCat purchase cancelled or failed');
        }
        setIsCheckoutLoading(false);
        return;
      }

      // Web: Use Stripe Payment Link
      console.log('[UPGRADE] Web - using Stripe Payment Link');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        console.error('[UPGRADE] CheckoutError - No auth session or email');
        toast.error('Please sign in to subscribe');
        setIsCheckoutLoading(false);
        return;
      }

      // Redirect to Stripe Payment Link with prefilled email
      const paymentUrl = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(session.user.email)}`;
      console.log('[UPGRADE] Redirecting to Payment Link...');
      window.location.assign(paymentUrl);
      // Note: isCheckoutLoading stays true as we're navigating away
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[UPGRADE] CheckoutError - Exception:', errorMessage);
      toast.error('Checkout couldn\'t start. Please try again.');
      setIsCheckoutLoading(false);
    }
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    
    setIsRestoring(true);
    console.log('[RESTORE] Starting restore purchases...');
    
    try {
      const success = await restorePurchases();
      
      if (success) {
        console.log('[RESTORE] Restore successful, refreshing subscription...');
        toast.success('Purchases restored! Activating your subscription...');
        await refreshSubscription();
      } else {
        console.log('[RESTORE] No purchases to restore');
        toast.info('No previous purchases found');
      }
    } catch (err) {
      console.error('[RESTORE] Error:', err);
      toast.error('Failed to restore purchases');
    }
    
    setIsRestoring(false);
  };

  const handleManageSubscription = async () => {
    // Guard against double-clicks
    if (isPortalLoading) {
      console.log('[PORTAL] Blocked - request already in flight');
      return;
    }

    setIsPortalLoading(true);

    try {
      console.log('[PORTAL] PortalStart - Getting session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('[PORTAL] PortalError - No auth session');
        toast.error('Please sign in');
        setIsPortalLoading(false);
        return;
      }

      console.log('[PORTAL] PortalStart - Invoking customer-portal function...', { userId: session.user.id });

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('[PORTAL] PortalResponse', { 
        status: error ? 'error' : 'success',
        hasUrl: !!data?.url,
        error: error?.message || data?.error || null
      });

      if (error) {
        console.error('[PORTAL] PortalError - Function error:', error);
        toast.error('Failed to open subscription portal. Please try again.');
        setIsPortalLoading(false);
        return;
      }

      if (data?.error) {
        // Check for specific "no customer" error
        if (data.error.includes('No Stripe customer') || data.error === 'no_customer') {
          console.log('[PORTAL] PortalError - No Stripe customer found');
          toast.error('No active subscription found. Please upgrade first.');
        } else {
          console.error('[PORTAL] PortalError - API error:', data.error);
          toast.error('Failed to open subscription portal. Please try again.');
        }
        setIsPortalLoading(false);
        return;
      }

      if (data?.url) {
        console.log('[PORTAL] PortalRedirect', { url: data.url.substring(0, 50) + '...' });
        // Use window.location.assign for same-tab navigation (iOS/PWA compatible)
        window.location.assign(data.url);
        // Note: isPortalLoading stays true as we're navigating away
      } else {
        console.error('[PORTAL] PortalError - No URL in response');
        toast.error('Failed to open subscription portal. Please try again.');
        setIsPortalLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[PORTAL] PortalError - Exception:', errorMessage);
      toast.error('Failed to open subscription portal. Please try again.');
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
            {/* Show Manage Subscription only for web users (Stripe) */}
            {!isAdmin && !isIOSNative && (
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
                  <>
                    Manage Subscription
                  </>
                )}
              </Button>
            )}
            {/* iOS users manage via App Store */}
            {!isAdmin && isIOSNative && (
              <p className="text-xs text-muted-foreground mt-3">
                Manage your subscription in the App Store
              </p>
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

  // Get price string - from RevenueCat on iOS, fallback for web
  const priceString = isIOSNative ? getPriceString() : '£5.99';
  const isButtonLoading = isCheckoutLoading || isRevenueCatLoading;

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
                {isIOSNative ? 'Processing...' : 'Starting checkout...'}
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
          
          {/* Restore purchases button - iOS only */}
          {isIOSNative && (
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
};

export default SubscriptionCard;
