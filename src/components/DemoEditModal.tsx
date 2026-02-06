import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useUserData, SymptomEntry } from '@/contexts/UserDataContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { severityColors, severityLabels } from '@/constants/severityColors';

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];
const moodLabels = ['Very Low', 'Low', 'Okay', 'Good', 'Great'];
const skinLabels = ['Severe', 'Bad', 'Moderate', 'Mild', 'Clear'];
const skinIntensityLabels = ['Calm', 'Settling', 'Noticeable', 'Active', 'High-intensity'];
const sleepLabels = ['Very poor', 'Poor', 'Okay', 'Good', 'Very good'];
const sleepEmojis = ['😫', '😩', '😐', '🙂', '😴'];

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
  { id: 'detergent', label: 'Detergent' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'new_product', label: 'New Product' },
  { id: 'pets', label: 'Pets' },
  { id: 'stress', label: 'Stress' },
  { id: 'poor_sleep', label: 'Poor Sleep' },
  { id: 'hormonal_changes', label: 'Hormonal Changes' },
  { id: 'illness_infection', label: 'Illness / Infection' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'spicy_food', label: 'Spicy Food' },
  { id: 'food', label: 'Food' },
  { id: 'friction_scratching', label: 'Friction / Scratching' },
];

const symptomsList = [
  'Burning', 'Itching', 'Thermodysregulation', 'Flaking',
  'Oozing', 'Swelling', 'Redness', 'Jerking'
];

interface DemoEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  existingMood?: number;
  existingSkin?: number;
}

