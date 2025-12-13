import { CheckIn, JournalEntry, Photo } from '@/contexts/LocalStorageContext';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';

interface CoachContext {
  tswDuration: string | null;
  recentCheckIns: {
    date: string;
    timeOfDay: string;
    mood: number;
    skinFeeling: number;
    treatments: string[];
    notes?: string;
  }[];
  weeklyAverages: {
    avgMood: number;
    avgSkin: number;
    totalCheckIns: number;
  };
  treatmentCorrelations: {
    treatment: string;
    avgSkinWhenUsed: number;
    usageCount: number;
  }[];
  moodTrend: 'improving' | 'declining' | 'stable';
  skinTrend: 'improving' | 'declining' | 'stable';
  photoCount: number;
  journalCount: number;
}

export function prepareCoachContext(
  checkIns: CheckIn[],
  journalEntries: JournalEntry[],
  photos: Photo[],
  tswStartDate: string | null
): CoachContext {
  const now = new Date();
  const last30Days = subDays(now, 30);
  const last7Days = subDays(now, 7);

  // Filter recent check-ins
  const recentCheckIns = checkIns
    .filter(c => new Date(c.timestamp) >= last30Days)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20)
    .map(c => ({
      date: format(new Date(c.timestamp), 'MMM d, yyyy'),
      timeOfDay: c.timeOfDay,
      mood: c.mood,
      skinFeeling: c.skinFeeling,
      treatments: c.treatments,
      notes: c.notes,
    }));

  // Calculate weekly averages
  const weeklyCheckIns = checkIns.filter(c => new Date(c.timestamp) >= last7Days);
  const weeklyAverages = {
    avgMood: weeklyCheckIns.length > 0 
      ? Math.round((weeklyCheckIns.reduce((sum, c) => sum + c.mood, 0) / weeklyCheckIns.length) * 10) / 10
      : 0,
    avgSkin: weeklyCheckIns.length > 0 
      ? Math.round((weeklyCheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / weeklyCheckIns.length) * 10) / 10
      : 0,
    totalCheckIns: weeklyCheckIns.length,
  };

  // Calculate treatment correlations
  const treatmentMap = new Map<string, { totalSkin: number; count: number }>();
  const monthlyCheckIns = checkIns.filter(c => new Date(c.timestamp) >= last30Days);
  
  monthlyCheckIns.forEach(c => {
    c.treatments.forEach(treatment => {
      const existing = treatmentMap.get(treatment) || { totalSkin: 0, count: 0 };
      existing.totalSkin += c.skinFeeling;
      existing.count += 1;
      treatmentMap.set(treatment, existing);
    });
  });

  const treatmentCorrelations = Array.from(treatmentMap.entries())
    .map(([treatment, data]) => ({
      treatment,
      avgSkinWhenUsed: Math.round((data.totalSkin / data.count) * 10) / 10,
      usageCount: data.count,
    }))
    .sort((a, b) => b.avgSkinWhenUsed - a.avgSkinWhenUsed);

  // Calculate trends (compare first half to second half of last 14 days)
  const last14Days = subDays(now, 14);
  const last14CheckIns = checkIns
    .filter(c => new Date(c.timestamp) >= last14Days)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let moodTrend: 'improving' | 'declining' | 'stable' = 'stable';
  let skinTrend: 'improving' | 'declining' | 'stable' = 'stable';

  if (last14CheckIns.length >= 4) {
    const midpoint = Math.floor(last14CheckIns.length / 2);
    const firstHalf = last14CheckIns.slice(0, midpoint);
    const secondHalf = last14CheckIns.slice(midpoint);

    const firstHalfMood = firstHalf.reduce((sum, c) => sum + c.mood, 0) / firstHalf.length;
    const secondHalfMood = secondHalf.reduce((sum, c) => sum + c.mood, 0) / secondHalf.length;
    const moodDiff = secondHalfMood - firstHalfMood;

    if (moodDiff > 0.3) moodTrend = 'improving';
    else if (moodDiff < -0.3) moodTrend = 'declining';

    const firstHalfSkin = firstHalf.reduce((sum, c) => sum + c.skinFeeling, 0) / firstHalf.length;
    const secondHalfSkin = secondHalf.reduce((sum, c) => sum + c.skinFeeling, 0) / secondHalf.length;
    const skinDiff = secondHalfSkin - firstHalfSkin;

    if (skinDiff > 0.3) skinTrend = 'improving';
    else if (skinDiff < -0.3) skinTrend = 'declining';
  }

  // TSW duration
  let tswDuration: string | null = null;
  if (tswStartDate) {
    const days = differenceInDays(now, new Date(tswStartDate));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    tswDuration = months > 0 ? `${months} months, ${remainingDays} days` : `${days} days`;
  }

  return {
    tswDuration,
    recentCheckIns,
    weeklyAverages,
    treatmentCorrelations,
    moodTrend,
    skinTrend,
    photoCount: photos.length,
    journalCount: journalEntries.length,
  };
}
