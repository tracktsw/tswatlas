import { CheckIn, JournalEntry, Photo, SymptomEntry } from '@/contexts/UserDataContext';
import { format, subDays, differenceInDays, eachDayOfInterval, startOfDay } from 'date-fns';

interface SymptomAnalysis {
  symptom: string;
  frequency: number;
  daysLogged: number;
  avgSeverity: number;
  severityTrend: 'worsening' | 'improving' | 'stable';
  correlatedTreatments: { treatment: string; coOccurrence: number }[];
}

interface CoachContext {
  dataQuality: {
    totalCheckIns: number;
    uniqueDaysLogged: number;
    checkInStreak: number;
    missingDaysLast7: string[];
    missingDaysLast30: string[];
    hasEnoughData: boolean;
    dataMessage: string;
  };
  tswDuration: string | null;
  last7Days: {
    checkIns: {
      date: string;
      timeOfDay: string;
      mood: number;
      skinFeeling: number;
      symptoms: SymptomEntry[];
      treatments: string[];
      notes?: string;
    }[];
    avgMood: number;
    avgSkin: number;
    symptomsSummary: SymptomAnalysis[];
    treatmentsUsed: { treatment: string; count: number }[];
  };
  last30Days: {
    checkInsCount: number;
    avgMood: number;
    avgSkin: number;
    symptomsSummary: SymptomAnalysis[];
    treatmentsUsed: { treatment: string; count: number; avgSkinWhenUsed: number }[];
  };
  trends: {
    moodTrend: 'improving' | 'declining' | 'stable';
    skinTrend: 'improving' | 'declining' | 'stable';
    symptomPatterns: {
      symptom: string;
      pattern: string;
    }[];
    treatmentCorrelations: {
      observation: string;
    }[];
  };
  photoCount: number;
  journalCount: number;
}

function analyzeSymptoms(
  checkIns: CheckIn[],
  allCheckIns: CheckIn[]
): SymptomAnalysis[] {
  const symptomData: Record<string, {
    occurrences: number;
    days: Set<string>;
    severities: number[];
    treatments: Record<string, number>;
    firstHalfSeverities: number[];
    secondHalfSeverities: number[];
  }> = {};

  const midpoint = Math.floor(checkIns.length / 2);
  
  checkIns.forEach((checkIn, index) => {
    const dateStr = format(new Date(checkIn.timestamp), 'yyyy-MM-dd');
    const symptoms = checkIn.symptomsExperienced || [];
    
    symptoms.forEach(entry => {
      if (!symptomData[entry.symptom]) {
        symptomData[entry.symptom] = {
          occurrences: 0,
          days: new Set(),
          severities: [],
          treatments: {},
          firstHalfSeverities: [],
          secondHalfSeverities: [],
        };
      }
      
      const data = symptomData[entry.symptom];
      data.occurrences += 1;
      data.days.add(dateStr);
      data.severities.push(entry.severity);
      
      if (index < midpoint) {
        data.firstHalfSeverities.push(entry.severity);
      } else {
        data.secondHalfSeverities.push(entry.severity);
      }
      
      checkIn.treatments.forEach(treatment => {
        data.treatments[treatment] = (data.treatments[treatment] || 0) + 1;
      });
    });
  });

  return Object.entries(symptomData)
    .map(([symptom, data]) => {
      const avgSeverity = data.severities.length > 0
        ? Math.round((data.severities.reduce((a, b) => a + b, 0) / data.severities.length) * 10) / 10
        : 0;
      
      let severityTrend: 'improving' | 'worsening' | 'stable' = 'stable';
      if (data.firstHalfSeverities.length >= 2 && data.secondHalfSeverities.length >= 2) {
        const firstAvg = data.firstHalfSeverities.reduce((a, b) => a + b, 0) / data.firstHalfSeverities.length;
        const secondAvg = data.secondHalfSeverities.reduce((a, b) => a + b, 0) / data.secondHalfSeverities.length;
        const diff = secondAvg - firstAvg;
        if (diff > 0.3) severityTrend = 'worsening';
        else if (diff < -0.3) severityTrend = 'improving';
      }

      const correlatedTreatments = Object.entries(data.treatments)
        .map(([treatment, count]) => ({ treatment, coOccurrence: count }))
        .sort((a, b) => b.coOccurrence - a.coOccurrence)
        .slice(0, 3);

      return {
        symptom,
        frequency: data.occurrences,
        daysLogged: data.days.size,
        avgSeverity,
        severityTrend,
        correlatedTreatments,
      };
    })
    .sort((a, b) => b.daysLogged - a.daysLogged);
}

