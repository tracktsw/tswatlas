import React from 'react';
import { useOnboarding, OnboardingProvider } from '@/contexts/OnboardingContext';
import {
  OnboardingScreen1,
  OnboardingScreen2,
  OnboardingScreen3,
  OnboardingScreen4,
  OnboardingScreen5,
  OnboardingScreen6,
} from '@/components/onboarding';

const OnboardingContent: React.FC = () => {
  const { currentScreen } = useOnboarding();

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
    case 6:
      return <OnboardingScreen6 />;
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
