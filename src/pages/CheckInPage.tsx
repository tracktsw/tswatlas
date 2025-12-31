import { useState } from 'react';
import { CheckCircle, Sun, Moon, Check, Plus, Heart, Pencil, X, Loader2 } from 'lucide-react';
import { useUserData, CheckIn, SymptomEntry } from '@/contexts/UserDataContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { HeartIllustration, SunIllustration, LeafIllustration } from '@/components/illustrations';
import { SparkleEffect } from '@/components/SparkleEffect';
import { severityColors, severityLabels } from '@/constants/severityColors';

const treatments = [
  { id: 'nmt', label: 'NMT', description: 'No Moisture Treatment' },
  { id: 'moisturizer', label: 'Moisturizer', description: 'Applied moisturizer' },
  { id: 'rlt', label: 'Red Light', description: 'Red Light Therapy' },
  { id: 'salt_bath', label: 'Salt Bath', description: 'Dead Sea Salt Bath' },
  { id: 'cold_compress', label: 'Cold Compress', description: 'Used cold compress' },
  { id: 'antihistamine', label: 'Antihistamine', description: 'Took antihistamine' },
  { id: 'exercise', label: 'Exercise', description: 'Physical activity' },
  { id: 'meditation', label: 'Meditation', description: 'Stress management' },
];

const triggersList = [
  // Environmental triggers
  { id: 'heat_sweat', label: 'Heat / Sweat' },
  { id: 'cold_air', label: 'Cold Air' },
  { id: 'weather_change', label: 'Weather Change' },
  { id: 'shower_hard_water', label: 'Shower / Hard Water' },
  { id: 'dust_pollen', label: 'Dust / Pollen' },
  { id: 'detergent', label: 'Detergent' },
  { id: 'fragrance', label: 'Fragrance' },
  { id: 'new_product', label: 'New Product' },
  { id: 'pets', label: 'Pets' },
  // Internal triggers
  { id: 'stress', label: 'Stress' },
  { id: 'poor_sleep', label: 'Poor Sleep' },
  { id: 'hormonal_changes', label: 'Hormonal Changes (Period / Cycle)' },
  { id: 'illness_infection', label: 'Illness / Infection' },
  // Activity & consumption
  { id: 'exercise', label: 'Exercise' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'spicy_food', label: 'Spicy Food' },
  { id: 'food', label: 'Food' },
  { id: 'friction_scratching', label: 'Friction / Scratching' },
];

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];
const skinIntensityLabels = ['High-intensity', 'Active', 'Noticeable', 'Settling', 'Calm'];
// Mapping: Red=4, Orange=3, Yellow=2, Green=1, Heart=0
const skinIntensityValues = [4, 3, 2, 1, 0];
const symptomsList = [
  'Burning', 'Itching', 'Thermodysregulation', 'Flaking',
  'Oozing', 'Swelling', 'Redness', 'Insomnia'
];

// severityLabels imported from @/constants/severityColors

