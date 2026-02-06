import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckIn, SymptomEntry } from '@/contexts/UserDataContext';
import { format, subDays } from 'date-fns';

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
  setDemoCheckIn: (dateStr: string, checkIn: Partial<Omit<CheckIn, 'id' | 'timestamp' | 'loggedAt'>>) => void;
  getDemoCheckInsForDate: (dateStr: string) => DemoCheckIn | undefined;
  clearDemoData: () => void;
  deleteDemoCheckIn: (dateStr: string) => void;
  generateSampleData: (days?: number) => void;
  getEffectiveCheckIns: (realCheckIns: CheckIn[]) => CheckIn[];
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

// Sample data generation helpers
const symptomsList = ['Burning', 'Itching', 'Thermodysregulation', 'Flaking', 'Oozing', 'Swelling', 'Redness', 'Jerking'];
const triggersList = ['heat_sweat', 'stress', 'poor_sleep', 'shower_hard_water', 'weather_change', 'dust_pollen', 'friction_scratching'];
const treatmentsList = ['nmt', 'moisturizer', 'rlt', 'salt_bath', 'cold_compress', 'antihistamine', 'exercise', 'meditation'];
const foodsList = ['Dairy', 'Gluten', 'Eggs', 'Nuts', 'Sugar', 'Alcohol', 'Caffeine', 'Soy'];
const productsList = ['New moisturizer', 'Sunscreen', 'Cleanser', 'Serum', 'Shampoo', 'Body wash'];

