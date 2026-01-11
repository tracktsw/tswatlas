import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding, OnboardingProvider } from '@/contexts/OnboardingContext';
import { usePlatform } from '@/hooks/usePlatform';
import {
  OnboardingScreen1,
  OnboardingScreen2,
  OnboardingScreen3,
  OnboardingScreen4,
  OnboardingScreen5,
} from '@/components/onboarding';

const OnboardingContent: React.FC = () => {
  const { currentScreen } = useOnboarding();
  const { isNative } = usePlatform();
  const navigate = useNavigate();

  // Redirect web users to auth page - onboarding is mobile-only
  useEffect(() => {
    if (!isNative) {
      navigate('/auth', { replace: true });
    }
  }, [isNative, navigate]);

  // Don't render anything for web users while redirecting
  if (!isNative) {
    return <div className="min-h-screen bg-background" />;
  }

  switch (currentScreen) {
    case 1:
      return <OnboardingScreen1 />;
    case 2:
      return <OnboardingScreen2 />;
    case 3:
      return <OnboardingScreen3 />;
    case 4:
      return <OnboardingScreen4 />;
    case 5:
      return <OnboardingScreen5 />;
    default:
      return <OnboardingScreen1 />;
  }
};

const OnboardingPage: React.FC = () => {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
};

export default OnboardingPage;