const CheckInPage = () => {
  const { checkIns, addCheckIn, updateCheckIn, customTreatments, addCustomTreatment, removeCustomTreatment, getTodayCheckInCount } = useUserData();
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [customTreatment, setCustomTreatment] = useState('');
  const [mood, setMood] = useState(3);
  const [skinFeeling, setSkinFeeling] = useState(3);
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomEntry[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [foodTriggerText, setFoodTriggerText] = useState('');
  const [painScore, setPainScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSymptom, setExpandedSymptom] = useState<string | null>(null);
  // Client request ID for idempotent submissions - persists across retries
  const [clientRequestId, setClientRequestId] = useState<string>(() => crypto.randomUUID());

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentHour = new Date().getHours();
  const suggestedTimeOfDay = currentHour < 14 ? 'morning' : 'evening';
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening'>(suggestedTimeOfDay);

  const todayCheckIns = checkIns.filter((c) => format(new Date(c.timestamp), 'yyyy-MM-dd') === today);
  const hasMorningCheckIn = todayCheckIns.some((c) => c.timeOfDay === 'morning');
  const hasEveningCheckIn = todayCheckIns.some((c) => c.timeOfDay === 'evening');

  const toggleTreatment = (id: string) => {
    if (isSaving) return;
    setSelectedTreatments((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const toggleTrigger = (id: string) => {
    if (isSaving) return;
    if (id === 'food') {
      // For food, toggle the selection but don't clear the text immediately
      setSelectedTriggers((prev) => {
        if (prev.some(t => t === 'food' || t.startsWith('food:'))) {
          // Deselecting food - clear the text too
          setFoodTriggerText('');
          return prev.filter((t) => t !== 'food' && !t.startsWith('food:'));
        } else {
          return [...prev, 'food'];
        }
      });
    } else {
      setSelectedTriggers((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    }
  };

  const isFoodSelected = selectedTriggers.some(t => t === 'food' || t.startsWith('food:'));

  const toggleSymptom = (symptom: string) => {
    if (isSaving) return;
    setSelectedSymptoms((prev) => {
      const existing = prev.find(s => s.symptom === symptom);
      if (existing) {
        // Remove if already selected and collapse
        setExpandedSymptom(null);
        return prev.filter((s) => s.symptom !== symptom);
      } else {
        // Add with default severity of 2 (Moderate) and expand
        setExpandedSymptom(symptom);
        return [...prev, { symptom, severity: 2 as const }];
      }
    });
  };

  const handleSymptomTap = (symptom: string) => {
    if (isSaving) return;
    const isSelected = isSymptomSelected(symptom);
    if (isSelected) {
      // If already selected, toggle expansion or deselect if already expanded
      if (expandedSymptom === symptom) {
        // Collapse and keep selected
        setExpandedSymptom(null);
      } else {
        // Expand this one (collapses others automatically)
        setExpandedSymptom(symptom);
      }
    } else {
      // Not selected - select it and expand
      toggleSymptom(symptom);
    }
  };

  const updateSymptomSeverity = (symptom: string, severity: 1 | 2 | 3) => {
    if (isSaving) return;
    setSelectedSymptoms((prev) =>
      prev.map((s) => (s.symptom === symptom ? { ...s, severity } : s))
    );
  };

  const isSymptomSelected = (symptom: string) => selectedSymptoms.some(s => s.symptom === symptom);
  const getSymptomSeverity = (symptom: string): 1 | 2 | 3 => {
    const entry = selectedSymptoms.find(s => s.symptom === symptom);
    return entry?.severity || 2;
  };

  const handleAddCustomTreatment = () => {
    if (isSaving) return;
    const trimmed = customTreatment.trim();
    if (trimmed) {
      addCustomTreatment(trimmed);
      if (!selectedTreatments.includes(trimmed)) {
        setSelectedTreatments((prev) => [...prev, trimmed]);
      }
      setCustomTreatment('');
    }
  };

  const handleStartEdit = (checkIn: CheckIn) => {
    if (isSaving) return;
    setEditingCheckIn(checkIn);
    setSelectedTreatments(checkIn.treatments);
    setMood(checkIn.mood);
    setSkinFeeling(checkIn.skinFeeling);
    setSelectedSymptoms(checkIn.symptomsExperienced || []);
    // Extract food text from triggers if present
    const triggers = checkIn.triggers || [];
    const foodTrigger = triggers.find(t => t.startsWith('food:'));
    if (foodTrigger) {
      setFoodTriggerText(foodTrigger.replace('food:', ''));
    } else {
      setFoodTriggerText('');
    }
    setSelectedTriggers(triggers);
    setPainScore(checkIn.painScore ?? null);
    setNotes(checkIn.notes || '');
    setTimeOfDay(checkIn.timeOfDay);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    setEditingCheckIn(null);
    setSelectedTreatments([]);
    setMood(3);
    setSkinFeeling(3);
    setSelectedSymptoms([]);
    setSelectedTriggers([]);
    setFoodTriggerText('');
    setPainScore(null);
    setNotes('');
    setTimeOfDay(suggestedTimeOfDay);
  };

  const canSubmit =
    Boolean(editingCheckIn) ||
    (timeOfDay === 'morning' && !hasMorningCheckIn) ||
    (timeOfDay === 'evening' && !hasEveningCheckIn);

  const handleSubmit = async () => {
    if (!canSubmit || isSaving) return;

    // Check daily limit before attempting
    if (!editingCheckIn && getTodayCheckInCount() >= 2) {
      toast.error("You've reached today's 2 check-ins.");
      return;
    }

    // Defensive validation
    if (mood < 1 || mood > 5 || skinFeeling < 1 || skinFeeling > 5) {
      toast.error('Please choose a mood and skin rating before saving.');
      return;
    }

    setIsSaving(true);

    // Process triggers: replace 'food' with 'food:text' if text is provided
    const processedTriggers = selectedTriggers
      .filter(t => t !== 'food') // Remove plain 'food' entry
      .filter(t => !t.startsWith('food:')) // Remove any existing food:xxx entries
      .concat(isFoodSelected && foodTriggerText.trim() ? [`food:${foodTriggerText.trim()}`] : isFoodSelected ? ['food'] : []);

    try {
      if (editingCheckIn) {
        await updateCheckIn(editingCheckIn.id, {
          timeOfDay,
          treatments: selectedTreatments,
          mood,
          skinFeeling,
          symptomsExperienced: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
          triggers: processedTriggers.length > 0 ? processedTriggers : undefined,
          painScore: painScore ?? undefined,
          notes: notes || undefined,
        });

        setEditingCheckIn(null);
        toast.success('Check-in updated successfully');
      } else {
        // Use the same clientRequestId for retries (idempotent submission)
        await addCheckIn({
          timeOfDay,
          treatments: selectedTreatments,
          mood,
          skinFeeling,
          symptomsExperienced: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
          triggers: processedTriggers.length > 0 ? processedTriggers : undefined,
          painScore: painScore ?? undefined,
          notes: notes || undefined,
        }, clientRequestId);

        setShowSparkles(true);
        toast.success('Check-in saved successfully');
        
        // Generate new clientRequestId for next check-in (only on success)
        setClientRequestId(crypto.randomUUID());
      }

      // Reset form
      setSelectedTreatments([]);
      setCustomTreatment('');
      setMood(3);
      setSkinFeeling(3);
      setSelectedSymptoms([]);
      setSelectedTriggers([]);
      setFoodTriggerText('');
      setPainScore(null);
      setNotes('');
    } catch (error: any) {
      const message =
        typeof error?.message === 'string' && error.message.trim().length > 0
          ? error.message
          : editingCheckIn
            ? 'Failed to update check-in'
            : 'Failed to save check-in';
      toast.error(message);
      // Note: clientRequestId is NOT regenerated on error, so retry uses the same ID
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative">
      {/* Sparkle celebration effect */}
      <SparkleEffect isActive={showSparkles} onComplete={() => setShowSparkles(false)} />
      
      {/* Decorative elements */}
      <div className="decorative-blob w-32 h-32 bg-honey/30 -top-10 -left-10 fixed" />
      <div className="decorative-blob w-40 h-40 bg-primary/20 bottom-40 -right-20 fixed" />
      
      {/* Decorative illustrations */}
      <SunIllustration variant="rising" className="w-28 h-20 fixed top-16 right-0 opacity-30 pointer-events-none" />
      <HeartIllustration variant="floating" className="w-12 h-16 fixed bottom-52 left-2 opacity-25 pointer-events-none" />
      
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">
          {editingCheckIn ? 'Edit Check-in' : 'Daily Check-in'}
        </h1>
        <p className="text-muted-foreground">
          {editingCheckIn ? 'Update your check-in details' : 'How are you feeling today?'}
        </p>
      </div>

      {/* Time of Day Toggle - only show when not editing */}
      {!editingCheckIn && (
        <div className="flex gap-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <Button
            variant={timeOfDay === 'morning' ? 'warm' : 'outline'}
            className={cn(
              'flex-1 gap-2 h-12 rounded-2xl',
              hasMorningCheckIn && 'opacity-50'
            )}
            onClick={() => setTimeOfDay('morning')}
            disabled={hasMorningCheckIn}
          >
            <Sun className="w-5 h-5" />
            Morning
            {hasMorningCheckIn && <Check className="w-4 h-4" />}
          </Button>
          <Button
            variant={timeOfDay === 'evening' ? 'default' : 'outline'}
            className={cn(
              'flex-1 gap-2 h-12 rounded-2xl',
              hasEveningCheckIn && 'opacity-50'
            )}
            onClick={() => setTimeOfDay('evening')}
            disabled={hasEveningCheckIn}
          >
            <Moon className="w-5 h-5" />
            Evening
            {hasEveningCheckIn && <Check className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Editing indicator */}
      {editingCheckIn && (
        <div className="flex items-center justify-between glass-card-warm p-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-2 rounded-xl',
              editingCheckIn.timeOfDay === 'morning' ? 'bg-honey/20' : 'bg-primary/20'
            )}>
              {editingCheckIn.timeOfDay === 'morning' ? (
                <Sun className="w-4 h-4 text-honey" />
              ) : (
                <Moon className="w-4 h-4 text-primary" />
              )}
            </div>
            <span className="font-semibold capitalize">Editing {editingCheckIn.timeOfDay} check-in</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      {/* All done message - only show when not editing */}
      {!editingCheckIn && hasMorningCheckIn && hasEveningCheckIn && (
        <div className="glass-card-warm p-6 text-center animate-scale-in relative overflow-hidden">
          <LeafIllustration variant="cluster" className="w-20 h-20 absolute -right-4 -top-4 opacity-20" />
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-primary/20 to-sage-light flex items-center justify-center relative">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <p className="font-display font-bold text-lg text-foreground">All done for today!</p>
          <p className="text-muted-foreground mt-1">
            You've completed both check-ins. Tap any check-in below to edit it.
          </p>
        </div>
      )}

      {canSubmit && (
        <>
          {/* Treatments */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              What did you use today?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {treatments.map(({ id, label, description }) => (
                <button
                  key={id}
                  onClick={() => toggleTreatment(id)}
                  className={cn(
                    'glass-card px-3 py-2.5 text-left transition-all duration-300 hover:-translate-y-0.5',
                    selectedTreatments.includes(id) 
                      ? 'ring-2 ring-primary bg-primary/5 shadow-warm' 
                      : 'border-border/50 hover:bg-muted/50 hover:shadow-warm-sm'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 flex-shrink-0',
                      selectedTreatments.includes(id) 
                        ? 'border-primary bg-white' 
                        : 'border-muted-foreground/50'
                    )}>
                      {selectedTreatments.includes(id) && (
                        <Check className="w-3 h-3 text-coral" />
                      )}
                    </div>
                    <span className="font-semibold text-foreground text-sm">{label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 ml-7 leading-tight">
                    {description}
                  </p>
                </button>
              ))}
            </div>
            
            {/* Custom treatments as buttons */}
            {customTreatments.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {customTreatments.map((treatment) => (
                  <div
                    key={treatment}
                    className={cn(
                      'glass-card px-3 py-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 relative',
                      selectedTreatments.includes(treatment) 
                        ? 'ring-2 ring-primary bg-primary/5 shadow-warm' 
                        : 'border-border/50 hover:bg-muted/50 hover:shadow-warm-sm'
                    )}
                  >
                    <button
                      onClick={() => toggleTreatment(treatment)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 flex-shrink-0',
                          selectedTreatments.includes(treatment) 
                            ? 'border-primary bg-white' 
                            : 'border-muted-foreground/50'
                        )}>
                          {selectedTreatments.includes(treatment) && (
                            <Check className="w-3 h-3 text-coral" />
                          )}
                        </div>
                        <span className="font-semibold text-foreground text-sm pr-5">{treatment}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 ml-7 leading-tight">
                        Custom treatment
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomTreatment(treatment);
                        setSelectedTreatments(prev => prev.filter(t => t !== treatment));
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove treatment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Custom treatment input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add your own treatment..."
                value={customTreatment}
                onChange={(e) => setCustomTreatment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTreatment()}
                className="flex-1 h-11 rounded-xl border-2"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddCustomTreatment}
                disabled={!customTreatment.trim()}
                className="h-11 w-11 rounded-xl"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Triggers today */}
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.12s' }}>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                Triggers today
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap to select what might have worsened symptoms.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {triggersList.map(({ id, label }) => {
                const isSelected = id === 'food' ? isFoodSelected : selectedTriggers.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleTrigger(id)}
                    className={cn(
                      'py-2 px-3 text-sm font-medium rounded-full transition-all duration-200 text-left',
                      isSelected
                        ? 'bg-primary/5 ring-[1.5px] ring-primary text-foreground'
                        : 'bg-muted/50 text-muted-foreground/80 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Food input field - shown when Food is selected */}
            {isFoodSelected && (
              <div className="mt-2">
                <Input
                  placeholder="What food? (e.g., dairy, gluten)"
                  value={foodTriggerText}
                  onChange={(e) => setFoodTriggerText(e.target.value)}
                  className="h-10 rounded-xl border-2"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Select anything that might have contributed. Patterns are assessed over time.
            </p>
          </div>

          {/* Mood Rating */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              How's your mood?
            </h3>
            <div className="flex justify-between gap-2">
              {moodEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setMood(idx + 1)}
                  className={cn(
                    'flex-1 py-4 text-2xl rounded-2xl transition-all duration-300',
                    mood === idx + 1 
                      ? 'bg-gradient-to-br from-honey/30 to-coral-light shadow-warm scale-110' 
                      : 'bg-muted/50 hover:bg-muted hover:scale-105'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Skin Feeling Rating */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              How's your skin feeling?
            </h3>
            <div className="flex justify-between gap-1">
              {skinEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setSkinFeeling(idx + 1)}
                  className={cn(
                    'flex-1 flex flex-col items-center py-3 px-1 rounded-2xl transition-all duration-300',
                    skinFeeling === idx + 1 
                      ? 'bg-gradient-to-br from-primary/20 to-sage-light shadow-warm scale-105' 
                      : 'bg-muted/50 hover:bg-muted hover:scale-102'
                  )}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className={cn(
                    'text-[10px] mt-1.5 font-medium leading-tight text-center',
                    skinFeeling === idx + 1 
                      ? 'text-foreground' 
                      : 'text-muted-foreground'
                  )}>
                    {skinIntensityLabels[idx]}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center px-2">
              Tip: We look at patterns over days to understand flares.
            </p>
          </div>

          {/* Symptoms experienced today */}
          <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.22s' }}>
            <h3 className="font-display text-base font-semibold text-muted-foreground">
              Symptoms
            </h3>
            <div className="flex flex-wrap gap-1">
              {symptomsList.map((symptom) => {
                const selected = isSymptomSelected(symptom);
                const severity = getSymptomSeverity(symptom);
                const isExpanded = expandedSymptom === symptom;
                
                return (
                  <div
                    key={symptom}
                    className={cn(
                      'inline-flex items-center rounded-full transition-all duration-200',
                      selected
                        ? 'bg-coral/15 ring-1 ring-coral/30'
                        : 'bg-muted/50 hover:bg-muted'
                    )}
                  >
                    <button
                      onClick={() => handleSymptomTap(symptom)}
                      className={cn(
                        'px-2.5 py-1 text-[13px] font-medium transition-colors flex items-center gap-1.5',
                        selected
                          ? 'text-coral'
                          : 'text-muted-foreground/80 hover:text-foreground'
                      )}
                    >
                      {selected && (
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          severityColors.bg[severity]
                        )} />
                      )}
                      {symptom}
                      {selected && !isExpanded && (
                        <span className="text-[9px] text-coral/70">
                          {severityLabels[severity]}
                        </span>
                      )}
                    </button>
                    
                    {/* Inline severity selector - only show when expanded */}
                    {selected && isExpanded && (
                      <div className="flex items-center gap-0.5 pr-1 border-l border-coral/20 ml-0.5 pl-1">
                        {([1, 2, 3] as const).map((level) => (
                          <button
                            key={level}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSymptomSeverity(symptom, level);
                            }}
                            className={cn(
                              'w-4 h-4 rounded-full flex items-center justify-center transition-all',
                              severity === level
                                ? severityColors.bg[level]
                                : 'bg-muted/80 hover:bg-muted'
                            )}
                            title={severityLabels[level]}
                          >
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              severity === level
                                ? 'bg-white'
                                : severityColors.bgMuted[level]
                            )} />
                          </button>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSymptom(symptom);
                          }}
                          className="ml-0.5 p-0.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pain Scale */}
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.23s' }}>
            <h3 className="font-display text-base font-semibold text-muted-foreground">
              Pain level today
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, i) => i).map((level) => {
                // Gradient from light yellow (0) to dark red (10)
                const painColors = [
                  'bg-yellow-200 text-yellow-900 ring-yellow-400',      // 0 - light yellow
                  'bg-yellow-300 text-yellow-900 ring-yellow-500',      // 1
                  'bg-amber-300 text-amber-900 ring-amber-500',         // 2
                  'bg-amber-400 text-amber-950 ring-amber-600',         // 3
                  'bg-orange-400 text-orange-950 ring-orange-600',      // 4
                  'bg-orange-500 text-white ring-orange-700',           // 5
                  'bg-orange-600 text-white ring-orange-800',           // 6
                  'bg-red-500 text-white ring-red-700',                 // 7
                  'bg-red-600 text-white ring-red-800',                 // 8
                  'bg-red-700 text-white ring-red-900',                 // 9
                  'bg-red-800 text-white ring-red-950',                 // 10 - dark red
                ];
                
                return (
                  <button
                    key={level}
                    onClick={() => setPainScore(painScore === level ? null : level)}
                    className={cn(
                      'w-9 h-9 rounded-full text-sm font-medium transition-all duration-200 flex items-center justify-center',
                      painScore === level
                        ? `${painColors[level]} ring-2 ring-offset-1 scale-110`
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/70 px-1">
              <span>0 = No pain</span>
              <span>10 = Worst pain imaginable</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Include skin pain, burning, or soreness.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              Any notes? (optional)
            </h3>
            <Textarea 
              placeholder="How was your day? Any triggers or improvements?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-2xl border-2 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            {editingCheckIn && (
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                className="flex-1 h-12 text-base rounded-2xl"
                size="lg"
                disabled={isSaving}
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              variant="warm"
              className={cn("h-12 text-base", editingCheckIn ? "flex-1" : "w-full")}
              size="lg"
              disabled={!canSubmit || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {editingCheckIn ? 'Update Check-in' : 'Save Check-in'}
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Recent Check-ins */}
      {todayCheckIns.length > 0 && (
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="font-display font-bold text-lg text-foreground">Today's Check-ins</h3>
          {todayCheckIns.map(checkIn => (
            <div 
              key={checkIn.id} 
              className={cn(
                "glass-card-warm p-5 cursor-pointer transition-all hover:shadow-warm",
                editingCheckIn?.id === checkIn.id && "ring-2 ring-primary"
              )}
              onClick={() => handleStartEdit(checkIn)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  'p-2 rounded-xl',
                  checkIn.timeOfDay === 'morning' ? 'bg-honey/20' : 'bg-primary/20'
                )}>
                  {checkIn.timeOfDay === 'morning' ? (
                    <Sun className="w-4 h-4 text-honey" />
                  ) : (
                    <Moon className="w-4 h-4 text-primary" />
                  )}
                </div>
                <span className="font-semibold capitalize">{checkIn.timeOfDay}</span>
                <span className="text-xs text-muted-foreground ml-auto mr-2">
                  {format(new Date(checkIn.timestamp), 'h:mm a')}
                </span>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Mood:</span> 
                  <span className="text-lg">{moodEmojis[checkIn.mood - 1]}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Skin:</span> 
                  <span className="text-lg">{skinEmojis[checkIn.skinFeeling - 1]}</span>
                </span>
                {checkIn.painScore !== null && checkIn.painScore !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Pain:</span> 
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      checkIn.painScore <= 2 ? 'bg-yellow-200 text-yellow-900' :
                      checkIn.painScore <= 4 ? 'bg-amber-300 text-amber-900' :
                      checkIn.painScore <= 6 ? 'bg-orange-400 text-white' :
                      checkIn.painScore <= 8 ? 'bg-red-500 text-white' :
                      'bg-red-700 text-white'
                    )}>
                      {checkIn.painScore}/10
                    </span>
                  </span>
                )}
              </div>
              {checkIn.treatments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {checkIn.treatments.map(t => (
                    <span key={t} className="text-xs bg-coral/10 text-coral font-medium px-2.5 py-1 rounded-full">
                      {treatments.find(tr => tr.id === t)?.label || t}
                    </span>
                  ))}
                </div>
              )}
              {checkIn.symptomsExperienced && checkIn.symptomsExperienced.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {checkIn.symptomsExperienced.map(entry => (
                    <span key={entry.symptom} className="text-xs bg-muted text-muted-foreground font-medium px-2.5 py-1 rounded-full">
                      {entry.symptom} ({severityLabels[entry.severity]})
                    </span>
                  ))}
                </div>
              )}
              {checkIn.triggers && checkIn.triggers.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Triggers logged today</p>
                  <div className="flex flex-wrap gap-1.5">
                    {checkIn.triggers.map(triggerId => {
                      // Handle food:xxx format
                      if (triggerId.startsWith('food:')) {
                        const foodText = triggerId.replace('food:', '');
                        return (
                          <span key={triggerId} className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium px-2.5 py-1 rounded-full">
                            Food: {foodText}
                          </span>
                        );
                      }
                      return (
                        <span key={triggerId} className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium px-2.5 py-1 rounded-full">
                          {triggersList.find(t => t.id === triggerId)?.label || triggerId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckInPage;
