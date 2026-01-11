import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface AuthGuardProps {
  children: React.ReactNode;
}

const STORAGE_KEY_SEEN = 'hasSeenOnboarding';

const AuthGuard = ({ children }: AuthGuardProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

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

  return <>{children}</>;
};

export default AuthGuard;
