/**
 * First Check-In Celebration Modal
 * 
 * Shows after a user completes their first check-in, celebrating their progress
 * and offering a trial to unlock full insights on their data.
 */

import { useState, useEffect } from 'react';
import { TrialOfferModal } from '@/components/TrialOfferModal';

const FIRST_CHECKIN_CELEBRATION_KEY = 'first_checkin_celebration_shown';

interface FirstCheckInCelebrationProps {
  checkInCount: number;
  isPremium: boolean;
}

export const FirstCheckInCelebration = ({ checkInCount, isPremium }: FirstCheckInCelebrationProps) => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Only show after exactly 1 check-in, for free users, and only once
    if (checkInCount === 1 && !isPremium) {
      const hasShown = localStorage.getItem(FIRST_CHECKIN_CELEBRATION_KEY);
      if (!hasShown) {
        // Small delay to let the sparkles finish
        const timer = setTimeout(() => {
          setShowModal(true);
          localStorage.setItem(FIRST_CHECKIN_CELEBRATION_KEY, 'true');
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [checkInCount, isPremium]);

  if (isPremium) return null;

  return (
    <TrialOfferModal
      open={showModal}
      onOpenChange={setShowModal}
      variant="check-in-celebration"
    />
  );
};

export default FirstCheckInCelebration;