function findSymptomPatterns(
  checkIns: CheckIn[],
  symptomsSummary: SymptomAnalysis[]
): { symptom: string; pattern: string }[] {
  const patterns: { symptom: string; pattern: string }[] = [];
  
  symptomsSummary.forEach(symptomData => {
    const { symptom, correlatedTreatments, severityTrend, avgSeverity } = symptomData;
    
    // Check for co-occurring symptoms
    const coOccurringSymptoms: Record<string, number> = {};
    checkIns.forEach(checkIn => {
      const symptoms = checkIn.symptomsExperienced || [];
      const hasThisSymptom = symptoms.some(s => s.symptom === symptom);
      if (hasThisSymptom) {
        symptoms.forEach(s => {
          if (s.symptom !== symptom) {
            coOccurringSymptoms[s.symptom] = (coOccurringSymptoms[s.symptom] || 0) + 1;
          }
        });
      }
    });

    const topCoOccurring = Object.entries(coOccurringSymptoms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    if (topCoOccurring.length > 0 && topCoOccurring[0][1] >= 3) {
      patterns.push({
        symptom,
        pattern: `${symptom} frequently appears alongside ${topCoOccurring.map(([s]) => s).join(' and ')}.`
      });
    }

    if (correlatedTreatments.length > 0 && correlatedTreatments[0].coOccurrence >= 3) {
      patterns.push({
        symptom,
        pattern: `${symptom} is often logged on days when ${correlatedTreatments[0].treatment} is used (${correlatedTreatments[0].coOccurrence} times).`
      });
    }

    if (severityTrend !== 'stable') {
      const trendWord = severityTrend === 'improving' ? 'decreasing' : 'increasing';
      patterns.push({
        symptom,
        pattern: `${symptom} severity appears to be ${trendWord} recently (avg severity: ${avgSeverity.toFixed(1)}).`
      });
    }
  });

  return patterns.slice(0, 6);
}

function findTreatmentCorrelations(
  checkIns: CheckIn[]
): { observation: string }[] {
  const observations: { observation: string }[] = [];
  
  const treatmentSkinScores: Record<string, { scores: number[]; symptomCounts: Record<string, number> }> = {};
  
  checkIns.forEach(checkIn => {
    checkIn.treatments.forEach(treatment => {
      if (!treatmentSkinScores[treatment]) {
        treatmentSkinScores[treatment] = { scores: [], symptomCounts: {} };
      }
      treatmentSkinScores[treatment].scores.push(checkIn.skinFeeling);
      
      (checkIn.symptomsExperienced || []).forEach(s => {
        treatmentSkinScores[treatment].symptomCounts[s.symptom] = 
          (treatmentSkinScores[treatment].symptomCounts[s.symptom] || 0) + 1;
      });
    });
  });

  Object.entries(treatmentSkinScores).forEach(([treatment, data]) => {
    if (data.scores.length >= 3) {
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      
      if (avgScore >= 3.5) {
        observations.push({
          observation: `Days using ${treatment} tend to have better skin ratings (avg: ${avgScore.toFixed(1)}/5).`
        });
      } else if (avgScore <= 2.5) {
        observations.push({
          observation: `Days using ${treatment} tend to have lower skin ratings (avg: ${avgScore.toFixed(1)}/5). This might indicate flare days rather than treatment ineffectiveness.`
        });
      }
    }
  });

  return observations.slice(0, 4);
}

export function prepareCoachContext(
  checkIns: CheckIn[],
  journalEntries: JournalEntry[],
  photos: Photo[],
  tswStartDate: string | null
): CoachContext {
  const now = new Date();
  const last30DaysDate = subDays(now, 30);
  const last7DaysDate = subDays(now, 7);

  // Calculate unique days with check-ins
  const allDaysWithCheckIns = new Set(
    checkIns.map(c => format(new Date(c.timestamp), 'yyyy-MM-dd'))
  );

  // Find missing days
  const last7DaysInterval = eachDayOfInterval({ start: last7DaysDate, end: now });
  const last30DaysInterval = eachDayOfInterval({ start: last30DaysDate, end: now });
  
  const missingDaysLast7 = last7DaysInterval
    .filter(d => !allDaysWithCheckIns.has(format(d, 'yyyy-MM-dd')))
    .map(d => format(d, 'MMM d'));
  
  const missingDaysLast30 = last30DaysInterval
    .filter(d => !allDaysWithCheckIns.has(format(d, 'yyyy-MM-dd')))
    .map(d => format(d, 'MMM d'));

  // Calculate check-in streak
  let streak = 0;
  for (let i = 0; i <= 30; i++) {
    const dayStr = format(subDays(now, i), 'yyyy-MM-dd');
    if (allDaysWithCheckIns.has(dayStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Filter check-ins by period
  const last7CheckIns = checkIns
    .filter(c => new Date(c.timestamp) >= last7DaysDate)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const last30CheckIns = checkIns
    .filter(c => new Date(c.timestamp) >= last30DaysDate)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Data quality assessment
  const hasEnoughData = last7CheckIns.length >= 7;
  let dataMessage = '';
  if (last7CheckIns.length === 0) {
    dataMessage = 'No check-ins in the last 7 days. I need data to provide meaningful analysis.';
  } else if (last7CheckIns.length < 4) {
    dataMessage = `Only ${last7CheckIns.length} check-ins in the last 7 days. More consistent logging will improve analysis accuracy.`;
  } else if (last7CheckIns.length < 7) {
    dataMessage = `${last7CheckIns.length} check-ins in the last 7 days. Good foundation, but daily logging would help identify more patterns.`;
  } else {
    dataMessage = 'Good data coverage for the last 7 days.';
  }

  // Last 7 days analysis
  const last7Symptoms = analyzeSymptoms(last7CheckIns, checkIns);
  const last7Treatments: Record<string, number> = {};
  last7CheckIns.forEach(c => {
    c.treatments.forEach(t => {
      last7Treatments[t] = (last7Treatments[t] || 0) + 1;
    });
  });

  // Last 30 days analysis
  const last30Symptoms = analyzeSymptoms(last30CheckIns, checkIns);
  const last30Treatments: Record<string, { count: number; skinScores: number[] }> = {};
  last30CheckIns.forEach(c => {
    c.treatments.forEach(t => {
      if (!last30Treatments[t]) {
        last30Treatments[t] = { count: 0, skinScores: [] };
      }
      last30Treatments[t].count += 1;
      last30Treatments[t].skinScores.push(c.skinFeeling);
    });
  });

  // Calculate trends
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

    const firstMood = firstHalf.reduce((sum, c) => sum + c.mood, 0) / firstHalf.length;
    const secondMood = secondHalf.reduce((sum, c) => sum + c.mood, 0) / secondHalf.length;
    if (secondMood - firstMood > 0.3) moodTrend = 'improving';
    else if (secondMood - firstMood < -0.3) moodTrend = 'declining';

    const firstSkin = firstHalf.reduce((sum, c) => sum + c.skinFeeling, 0) / firstHalf.length;
    const secondSkin = secondHalf.reduce((sum, c) => sum + c.skinFeeling, 0) / secondHalf.length;
    if (secondSkin - firstSkin > 0.3) skinTrend = 'improving';
    else if (secondSkin - firstSkin < -0.3) skinTrend = 'declining';
  }

  // Find patterns
  const symptomPatterns = findSymptomPatterns(last30CheckIns, last30Symptoms);
  const treatmentCorrelations = findTreatmentCorrelations(last30CheckIns);

  // TSW duration
  let tswDuration: string | null = null;
  if (tswStartDate) {
    const days = differenceInDays(now, new Date(tswStartDate));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    tswDuration = months > 0 ? `${months} months, ${remainingDays} days` : `${days} days`;
  }

  return {
    dataQuality: {
      totalCheckIns: checkIns.length,
      uniqueDaysLogged: allDaysWithCheckIns.size,
      checkInStreak: streak,
      missingDaysLast7,
      missingDaysLast30,
      hasEnoughData,
      dataMessage,
    },
    tswDuration,
    last7Days: {
      checkIns: last7CheckIns.map(c => ({
        date: format(new Date(c.timestamp), 'MMM d'),
        timeOfDay: c.timeOfDay,
        mood: c.mood,
        skinFeeling: c.skinFeeling,
        symptoms: c.symptomsExperienced || [],
        treatments: c.treatments,
        notes: c.notes,
      })),
      avgMood: last7CheckIns.length > 0
        ? Math.round((last7CheckIns.reduce((sum, c) => sum + c.mood, 0) / last7CheckIns.length) * 10) / 10
        : 0,
      avgSkin: last7CheckIns.length > 0
        ? Math.round((last7CheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / last7CheckIns.length) * 10) / 10
        : 0,
      symptomsSummary: last7Symptoms,
      treatmentsUsed: Object.entries(last7Treatments)
        .map(([treatment, count]) => ({ treatment, count }))
        .sort((a, b) => b.count - a.count),
    },
    last30Days: {
      checkInsCount: last30CheckIns.length,
      avgMood: last30CheckIns.length > 0
        ? Math.round((last30CheckIns.reduce((sum, c) => sum + c.mood, 0) / last30CheckIns.length) * 10) / 10
        : 0,
      avgSkin: last30CheckIns.length > 0
        ? Math.round((last30CheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / last30CheckIns.length) * 10) / 10
        : 0,
      symptomsSummary: last30Symptoms,
      treatmentsUsed: Object.entries(last30Treatments)
        .map(([treatment, data]) => ({
          treatment,
          count: data.count,
          avgSkinWhenUsed: data.skinScores.length > 0
            ? Math.round((data.skinScores.reduce((a, b) => a + b, 0) / data.skinScores.length) * 10) / 10
            : 0,
        }))
        .sort((a, b) => b.count - a.count),
    },
    trends: {
      moodTrend,
      skinTrend,
      symptomPatterns,
      treatmentCorrelations,
    },
    photoCount: photos.length,
    journalCount: journalEntries.length,
  };
}