const DemoEditModal = ({ open, onOpenChange, date, existingMood, existingSkin }: DemoEditModalProps) => {
  const { setDemoCheckIn, getDemoCheckInsForDate, deleteDemoCheckIn, demoCheckIns } = useDemoMode();
  const { customTreatments } = useUserData();
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Check for existing demo data
  const existingDemo = getDemoCheckInsForDate(dateStr);
  const hasDemoData = demoCheckIns.has(dateStr);
  
  // State for all check-in fields
  const [mood, setMood] = useState(3);
  const [skinFeeling, setSkinFeeling] = useState(3);
  const [skinIntensity, setSkinIntensity] = useState<number | undefined>(undefined);
  const [painScore, setPainScore] = useState<number | undefined>(undefined);
  const [sleepScore, setSleepScore] = useState<number | undefined>(undefined);
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomEntry[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Reset values when modal opens with new date
  useEffect(() => {
    if (open) {
      const demo = getDemoCheckInsForDate(dateStr);
      setMood(demo?.mood || existingMood || 3);
      setSkinFeeling(demo?.skinFeeling || existingSkin || 3);
      setSkinIntensity(demo?.skinIntensity);
      setPainScore(demo?.painScore);
      setSleepScore(demo?.sleepScore);
      setSelectedSymptoms(demo?.symptomsExperienced || []);
      setSelectedTriggers(demo?.triggers || []);
      setSelectedTreatments(demo?.treatments || []);
      setNotes(demo?.notes || '');
    }
  }, [open, dateStr, existingMood, existingSkin, getDemoCheckInsForDate]);

  const toggleTreatment = (id: string) => {
    setSelectedTreatments(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleTrigger = (id: string) => {
    setSelectedTriggers(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => {
      const existing = prev.find(s => s.symptom === symptom);
      if (existing) {
        return prev.filter(s => s.symptom !== symptom);
      }
      return [...prev, { symptom, severity: 2 as const }];
    });
  };

  const updateSymptomSeverity = (symptom: string, severity: 1 | 2 | 3) => {
    setSelectedSymptoms(prev =>
      prev.map(s => (s.symptom === symptom ? { ...s, severity } : s))
    );
  };

  const isSymptomSelected = (symptom: string) => selectedSymptoms.some(s => s.symptom === symptom);
  const getSymptomSeverity = (symptom: string): 1 | 2 | 3 => {
    const entry = selectedSymptoms.find(s => s.symptom === symptom);
    return entry?.severity || 2;
  };

  const handleSave = () => {
    setDemoCheckIn(dateStr, {
      mood,
      skinFeeling,
      skinIntensity,
      painScore,
      sleepScore,
      symptomsExperienced: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
      triggers: selectedTriggers.length > 0 ? selectedTriggers : undefined,
      treatments: selectedTreatments,
      notes: notes || undefined,
      timeOfDay: 'morning',
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteDemoCheckIn(dateStr);
    onOpenChange(false);
  };

  const allTreatments = [...treatments, ...customTreatments.map(t => ({ id: t, label: t }))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Edit Demo Data
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Mood Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Mood</label>
              <span className="text-2xl">{moodEmojis[mood - 1]}</span>
            </div>
            <Slider
              value={[mood]}
              onValueChange={([val]) => setMood(val)}
              min={1}
              max={5}
              step={1}
              className="py-2"
            />
            <p className="text-xs text-center text-muted-foreground">
              {moodLabels[mood - 1]}
            </p>
          </div>

          {/* Skin Feeling Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Skin Feeling</label>
              <span className="text-2xl">{skinEmojis[skinFeeling - 1]}</span>
            </div>
            <Slider
              value={[skinFeeling]}
              onValueChange={([val]) => setSkinFeeling(val)}
              min={1}
              max={5}
              step={1}
              className="py-2"
            />
            <p className="text-xs text-center text-muted-foreground">
              {skinLabels[skinFeeling - 1]}
            </p>
          </div>

          {/* Skin Intensity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Skin Intensity</label>
              <span className="text-xs text-muted-foreground">
                {skinIntensity !== undefined ? skinIntensityLabels[skinIntensity] : 'Not set'}
              </span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((val) => (
                <button
                  key={val}
                  onClick={() => setSkinIntensity(skinIntensity === val ? undefined : val)}
                  className={cn(
                    'flex-1 py-2 px-1 text-xs rounded-lg transition-all',
                    skinIntensity === val 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {skinIntensityLabels[val].slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          {/* Pain Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Pain Score (0-10)</label>
              <span className="text-sm font-semibold">
                {painScore !== undefined ? `${painScore}/10` : 'Not set'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <button
                  key={val}
                  onClick={() => setPainScore(painScore === val ? undefined : val)}
                  className={cn(
                    'w-8 h-8 text-xs font-medium rounded-lg transition-all',
                    painScore === val 
                      ? cn(
                          'text-white',
                          val <= 2 ? 'bg-yellow-500' :
                          val <= 4 ? 'bg-amber-500' :
                          val <= 6 ? 'bg-orange-500' :
                          val <= 8 ? 'bg-red-500' :
                          'bg-red-700'
                        )
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Sleep Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Sleep Quality</label>
              <span className="text-lg">
                {sleepScore !== undefined ? sleepEmojis[sleepScore - 1] : '—'}
              </span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  onClick={() => setSleepScore(sleepScore === val ? undefined : val)}
                  className={cn(
                    'flex-1 py-2 text-lg rounded-lg transition-all',
                    sleepScore === val 
                      ? 'bg-primary/20 ring-2 ring-primary' 
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {sleepEmojis[val - 1]}
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {sleepScore !== undefined ? sleepLabels[sleepScore - 1] : 'Tap to select'}
            </p>
          </div>

          {/* Symptoms */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Symptoms</label>
            <div className="flex flex-wrap gap-2">
              {symptomsList.map((symptom) => {
                const isSelected = isSymptomSelected(symptom);
                const severity = getSymptomSeverity(symptom);
                return (
                  <div key={symptom} className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => toggleSymptom(symptom)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-full transition-all',
                        isSelected 
                          ? cn('ring-2', severityColors.badgeOutline[severity])
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      {symptom}
                    </button>
                    {isSelected && (
                      <div className="flex gap-0.5">
                        {([1, 2, 3] as const).map((sev) => (
                          <button
                            key={sev}
                            onClick={() => updateSymptomSeverity(symptom, sev)}
                            className={cn(
                              'w-4 h-4 rounded-full text-[8px] font-bold',
                              severity === sev 
                                ? severityColors.bg[sev] + ' text-white'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Triggers */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Triggers</label>
            <div className="flex flex-wrap gap-1.5">
              {triggersList.map((trigger) => (
                <button
                  key={trigger.id}
                  onClick={() => toggleTrigger(trigger.id)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full transition-all',
                    selectedTriggers.includes(trigger.id)
                      ? 'bg-coral/20 text-coral ring-1 ring-coral/50'
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {trigger.label}
                </button>
              ))}
            </div>
          </div>

          {/* Treatments */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Treatments</label>
            <div className="flex flex-wrap gap-1.5">
              {allTreatments.map((treatment) => (
                <button
                  key={treatment.id}
                  onClick={() => toggleTreatment(treatment.id)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full transition-all',
                    selectedTreatments.includes(treatment.id)
                      ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {treatment.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="min-h-[60px] text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {hasDemoData && (
            <Button 
              variant="outline" 
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1"
            onClick={handleSave}
          >
            Save Demo Data
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoEditModal;