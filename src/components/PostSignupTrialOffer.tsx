/**
 * Post-Signup Trial Offer
 * 
 * Shown immediately after account creation, before the user reaches the home page.
 * This is a full-screen offer that encourages starting the free trial.
 */

import { useState, useEffect } from 'react';
import { Crown, Camera, Brain, BookOpen, BarChart3, ArrowRight, Loader2, RotateCcw, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { useSubscription } from '@/hooks/useSubscription';
import { getTermsUrl, PRIVACY_POLICY_URL, type Platform } from '@/utils/platformLinks';
import { cn } from '@/lib/utils';
import { LeafIllustration } from '@/components/illustrations';
import compassLogo from '@/assets/compass-logo.png';

const POST_SIGNUP_OFFER_KEY = 'post_signup_trial_offer_shown';

interface PostSignupTrialOfferProps {
  onContinue: () => void;
}

// All icons use sage (green) color for consistency
const premiumFeatures = [
  { icon: Camera, label: 'Unlimited Photos' },
  { icon: BarChart3, label: 'Full Insights' },
  { icon: BookOpen, label: 'Journal' },
  { icon: Brain, label: 'AI Coach' },
];

export const PostSignupTrialOffer = ({ onContinue }: PostSignupTrialOfferProps) => {
  const { isPremium, isAdmin, isLoading: isSubLoading } = useSubscription();
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
  } = usePaymentRouter();

  const [isStarting, setIsStarting] = useState(false);

  // Check if we should show this screen
  const hasSeenOffer = localStorage.getItem(POST_SIGNUP_OFFER_KEY);

  // Mark as seen immediately
  useEffect(() => {
    if (!hasSeenOffer) {
      localStorage.setItem(POST_SIGNUP_OFFER_KEY, 'true');
    }
  }, [hasSeenOffer]);

  const handleStartTrial = async () => {
    setIsStarting(true);
    
    // On native, retry offerings if not ready
    if (isNative && !isOfferingsReady) {
      await retryOfferings();
      setIsStarting(false);
      return;
    }

    // startPurchase handles platform routing:
    // - iOS → RevenueCat IAP
    // - Android → RevenueCat Google Play Billing  
    // - Web → Stripe checkout redirect
    const result = await startPurchase();
    setIsStarting(false);
    
    // On native, success means purchase completed
    // On web, success means redirect initiated (page navigates away)
    if (result.success) {
      onContinue();
    } else if (result.cancelled) {
      // User cancelled, stay on this screen
    } else if (result.error) {
      // Error already shown via toast in usePaymentRouter
      console.log('[PostSignupTrialOffer] Purchase error:', result.error);
    }
  };

  const handleRestore = async () => {
    const result = await restorePurchases();
    if (result.success && result.isPremiumNow) {
      onContinue();
    }
  };

  const handleSkip = () => {
    onContinue();
  };

  // If already premium or admin, just continue
  if (!isSubLoading && (isPremium || isAdmin)) {
    onContinue();
    return null;
  }

  const isButtonLoading = isPurchasing || isStarting;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-background via-background to-primary/5 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="decorative-blob w-64 h-64 bg-primary/20 -top-20 -right-20 fixed" />
      <div className="decorative-blob w-48 h-48 bg-honey/20 bottom-40 -left-20 fixed" />
      <LeafIllustration variant="branch" className="w-24 h-20 fixed top-20 right-2 opacity-20 pointer-events-none" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-6 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-white shadow-warm flex items-center justify-center">
            <img src={compassLogo} alt="TrackTSW" className="w-16 h-16" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Leaf className="w-5 h-5 text-sage" />
            <span className="text-sm font-semibold text-sage">Welcome to TrackTSW</span>
            <Leaf className="w-5 h-5 text-sage" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-3">
            Start Your Healing Journey
          </h1>
          <p className="text-muted-foreground">
            Try Premium free for 14 days. Track your progress with powerful tools.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3 w-full mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {premiumFeatures.map((feature) => (
            <div
              key={feature.label}
              className="glass-card-warm p-4 text-center"
            >
              <div className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center bg-sage/20">
                <feature.icon className="w-6 h-6 text-sage" />
              </div>
              <p className="text-sm font-medium text-foreground">{feature.label}</p>
            </div>
          ))}
        </div>

        {/* Premium badge */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 mb-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Crown className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">14-Day Free Trial</p>
            <p className="text-xs text-muted-foreground">Then {priceString}/month · Cancel anytime</p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="w-full space-y-3 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <Button
            variant="gold"
            size="lg"
            className="w-full gap-2 h-14 text-base"
            onClick={handleStartTrial}
            disabled={isButtonLoading}
          >
            {isButtonLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>

          {/* Status message */}
          {statusMessage && (
            <p className="text-xs text-center text-muted-foreground">{statusMessage}</p>
          )}

          {/* Skip link */}
          <button
            onClick={handleSkip}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Continue with Free Plan
          </button>

          {/* Restore purchases (native only) */}
          {isNative && isUserLoggedIn && (
            <button
              onClick={handleRestore}
              disabled={isRestoring}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
            </button>
          )}
        </div>
      </div>

      {/* Legal footer */}
      <div className="px-6 pb-8 text-center">
        <p className="text-[10px] text-muted-foreground">
          By continuing, you agree to our{' '}
          <a
            href={getTermsUrl(platform as Platform)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Terms of Use
          </a>
          {' and '}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default PostSignupTrialOffer;
