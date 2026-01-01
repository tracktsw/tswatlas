import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckIn, SymptomEntry } from '@/contexts/UserDataContext';

// Admin email that can access demo mode
const DEMO_ADMIN_EMAIL = 'haroon_7860@live.co.uk';

// Full demo check-in with all fields
interface DemoCheckIn extends Omit<CheckIn, 'id'> {
  id: string;
  isDemo: true;
}

interface DemoModeContextType {
  isDemoMode: boolean;
  isAdmin: boolean;
  demoCheckIns: Map<string, DemoCheckIn>; // dateStr -> demo check-in
  toggleDemoMode: () => void;
  setDemoCheckIn: (dateStr: string, checkIn: Partial<Omit<CheckIn, 'id' | 'timestamp'>>) => void;
  getDemoCheckInsForDate: (dateStr: string) => DemoCheckIn | undefined;
  clearDemoData: () => void;
  deleteDemoCheckIn: (dateStr: string) => void;
  getEffectiveCheckIns: (realCheckIns: CheckIn[]) => CheckIn[];
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [demoCheckIns, setDemoCheckIns] = useState<Map<string, DemoCheckIn>>(new Map());
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check if current user is the demo admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || null;
      setUserEmail(email);
      setIsAdmin(email === DEMO_ADMIN_EMAIL);
    };
    
    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const email = session?.user?.email || null;
      setUserEmail(email);
      setIsAdmin(email === DEMO_ADMIN_EMAIL);
      
      // Clear demo mode on logout
      if (event === 'SIGNED_OUT') {
        setIsDemoMode(false);
        setDemoCheckIns(new Map());
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Clear demo data on page refresh (by not persisting to localStorage)
  // Data resets automatically since it's only in memory

  const toggleDemoMode = useCallback(() => {
    if (!isAdmin) return;
    
    setIsDemoMode(prev => {
      const newValue = !prev;
      // Clear demo data when turning off
      if (!newValue) {
        setDemoCheckIns(new Map());
      }
      return newValue;
    });
  }, [isAdmin]);

  const setDemoCheckIn = useCallback((dateStr: string, checkInData: Partial<Omit<CheckIn, 'id' | 'timestamp'>>) => {
    if (!isDemoMode || !isAdmin) return;

    setDemoCheckIns(prev => {
      const newMap = new Map(prev);
      const existingDemo = newMap.get(dateStr);
      
      const demoCheckIn: DemoCheckIn = {
        id: `demo-${dateStr}`,
        timestamp: `${dateStr}T12:00:00.000Z`,
        timeOfDay: 'morning',
        treatments: [],
        mood: 3,
        skinFeeling: 3,
        ...existingDemo,
        ...checkInData,
        isDemo: true,
      };
      
      newMap.set(dateStr, demoCheckIn);
      return newMap;
    });
  }, [isDemoMode, isAdmin]);

  const deleteDemoCheckIn = useCallback((dateStr: string) => {
    if (!isDemoMode || !isAdmin) return;
    
    setDemoCheckIns(prev => {
      const newMap = new Map(prev);
      newMap.delete(dateStr);
      return newMap;
    });
  }, [isDemoMode, isAdmin]);

  const getDemoCheckInsForDate = useCallback((dateStr: string): DemoCheckIn | undefined => {
    return demoCheckIns.get(dateStr);
  }, [demoCheckIns]);

  const clearDemoData = useCallback(() => {
    setDemoCheckIns(new Map());
  }, []);

  // Merge real check-ins with demo overrides for display
  const getEffectiveCheckIns = useCallback((realCheckIns: CheckIn[]): CheckIn[] => {
    if (!isDemoMode) return realCheckIns;

    // Create a map of date -> real check-ins
    const checkInsByDate = new Map<string, CheckIn[]>();
    realCheckIns.forEach(checkIn => {
      const dateStr = checkIn.timestamp.split('T')[0];
      const existing = checkInsByDate.get(dateStr) || [];
      checkInsByDate.set(dateStr, [...existing, checkIn]);
    });

    // Apply demo overrides
    const result: CheckIn[] = [];
    const processedDates = new Set<string>();

    // First, add demo check-ins (they override or add to dates)
    demoCheckIns.forEach((demoCheckIn, dateStr) => {
      result.push({
        id: demoCheckIn.id,
        timestamp: demoCheckIn.timestamp,
        timeOfDay: demoCheckIn.timeOfDay,
        treatments: demoCheckIn.treatments,
        mood: demoCheckIn.mood,
        skinFeeling: demoCheckIn.skinFeeling,
        skinIntensity: demoCheckIn.skinIntensity,
        painScore: demoCheckIn.painScore,
        sleepScore: demoCheckIn.sleepScore,
        symptomsExperienced: demoCheckIn.symptomsExperienced,
        triggers: demoCheckIn.triggers,
        notes: demoCheckIn.notes,
      });
      processedDates.add(dateStr);
    });

    // Then add real check-ins for dates not overridden
    realCheckIns.forEach(checkIn => {
      const dateStr = checkIn.timestamp.split('T')[0];
      if (!processedDates.has(dateStr)) {
        result.push(checkIn);
      }
    });

    // Sort by timestamp descending
    return result.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [isDemoMode, demoCheckIns]);

  return (
    <DemoModeContext.Provider value={{
      isDemoMode,
      isAdmin,
      demoCheckIns,
      toggleDemoMode,
      setDemoCheckIn,
      getDemoCheckInsForDate,
      clearDemoData,
      deleteDemoCheckIn,
      getEffectiveCheckIns,
    }}>
      {children}
    </DemoModeContext.Provider>
  );
};

export const useDemoMode = () => {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
};
