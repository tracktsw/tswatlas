import { useState } from 'react';
import { CheckCircle, Sun, Moon, Check, Plus } from 'lucide-react';
import { useLocalStorage } from '@/contexts/LocalStorageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];

const CheckInPage = () => {
  const { checkIns, addCheckIn, customTreatments, addCustomTreatment } = useLocalStorage();
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [customTreatment, setCustomTreatment] = useState('');
  const [mood, setMood] = useState(3);
  const [skinFeeling, setSkinFeeling] = useState(3);
  const [notes, setNotes] = useState('');
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentHour = new Date().getHours();
  const suggestedTimeOfDay = currentHour < 14 ? 'morning' : 'evening';
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening'>(suggestedTimeOfDay);
  
  const todayCheckIns = checkIns.filter(c => c.timestamp.startsWith(today));
  const hasMorningCheckIn = todayCheckIns.some(c => c.timeOfDay === 'morning');
  const hasEveningCheckIn = todayCheckIns.some(c => c.timeOfDay === 'evening');

  const toggleTreatment = (id: string) => {
    setSelectedTreatments(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleAddCustomTreatment = () => {
    const trimmed = customTreatment.trim();
    if (trimmed) {
      addCustomTreatment(trimmed);
      if (!selectedTreatments.includes(trimmed)) {
        setSelectedTreatments(prev => [...prev, trimmed]);
      }
      setCustomTreatment('');
    }
  };

  const handleSubmit = () => {
    addCheckIn({
      timestamp: new Date().toISOString(),
      timeOfDay,
      treatments: selectedTreatments,
      mood,
      skinFeeling,
      notes: notes || undefined,
    });
    
    // Reset form
    setSelectedTreatments([]);
    setCustomTreatment('');
    setMood(3);
    setSkinFeeling(3);
    setNotes('');
    
    toast.success('Check-in saved!', {
      description: 'Your progress has been recorded locally.',
    });
  };

  const canSubmit = (timeOfDay === 'morning' && !hasMorningCheckIn) || 
                    (timeOfDay === 'evening' && !hasEveningCheckIn);

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Daily Check-in</h1>
        <p className="text-sm text-muted-foreground">How are you feeling today?</p>
      </div>

      {/* Time of Day Toggle */}
      <div className="flex gap-2">
        <Button
          variant={timeOfDay === 'morning' ? 'default' : 'outline'}
          className={cn(
            'flex-1 gap-2',
            hasMorningCheckIn && 'opacity-50'
          )}
          onClick={() => setTimeOfDay('morning')}
          disabled={hasMorningCheckIn}
        >
          <Sun className="w-4 h-4" />
          Morning
          {hasMorningCheckIn && <Check className="w-4 h-4 text-primary" />}
        </Button>
        <Button
          variant={timeOfDay === 'evening' ? 'default' : 'outline'}
          className={cn(
            'flex-1 gap-2',
            hasEveningCheckIn && 'opacity-50'
          )}
          onClick={() => setTimeOfDay('evening')}
          disabled={hasEveningCheckIn}
        >
          <Moon className="w-4 h-4" />
          Evening
          {hasEveningCheckIn && <Check className="w-4 h-4 text-primary" />}
        </Button>
      </div>

      {/* All done message */}
      {hasMorningCheckIn && hasEveningCheckIn && (
        <div className="glass-card p-4 text-center warm-gradient">
          <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="font-semibold text-foreground">All done for today!</p>
          <p className="text-sm text-muted-foreground">
            You've completed both check-ins. Great job taking care of yourself!
          </p>
        </div>
      )}

      {canSubmit && (
        <>
          {/* Treatments */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-foreground">
              What did you use today?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {treatments.map(({ id, label, description }) => (
                <button
                  key={id}
                  onClick={() => toggleTreatment(id)}
                  className={cn(
                    'glass-card p-3 text-left transition-all',
                    selectedTreatments.includes(id) 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      selectedTreatments.includes(id) 
                        ? 'border-primary bg-primary' 
                        : 'border-muted-foreground'
                    )}>
                      {selectedTreatments.includes(id) && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="font-medium text-foreground text-sm">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-7">
                    {description}
                  </p>
                </button>
              ))}
            </div>
            
            {/* Custom treatments as buttons */}
            {customTreatments.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {customTreatments.map((treatment) => (
                  <button
                    key={treatment}
                    onClick={() => toggleTreatment(treatment)}
                    className={cn(
                      'glass-card p-3 text-left transition-all',
                      selectedTreatments.includes(treatment) 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                        selectedTreatments.includes(treatment) 
                          ? 'border-primary bg-primary' 
                          : 'border-muted-foreground'
                      )}>
                        {selectedTreatments.includes(treatment) && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-foreground text-sm">{treatment}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-7">
                      Custom treatment
                    </p>
                  </button>
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
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddCustomTreatment}
                disabled={!customTreatment.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mood Rating */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-foreground">
              How's your mood?
            </h3>
            <div className="flex justify-between gap-2">
              {moodEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setMood(idx + 1)}
                  className={cn(
                    'flex-1 py-3 text-2xl rounded-xl transition-all',
                    mood === idx + 1 
                      ? 'bg-primary/20 ring-2 ring-primary scale-110' 
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Skin Feeling Rating */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-foreground">
              How's your skin feeling?
            </h3>
            <div className="flex justify-between gap-2">
              {skinEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setSkinFeeling(idx + 1)}
                  className={cn(
                    'flex-1 py-3 text-2xl rounded-xl transition-all',
                    skinFeeling === idx + 1 
                      ? 'bg-primary/20 ring-2 ring-primary scale-110' 
                      : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-2">
              <span>Flaring</span>
              <span>Healing</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-foreground">
              Any notes? (optional)
            </h3>
            <Textarea 
              placeholder="How was your day? Any triggers or improvements?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit} 
            className="w-full sage-gradient text-primary-foreground"
            size="lg"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Save Check-in
          </Button>
        </>
      )}

      {/* Recent Check-ins */}
      {todayCheckIns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-semibold text-foreground">Today's Check-ins</h3>
          {todayCheckIns.map(checkIn => (
            <div key={checkIn.id} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                {checkIn.timeOfDay === 'morning' ? (
                  <Sun className="w-4 h-4 text-accent" />
                ) : (
                  <Moon className="w-4 h-4 text-primary" />
                )}
                <span className="font-medium capitalize">{checkIn.timeOfDay}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(checkIn.timestamp), 'h:mm a')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>Mood: {moodEmojis[checkIn.mood - 1]}</span>
                <span>Skin: {skinEmojis[checkIn.skinFeeling - 1]}</span>
              </div>
              {checkIn.treatments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {checkIn.treatments.map(t => (
                    <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {treatments.find(tr => tr.id === t)?.label || t}
                    </span>
                  ))}
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
