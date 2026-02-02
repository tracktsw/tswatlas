import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { PostSignupTrialOffer } from '@/components/PostSignupTrialOffer';

interface AuthGuardProps {
  children: React.ReactNode;
}

const STORAGE_KEY_SEEN = 'hasSeenOnboarding';
const POST_SIGNUP_OFFER_SHOWN_KEY = 'post_signup_trial_offer_shown';
const JUST_SIGNED_UP_KEY = 'just_signed_up';

const AuthGuard = ({ children }: AuthGuardProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPostSignupOffer, setShowPostSignupOffer] = useState(false);
  const navigate = useNavigate();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const redirectUnauthenticated = () => {
      const hasSeenOnboarding = localStorage.getItem(STORAGE_KEY_SEEN) === 'true';
      if (!hasSeenOnboarding) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    };

    // SINGLE auth listener - onAuthStateChange fires immediately with current session
    // No need for separate getSession() call - this eliminates the waterfall
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (!session?.user) {
          redirectUnauthenticated();
        } else {
          // Check if this is a fresh signup - show post-signup offer
          const justSignedUp = localStorage.getItem(JUST_SIGNED_UP_KEY) === 'true';
          const hasSeenOffer = localStorage.getItem(POST_SIGNUP_OFFER_SHOWN_KEY) === 'true';
          
          if (justSignedUp && !hasSeenOffer) {
            // Clear the just signed up flag and show the offer
            localStorage.removeItem(JUST_SIGNED_UP_KEY);
            setShowPostSignupOffer(true);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleOfferContinue = () => {
    localStorage.setItem(POST_SIGNUP_OFFER_SHOWN_KEY, 'true');
    setShowPostSignupOffer(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show post-signup trial offer if applicable
  if (showPostSignupOffer) {
    return <PostSignupTrialOffer onContinue={handleOfferContinue} />;
  }

  return <>{children}</>;
};

export default AuthGuard;
