import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface OnboardingData {
  tswDuration: string | null;
  goal: string | null;
  initialSeverity: number | null;
  firstLog: {
    skin: number;
    sleep: number;
    pain: number;
    mood: number;
    triggers: string;
  } | null;
}

interface OnboardingContextValue {
  // State
  currentScreen: number;
  totalScreens: number;
  data: OnboardingData;
  hasSeenOnboarding: boolean;
  
  // Navigation
  goToScreen: (screen: number) => void;
  nextScreen: () => void;
  prevScreen: () => void;
  
  // Data updates
  setTswDuration: (duration: string) => void;
  setGoal: (goal: string) => void;
  setInitialSeverity: (severity: number) => void;
  setFirstLog: (log: OnboardingData['firstLog']) => void;
  
  // Flow control
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  getOnboardingData: () => OnboardingData | null;
  clearOnboardingData: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const STORAGE_KEY_SEEN = 'hasSeenOnboarding';
const STORAGE_KEY_DATA = 'onboardingData';

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_SEEN) === 'true';
  });
  
  const [data, setData] = useState<OnboardingData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_DATA);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {
          tswDuration: null,
          goal: null,
          initialSeverity: null,
          firstLog: null,
        };
      }
    }
    return {
      tswDuration: null,
      goal: null,
      initialSeverity: null,
      firstLog: null,
    };
  });

  const totalScreens = 6;

  // Persist data changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
  }, [data]);

  const goToScreen = useCallback((screen: number) => {
    if (screen >= 1 && screen <= totalScreens) {
      setCurrentScreen(screen);
    }
  }, []);

  const nextScreen = useCallback(() => {
    if (currentScreen < totalScreens) {
      setCurrentScreen(prev => prev + 1);
    }
  }, [currentScreen]);

  const prevScreen = useCallback(() => {
    if (currentScreen > 1) {
      setCurrentScreen(prev => prev - 1);
    }
  }, [currentScreen]);

  const setTswDuration = useCallback((duration: string) => {
    setData(prev => ({ ...prev, tswDuration: duration }));
  }, []);

  const setGoal = useCallback((goal: string) => {
    setData(prev => ({ ...prev, goal }));
  }, []);

  const setInitialSeverity = useCallback((severity: number) => {
    setData(prev => ({ ...prev, initialSeverity: severity }));
  }, []);

  const setFirstLog = useCallback((log: OnboardingData['firstLog']) => {
    setData(prev => ({ ...prev, firstLog: log }));
  }, []);

  const skipOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_SEEN, 'true');
    setHasSeenOnboarding(true);
  }, []);

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_SEEN, 'true');
    setHasSeenOnboarding(true);
  }, []);

  const getOnboardingData = useCallback((): OnboardingData | null => {
    const stored = localStorage.getItem(STORAGE_KEY_DATA);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const clearOnboardingData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_DATA);
    setData({
      tswDuration: null,
      goal: null,
      initialSeverity: null,
      firstLog: null,
    });
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        currentScreen,
        totalScreens,
        data,
        hasSeenOnboarding,
        goToScreen,
        nextScreen,
        prevScreen,
        setTswDuration,
        setGoal,
        setInitialSeverity,
        setFirstLog,
        skipOnboarding,
        completeOnboarding,
        getOnboardingData,
        clearOnboardingData,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
