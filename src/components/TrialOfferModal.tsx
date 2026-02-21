/**
 * Trial Offer Modal
 * 
 * A beautiful, persuasive modal that encourages users to start their free trial.
 * Used in multiple contexts:
 * - Post-signup (before reaching home page)
 * - After first check-in celebration
 * - Photo comparison teaser
 * - Home page upgrade card click
 */

import { useState } from 'react';
import { Crown, Camera, Brain, BookOpen, BarChart3, X, Loader2, RotateCcw, CheckCircle2, Leaf } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { getTermsUrl, PRIVACY_POLICY_URL, type Platform } from '@/utils/platformLinks';
import { cn } from '@/lib/utils';

interface TrialOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: 'post-signup' | 'check-in-celebration' | 'photo-comparison' | 'default';
  title?: string;
  subtitle?: string;
}

const premiumFeatures = [
  { icon: Camera, label: 'Unlimited Photo Diary', description: 'Track your skin progress' },
  { icon: BarChart3, label: 'Full Insights', description: 'See what helps you heal' },
  { icon: BookOpen, label: 'Journal', description: 'Document your journey' },
  { icon: Brain, label: 'TrackTSW Coach', description: 'Personalized guidance' },
];

export const TrialOfferModal = ({
  open,
  onOpenChange,
  variant = 'default',
  title,
  subtitle,
}: TrialOfferModalProps) => {
  const {
    platform,
    isNative,
    isPurchasing,
    isRestoring,
    statusMessage,
    isOfferingsReady,
    priceString,
    isTrialEligible,
    startPurchase,
    restorePurchases,
    retryOfferings,
    isUserLoggedIn,
  } = usePaymentRouter();

  const [showThankYou, setShowThankYou] = useState(false);

  const getTitle = () => {
    if (title) return title;
    switch (variant) {
      case 'post-signup':
        return '🎉 Welcome to TrackTSW!';
      case 'check-in-celebration':
        return '🌟 Great First Check-in!';
      case 'photo-comparison':
        return '📸 See Your Progress';
      default:
        return isTrialEligible ? 'Try Premium Free' : 'Unlock Premium';
    }
  };

  const getSubtitle = () => {
    if (subtitle) return subtitle;
    switch (variant) {
      case 'post-signup':
        return isTrialEligible 
          ? 'Start your healing journey with a 14-day free trial of all premium features.'
          : `Unlock all premium features for just ${priceString}/month.`;
      case 'check-in-celebration':
        return isTrialEligible
          ? "You've taken the first step! Unlock powerful insights to understand your patterns."
          : `You've taken the first step! Unlock insights for ${priceString}/month.`;
      case 'photo-comparison':
        return isTrialEligible
          ? 'Compare photos side-by-side to visualize your healing progress over time.'
          : `Compare photos side-by-side for ${priceString}/month.`;
      default:
        return isTrialEligible
          ? 'Get unlimited access to all features with a 14-day free trial.'
          : `Get unlimited access to all features for ${priceString}/month.`;
    }
  };

  const handleStartTrial = async () => {
    // On native, check if user is logged in first
    if (isNative && !isUserLoggedIn) {
      return;
    }

    // On native, retry offerings if not ready
    if (isNative && !isOfferingsReady) {
      await retryOfferings();
      return;
    }

    const result = await startPurchase();
    if (result.success) {
      setShowThankYou(true);
      setTimeout(() => {
        onOpenChange(false);
        setShowThankYou(false);
      }, 2000);
    }
  };

  const handleRestore = async () => {
    if (!isNative) return;
    const result = await restorePurchases();
    if (result.success && result.isPremiumNow) {
      onOpenChange(false);
    }
  };

  const handleMaybeLater = () => {
    onOpenChange(false);
  };

  const isButtonLoading = isPurchasing;

  if (showThankYou) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Welcome to Premium!</h2>
            <p className="text-muted-foreground">Your trial has started. Enjoy all features!</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden max-h-[90dvh] overflow-y-auto">
        {/* Hero section with gradient */}
        <div className="bg-gradient-to-br from-primary/20 via-coral/10 to-honey/20 p-6 pb-4">
          <DialogHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-coral flex items-center justify-center shadow-lg">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <DialogTitle className="font-display text-2xl font-bold text-foreground pt-2">
              {getTitle()}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {getSubtitle()}
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 pt-4 space-y-5">
          {/* Features list */}
          <div className="space-y-3">
            {premiumFeatures.map((feature) => (
              <div key={feature.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trial badge - only show if eligible */}
          {isTrialEligible && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Leaf className="w-4 h-4 text-sage" />
              <span className="text-sm font-semibold text-foreground">14-Day Free Trial</span>
              <Leaf className="w-4 h-4 text-sage" />
            </div>
          )}

          {/* CTA Button */}
          <Button
            variant="gold"
            size="lg"
            className="w-full gap-2"
            onClick={handleStartTrial}
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
                  ? `Start Free Trial · Then ${priceString}/month`
                  : `Subscribe – ${priceString}/month`}
              </>
            )}
          </Button>

          {/* Status message */}
          {statusMessage && (
            <p className="text-xs text-center text-muted-foreground">{statusMessage}</p>
          )}

          {/* Maybe later link */}
          <button
            onClick={handleMaybeLater}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Maybe later
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

          {/* Legal links */}
          <p className="text-[10px] text-center text-muted-foreground">
            {isTrialEligible 
              ? `${priceString}/month after trial. Cancel anytime.`
              : `${priceString}/month. Cancel anytime.`}{' '}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialOfferModal;
