/**
 * Photo Comparison Teaser
 * 
 * Shows a teaser for the photo comparison feature after free users upload 2+ photos.
 * Encourages them to start a trial to unlock the comparison feature.
 */

import { useState, useEffect } from 'react';
import { ArrowLeftRight, Sparkles, Crown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrialOfferModal } from '@/components/TrialOfferModal';

const COMPARISON_TEASER_DISMISSED_KEY = 'photo_comparison_teaser_dismissed';
const COMPARISON_TEASER_SHOWN_COUNT_KEY = 'photo_comparison_teaser_shown_count';

interface PhotoComparisonTeaserProps {
  photoCount: number;
  isPremium: boolean;
}

export const PhotoComparisonTeaser = ({ photoCount, isPremium }: PhotoComparisonTeaserProps) => {
  const [showTeaser, setShowTeaser] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);

  useEffect(() => {
    // Only show for free users with 2+ photos
    if (photoCount >= 2 && !isPremium) {
      const isDismissed = localStorage.getItem(COMPARISON_TEASER_DISMISSED_KEY);
      const shownCount = parseInt(localStorage.getItem(COMPARISON_TEASER_SHOWN_COUNT_KEY) || '0', 10);
      
      // Show up to 3 times, then stop unless user hasn't dismissed
      if (!isDismissed && shownCount < 3) {
        setShowTeaser(true);
        localStorage.setItem(COMPARISON_TEASER_SHOWN_COUNT_KEY, (shownCount + 1).toString());
      }
    } else {
      setShowTeaser(false);
    }
  }, [photoCount, isPremium]);

  if (!showTeaser || isPremium) return null;

  const handleDismiss = () => {
    setShowTeaser(false);
    localStorage.setItem(COMPARISON_TEASER_DISMISSED_KEY, 'true');
  };

  const handleUnlock = () => {
    setShowTrialModal(true);
  };

  return (
    <>
      <div className="glass-card-warm p-4 border-2 border-primary/20 relative overflow-hidden animate-slide-up">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-coral/5 pointer-events-none" />

        <div className="relative flex items-center gap-4">
          {/* Icon with comparison visual */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-coral/20 flex items-center justify-center">
              <ArrowLeftRight className="w-7 h-7 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-honey flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-display font-bold text-foreground text-sm mb-0.5">
              Compare Your Progress
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              See your healing journey with side-by-side photo comparison.
            </p>
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handleUnlock}
            >
              <Crown className="w-3.5 h-3.5" />
              Unlock with Free Trial
            </Button>
          </div>
        </div>
      </div>

      <TrialOfferModal
        open={showTrialModal}
        onOpenChange={setShowTrialModal}
        variant="photo-comparison"
      />
    </>
  );
};

export default PhotoComparisonTeaser;
