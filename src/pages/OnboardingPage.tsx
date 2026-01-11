import React from 'react';
import { useOnboarding, OnboardingProvider } from '@/contexts/OnboardingContext';
import {
  OnboardingScreen1,
  OnboardingScreen2,
  OnboardingScreen3,
  OnboardingScreen4,
  OnboardingScreen5,
} from '@/components/onboarding';

const OnboardingContent: React.FC = () => {
  const { currentScreen } = useOnboarding();

  // Render based on current screen - no platform check here
  // The navigation itself will handle redirecting to /auth
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
