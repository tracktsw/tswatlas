import { useState } from 'react';
import { CheckCircle, Sun, Moon, Check, Plus, Heart, Pencil, X } from 'lucide-react';
import { useUserData, CheckIn } from '@/contexts/UserDataContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { HeartIllustration, SunIllustration, LeafIllustration } from '@/components/illustrations';
import { SparkleEffect } from '@/components/SparkleEffect';

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
  const { checkIns, addCheckIn, updateCheckIn, customTreatments, addCustomTreatment } = useUserData();
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [customTreatment, setCustomTreatment] = useState('');
  const [mood, setMood] = useState(3);
  const [skinFeeling, setSkinFeeling] = useState(3);
  const [notes, setNotes] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  
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

  const handleStartEdit = (checkIn: CheckIn) => {
    setEditingCheckIn(checkIn);
    setSelectedTreatments(checkIn.treatments);
    setMood(checkIn.mood);
    setSkinFeeling(checkIn.skinFeeling);
    setNotes(checkIn.notes || '');
    setTimeOfDay(checkIn.timeOfDay);
  };

  const handleCancelEdit = () => {
    setEditingCheckIn(null);
    setSelectedTreatments([]);
    setMood(3);
    setSkinFeeling(3);
    setNotes('');
    setTimeOfDay(suggestedTimeOfDay);
  };

  const handleSubmit = async () => {
    try {
      if (editingCheckIn) {
        await updateCheckIn(editingCheckIn.id, {
          timeOfDay: editingCheckIn.timeOfDay,
          treatments: selectedTreatments,
          mood,
          skinFeeling,
          notes: notes || undefined,
        });
        setEditingCheckIn(null);
        toast.success('Check-in updated!');
      } else {
        await addCheckIn({
          timeOfDay,
          treatments: selectedTreatments,
          mood,
          skinFeeling,
          notes: notes || undefined,
        });
        setShowSparkles(true);
        toast.success('Check-in saved!', {
          description: 'Your progress has been synced to the cloud.',
        });
      }
      
      // Reset form
      setSelectedTreatments([]);
      setCustomTreatment('');
      setMood(3);
      setSkinFeeling(3);
      setNotes('');
    } catch (error) {
      toast.error(editingCheckIn ? 'Failed to update check-in' : 'Failed to save check-in');
    }
  };

  const canSubmit = editingCheckIn || (timeOfDay === 'morning' && !hasMorningCheckIn) || 
                    (timeOfDay === 'evening' && !hasEveningCheckIn);

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
            <div className="grid grid-cols-2 gap-3">
              {treatments.map(({ id, label, description }) => (
                <button
                  key={id}
                  onClick={() => toggleTreatment(id)}
                  className={cn(
                    'glass-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5',
                    selectedTreatments.includes(id) 
                      ? 'ring-2 ring-coral bg-coral/5 shadow-warm' 
                      : 'hover:bg-muted/50 hover:shadow-warm-sm'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                      selectedTreatments.includes(id) 
                        ? 'border-coral bg-coral' 
                        : 'border-muted-foreground'
                    )}>
                      {selectedTreatments.includes(id) && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <span className="font-semibold text-foreground">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 ml-8">
                    {description}
                  </p>
                </button>
              ))}
            </div>
            
            {/* Custom treatments as buttons */}
            {customTreatments.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {customTreatments.map((treatment) => (
                  <button
                    key={treatment}
                    onClick={() => toggleTreatment(treatment)}
                    className={cn(
                      'glass-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5',
                      selectedTreatments.includes(treatment) 
                        ? 'ring-2 ring-coral bg-coral/5 shadow-warm' 
                        : 'hover:bg-muted/50 hover:shadow-warm-sm'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                        selectedTreatments.includes(treatment) 
                          ? 'border-coral bg-coral' 
                          : 'border-muted-foreground'
                      )}>
                        {selectedTreatments.includes(treatment) && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <span className="font-semibold text-foreground">{treatment}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 ml-8">
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
            <div className="flex justify-between gap-2">
              {skinEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setSkinFeeling(idx + 1)}
                  className={cn(
                    'flex-1 py-4 text-2xl rounded-2xl transition-all duration-300',
                    skinFeeling === idx + 1 
                      ? 'bg-gradient-to-br from-primary/20 to-sage-light shadow-warm scale-110' 
                      : 'bg-muted/50 hover:bg-muted hover:scale-105'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-2 font-medium">
              <span>Flaring</span>
              <span>Healing</span>
            </div>
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
              >
                Cancel
              </Button>
            )}
            <Button 
              onClick={handleSubmit} 
              variant="warm"
              className={cn("h-12 text-base", editingCheckIn ? "flex-1" : "w-full")}
              size="lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {editingCheckIn ? 'Update Check-in' : 'Save Check-in'}
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
                editingCheckIn?.id === checkIn.id && "ring-2 ring-coral"
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
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Mood:</span> 
                  <span className="text-lg">{moodEmojis[checkIn.mood - 1]}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Skin:</span> 
                  <span className="text-lg">{skinEmojis[checkIn.skinFeeling - 1]}</span>
                </span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckInPage;
