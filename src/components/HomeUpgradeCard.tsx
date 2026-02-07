/**
 * Home Upgrade Card
 * 
 * A prominent upgrade card shown on the Home page for free users.
 * Highlights premium benefits and encourages starting the free trial.
 */

import { useState } from 'react';
import { Crown, Camera, BarChart3, ArrowRight } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { TrialOfferModal } from '@/components/TrialOfferModal';

export const HomeUpgradeCard = () => {
  const { isPremium, isAdmin, isLoading } = useSubscription();
  const { isTrialEligible, isTrialEligibilityPending, priceString } = usePaymentRouter();
  const [showTrialModal, setShowTrialModal] = useState(false);

  // Don't show for premium users or admins
  // Also wait for trial eligibility to be determined to avoid text flash
  if (isLoading || isPremium || isAdmin || isTrialEligibilityPending) {
    return null;
  }

  return (
    <>
      <div 
        className="glass-card-warm p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-slide-up relative overflow-hidden"
        onClick={() => setShowTrialModal(true)}
        style={{ animationDelay: '0.3s' }}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-honey/10 pointer-events-none" />
        
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-coral flex items-center justify-center shrink-0 shadow-warm">
            <Crown className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-bold text-foreground">
                {isTrialEligible ? 'Try Premium Free' : 'Unlock Premium'}
              </h3>
              {isTrialEligible && (
                <span className="text-xs bg-honey/20 text-honey-foreground px-2 py-0.5 rounded-full font-medium">
                  14 days
                </span>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {isTrialEligible 
                ? 'Unlock AI Coach, Photo Diary, full Insights & more.'
                : `Get AI Coach, Photo Diary & Insights for ${priceString}/month.`}
            </p>
            
            {/* Mini feature icons */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Camera className="w-3.5 h-3.5 text-sage" />
                <span>Photos</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart3 className="w-3.5 h-3.5 text-sage" />
                <span>Insights</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <span>+ more</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <TrialOfferModal
        open={showTrialModal}
        onOpenChange={setShowTrialModal}
        variant="default"
      />
    </>
  );
};

export default HomeUpgradeCard;
