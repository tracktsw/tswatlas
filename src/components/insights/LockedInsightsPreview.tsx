import { useMemo } from 'react';
import { Heart, Eye, Smile, Moon, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import ScrambledText from './ScrambledText';
import AnimatingGraph from './AnimatingGraph';
import { CheckIn } from '@/contexts/UserDataContext';

const treatments = [
  { id: 'nmt', label: 'NMT' },
  { id: 'moisturizer', label: 'Moisturizer' },
  { id: 'rlt', label: 'Red Light' },
  { id: 'salt_bath', label: 'Salt Bath' },
  { id: 'cold_compress', label: 'Cold Compress' },
  { id: 'antihistamine', label: 'Antihistamine' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'meditation', label: 'Meditation' },
];

const triggersList = [
  { id: 'heat_sweat', label: 'Heat / Sweat' },
  { id: 'cold_air', label: 'Cold Air' },
  { id: 'weather_change', label: 'Weather Change' },
  { id: 'shower_hard_water', label: 'Shower / Hard Water' },
  { id: 'dust_pollen', label: 'Dust / Pollen' },
  { id: 'stress', label: 'Stress' },
  { id: 'poor_sleep', label: 'Poor Sleep' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'spicy_food', label: 'Spicy Food' },
  { id: 'friction_scratching', label: 'Friction / Scratching' },
];

interface LockedInsightsPreviewProps {
  checkIns: CheckIn[];
}

const LockedInsightsPreview = ({ checkIns }: LockedInsightsPreviewProps) => {
  // Extract real treatment names from user's check-ins
  const topTreatments = useMemo(() => {
    const counts: Record<string, number> = {};
    checkIns.forEach(c => c.treatments.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => treatments.find(t => t.id === id)?.label || id);
  }, [checkIns]);

  // Extract real trigger names from user's check-ins
  const topTriggers = useMemo(() => {
    const counts: Record<string, number> = {};
    checkIns.forEach(c => c.triggers.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => triggersList.find(t => t.id === id)?.label || id);
  }, [checkIns]);

  // Extract real symptom names from user's check-ins
  const topSymptoms = useMemo(() => {
    const counts: Record<string, number> = {};
    checkIns.forEach(c => {
      if (c.symptomsExperienced) {
        c.symptomsExperienced.forEach(s => { counts[s.symptom] = (counts[s.symptom] || 0) + 1; });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
  }, [checkIns]);

  // Fallbacks if user has no data yet
  const treatmentLabels = topTreatments.length > 0 ? topTreatments : ['Treatment A', 'Treatment B', 'Treatment C'];
  const triggerLabels = topTriggers.length > 0 ? topTriggers : ['Trigger 1', 'Trigger 2', 'Trigger 3'];
  const symptomLabels = topSymptoms.length > 0 ? topSymptoms : ['Itching', 'Redness', 'Dryness'];

  return (
    <div className="space-y-6 pointer-events-none select-none">
      {/* What's Helping */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Heart className="w-4 h-4 text-primary" />
          </div>
          What's Helping
        </h3>
        <div className="space-y-3">
          {treatmentLabels.map((label, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex items-center gap-2">
                <ScrambledText length={3} className="text-sm text-primary font-semibold" />
                <span className="text-xs text-muted-foreground">% good ·</span>
                <ScrambledText length={2} className="text-xs text-muted-foreground" />
                <span className="text-xs text-muted-foreground">uses</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trigger Patterns */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-coral/20">
            <Eye className="w-4 h-4 text-coral" />
          </div>
          Patterns We're Watching
        </h3>
        <div className="space-y-3">
          {triggerLabels.map((label, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-coral" />
                <span className="text-sm text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-1">
                <ScrambledText length={3} className="text-sm text-coral font-semibold" />
                <span className="text-xs text-muted-foreground">% worse</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Symptoms */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-honey/20">
            <Activity className="w-4 h-4 text-honey" />
          </div>
          Symptoms Insights
        </h3>
        <div className="space-y-2">
          {symptomLabels.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{s}</span>
              <ScrambledText length={4} className="text-sm font-semibold text-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* Mood Trends */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Smile className="w-4 h-4 text-primary" />
          </div>
          Mood Trends
        </h3>
        <AnimatingGraph points={21} min={1} max={5} color="#22c55e" height={130} />
      </div>

      {/* Sleep Trends */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20">
            <Moon className="w-4 h-4 text-indigo-500" />
          </div>
          Sleep Trends
        </h3>
        <AnimatingGraph points={21} min={1} max={5} color="#6366f1" height={130} />
      </div>

      {/* Pain Trends */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-coral/20">
            <TrendingUp className="w-4 h-4 text-coral" />
          </div>
          Pain Trends
        </h3>
        <AnimatingGraph points={21} min={0} max={10} color="#ef4444" height={130} />
      </div>
    </div>
  );
};

export default LockedInsightsPreview;
