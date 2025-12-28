import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { format } from 'date-fns';

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];
const moodLabels = ['Very Low', 'Low', 'Okay', 'Good', 'Great'];
const skinLabels = ['Severe', 'Bad', 'Moderate', 'Mild', 'Clear'];

interface DemoEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  existingMood?: number;
  existingSkin?: number;
}

const DemoEditModal = ({ open, onOpenChange, date, existingMood, existingSkin }: DemoEditModalProps) => {
  const { setDemoCheckIn, getDemoCheckInsForDate } = useDemoMode();
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Check for existing demo data
  const existingDemo = getDemoCheckInsForDate(dateStr);
  
  const [mood, setMood] = useState(existingDemo?.mood || existingMood || 3);
  const [skinFeeling, setSkinFeeling] = useState(existingDemo?.skinFeeling || existingSkin || 3);

  // Reset values when modal opens with new date
  useEffect(() => {
    if (open) {
      const demo = getDemoCheckInsForDate(dateStr);
      setMood(demo?.mood || existingMood || 3);
      setSkinFeeling(demo?.skinFeeling || existingSkin || 3);
    }
  }, [open, dateStr, existingMood, existingSkin, getDemoCheckInsForDate]);

  const handleSave = () => {
    setDemoCheckIn(dateStr, {
      mood,
      skinFeeling,
      timeOfDay: 'morning',
      treatments: [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
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
        </div>

        <div className="flex gap-2">
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