const pickRandom = <T,>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

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

  const setDemoCheckIn = useCallback((dateStr: string, checkInData: Partial<Omit<CheckIn, 'id' | 'timestamp' | 'loggedAt'>>) => {
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

  // Generate sample data for marketing - supports variable days
  const generateSampleData = useCallback((days: number = 30) => {
    if (!isDemoMode || !isAdmin) return;

    const newMap = new Map<string, DemoCheckIn>();
    const today = new Date();
    
    // Create a realistic TSW healing journey pattern (30-day cycle)
    // This pattern repeats for longer periods with gradual overall improvement
    const basePattern = [
      // Days 1-7: Active flare period
      { skinBase: 1, moodBase: 2, painBase: 7, sleepBase: 2, intensity: 4 },
      { skinBase: 1, moodBase: 2, painBase: 8, sleepBase: 1, intensity: 4 },
      { skinBase: 2, moodBase: 2, painBase: 7, sleepBase: 2, intensity: 4 },
      { skinBase: 2, moodBase: 3, painBase: 6, sleepBase: 2, intensity: 3 },
      { skinBase: 2, moodBase: 2, painBase: 7, sleepBase: 2, intensity: 3 },
      { skinBase: 2, moodBase: 3, painBase: 5, sleepBase: 3, intensity: 3 },
      { skinBase: 3, moodBase: 3, painBase: 5, sleepBase: 3, intensity: 3 },
      // Days 8-14: Starting to settle
      { skinBase: 3, moodBase: 3, painBase: 4, sleepBase: 3, intensity: 2 },
      { skinBase: 3, moodBase: 4, painBase: 4, sleepBase: 4, intensity: 2 },
      { skinBase: 3, moodBase: 3, painBase: 3, sleepBase: 3, intensity: 2 },
      { skinBase: 4, moodBase: 4, painBase: 3, sleepBase: 4, intensity: 2 },
      { skinBase: 3, moodBase: 4, painBase: 2, sleepBase: 4, intensity: 2 },
      { skinBase: 4, moodBase: 4, painBase: 2, sleepBase: 4, intensity: 1 },
      { skinBase: 4, moodBase: 4, painBase: 2, sleepBase: 5, intensity: 1 },
      // Days 15-21: Small setback / mini flare
      { skinBase: 3, moodBase: 3, painBase: 4, sleepBase: 3, intensity: 2 },
      { skinBase: 2, moodBase: 2, painBase: 5, sleepBase: 2, intensity: 3 },
      { skinBase: 2, moodBase: 3, painBase: 5, sleepBase: 3, intensity: 3 },
      { skinBase: 3, moodBase: 3, painBase: 4, sleepBase: 3, intensity: 2 },
      { skinBase: 3, moodBase: 4, painBase: 3, sleepBase: 4, intensity: 2 },
      { skinBase: 4, moodBase: 4, painBase: 3, sleepBase: 4, intensity: 1 },
      { skinBase: 4, moodBase: 4, painBase: 2, sleepBase: 4, intensity: 1 },
      // Days 22-30: Recovery and calm period
      { skinBase: 4, moodBase: 4, painBase: 2, sleepBase: 4, intensity: 1 },
      { skinBase: 4, moodBase: 5, painBase: 1, sleepBase: 5, intensity: 1 },
      { skinBase: 5, moodBase: 5, painBase: 1, sleepBase: 5, intensity: 0 },
      { skinBase: 4, moodBase: 4, painBase: 2, sleepBase: 4, intensity: 1 },
      { skinBase: 5, moodBase: 5, painBase: 1, sleepBase: 5, intensity: 0 },
      { skinBase: 5, moodBase: 5, painBase: 0, sleepBase: 5, intensity: 0 },
      { skinBase: 4, moodBase: 4, painBase: 1, sleepBase: 4, intensity: 0 },
      { skinBase: 5, moodBase: 5, painBase: 0, sleepBase: 5, intensity: 0 },
      { skinBase: 5, moodBase: 5, painBase: 0, sleepBase: 5, intensity: 0 },
    ];

    for (let i = 0; i < days; i++) {
      const date = subDays(today, days - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Get pattern index (cycle through the 30-day pattern)
      const patternIndex = i % basePattern.length;
      const pattern = basePattern[patternIndex];
      
      // For longer periods, apply gradual healing trend
      // As we get closer to present day, things generally improve
      const progressFactor = days > 30 ? Math.min(i / days, 0.5) : 0;
      const healingBonus = Math.floor(progressFactor * 2); // Up to +1-2 improvement
      
      // Add some randomness
      const variance = () => Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
      
      const skinFeeling = clamp(pattern.skinBase + variance() + healingBonus, 1, 5);
      const mood = clamp(pattern.moodBase + variance() + healingBonus, 1, 5);
      const painScore = clamp(pattern.painBase + (Math.random() > 0.5 ? 1 : -1) - healingBonus, 0, 10);
      const sleepScore = clamp(pattern.sleepBase + variance() + Math.floor(healingBonus / 2), 1, 5);
      const skinIntensity = clamp(pattern.intensity - Math.floor(healingBonus / 2), 0, 4);
      
      // Generate symptoms based on intensity
      const symptomCount = skinIntensity >= 3 ? Math.floor(Math.random() * 3) + 2 : 
                           skinIntensity >= 1 ? Math.floor(Math.random() * 2) + 1 : 0;
      const symptoms: SymptomEntry[] = pickRandom(symptomsList, symptomCount).map(s => ({
        symptom: s,
        severity: (skinIntensity >= 3 ? 3 : skinIntensity >= 1 ? 2 : 1) as 1 | 2 | 3,
      }));
      
      // Triggers on bad days
      const triggerCount = skinFeeling <= 2 ? Math.floor(Math.random() * 2) + 1 : 
                           skinFeeling <= 3 ? (Math.random() > 0.5 ? 1 : 0) : 0;
      const baseTriggers = pickRandom(triggersList, triggerCount);
      
      // Add food diary entries (randomly, ~40% of days)
      const foodTriggers: string[] = [];
      if (Math.random() > 0.6) {
        const foodCount = Math.floor(Math.random() * 2) + 1;
        const foods = pickRandom(foodsList, foodCount);
        foods.forEach(f => foodTriggers.push(`food:${f}`));
      }
      
      // Add product diary entries (randomly, ~20% of days)
      const productTriggers: string[] = [];
      if (Math.random() > 0.8) {
        const product = pickRandom(productsList, 1)[0];
        productTriggers.push(`product:${product}`);
      }
      
      const triggers = [...baseTriggers, ...foodTriggers, ...productTriggers];
      
      // Treatments - more on bad days, some on good days
      const treatmentCount = skinFeeling <= 2 ? Math.floor(Math.random() * 3) + 2 :
                             skinFeeling <= 4 ? Math.floor(Math.random() * 2) + 1 :
                             Math.random() > 0.5 ? 1 : 0;
      const treatments = pickRandom(treatmentsList, treatmentCount);

      const demoCheckIn: DemoCheckIn = {
        id: `demo-${dateStr}`,
        timestamp: `${dateStr}T12:00:00.000Z`,
        loggedAt: `${dateStr}T12:00:00.000Z`, // Demo data: loggedAt matches timestamp (real-time)
        timeOfDay: 'morning',
        mood,
        skinFeeling,
        skinIntensity,
        painScore,
        sleepScore,
        symptomsExperienced: symptoms.length > 0 ? symptoms : undefined,
        triggers: triggers.length > 0 ? triggers : undefined,
        treatments,
        isDemo: true,
      };

      newMap.set(dateStr, demoCheckIn);
    }

    setDemoCheckIns(newMap);
  }, [isDemoMode, isAdmin]);

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
        loggedAt: demoCheckIn.loggedAt,
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
      generateSampleData,
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
