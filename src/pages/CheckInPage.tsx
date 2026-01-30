import { useState, useRef, useMemo, useEffect } from 'react';
import { CheckCircle, Check, Plus, Heart, Pencil, X, Loader2, UtensilsCrossed, ChevronDown, Package, Trash2 } from 'lucide-react';
import { useUserData, CheckIn, SymptomEntry } from '@/contexts/UserDataContext';
import { Button } from '@/components/ui/button';
import { AndroidSafeTextarea } from '@/components/ui/android-safe-textarea';
import { AndroidSafeInput } from '@/components/ui/android-safe-input';
import { toast } from 'sonner';
import { format, isToday, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { HeartIllustration, SunIllustration, LeafIllustration } from '@/components/illustrations';
import { SparkleEffect } from '@/components/SparkleEffect';
import { severityColors, severityLabels } from '@/constants/severityColors';
import { trackCheckInCompleted } from '@/utils/analytics';
import { useInAppReview } from '@/hooks/useInAppReview';
import { CheckInDatePicker } from '@/components/CheckInDatePicker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  { id: 'pets', label: 'Pets' },
  // Internal triggers
  { id: 'stress', label: 'Stress' },
  { id: 'poor_sleep', label: 'Poor Sleep' },
  { id: 'hormonal_changes', label: 'Hormonal Changes' },
  { id: 'illness_infection', label: 'Illness / Infection' },
  // Activity & consumption
  { id: 'exercise', label: 'Exercise' },
  { id: 'alcohol', label: 'Alcohol' },
  { id: 'spicy_food', label: 'Spicy Food' },
  
  { id: 'friction_scratching', label: 'Friction / Scratching' },
];

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];
const skinIntensityLabels = ['High-intensity', 'Active', 'Noticeable', 'Settling', 'Calm'];
// Mapping: Red=4, Orange=3, Yellow=2, Green=1, Heart=0
const skinIntensityValues = [4, 3, 2, 1, 0];
const symptomsList = [
  'Burning', 'Itching', 'Thermodysregulation', 'Flaking',
  'Oozing', 'Swelling', 'Redness'
];

// Common food suggestions for quick-tap
const commonFoodSuggestions = [
  'Dairy', 'Gluten', 'Eggs', 'Nuts', 'Soy', 'Shellfish', 'Sugar', 'Alcohol', 'Caffeine', 'Spicy food'
];

// Common product suggestions for quick-tap
const commonProductSuggestions = [
  'New moisturizer', 'Sunscreen', 'Cleanser', 'Serum', 'Shampoo', 'Body wash', 'Laundry detergent', 'Makeup'
];

const sleepOptions = [
  { value: 1, label: 'Very poor', emoji: '😫' },
  { value: 2, label: 'Poor', emoji: '😩' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Very good', emoji: '😴' },
];

// severityLabels imported from @/constants/severityColors

const CheckInPage = () => {
  const { checkIns, addCheckIn, updateCheckIn, deleteCheckIn, getCheckInForDate, customTreatments, addCustomTreatment, removeCustomTreatment, customTriggers, addCustomTrigger, removeCustomTrigger, getTodayCheckInCount } = useUserData();
  const { maybeRequestReview } = useInAppReview();
  
  // Selected date for check-in (supports backfill)
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const isBackfillMode = !isToday(selectedDate);
  
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [customTreatment, setCustomTreatment] = useState('');
  const [mood, setMood] = useState(3);
  const [skinFeeling, setSkinFeeling] = useState(3);
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomEntry[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [foodItems, setFoodItems] = useState<string[]>([]);
  const [foodInputText, setFoodInputText] = useState('');
  const [productItems, setProductItems] = useState<string[]>([]);
  const [productInputText, setProductInputText] = useState('');
  const [painScore, setPainScore] = useState<number | null>(null);
  const [sleepScore, setSleepScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSymptom, setExpandedSymptom] = useState<string | null>(null);
  // Client request ID for idempotent submissions - persists across retries
  const [clientRequestId, setClientRequestId] = useState<string>(() => crypto.randomUUID());
  const [showFoodSuggestions, setShowFoodSuggestions] = useState(false);
  const [isFoodDiaryOpen, setIsFoodDiaryOpen] = useState(false);
  const [isProductDiaryOpen, setIsProductDiaryOpen] = useState(false);
  
  // Delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs for inputs
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const customTreatmentRef = useRef<HTMLInputElement>(null);
  const customTriggerRef = useRef<HTMLInputElement>(null);
  const foodInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  
  // Custom trigger input state
  const [customTriggerInput, setCustomTriggerInput] = useState('');

  // Get check-in for the selected date
  const selectedDateCheckIn = useMemo(() => {
    return getCheckInForDate(selectedDate);
  }, [selectedDate, getCheckInForDate]);

  const hasExistingData = !!selectedDateCheckIn;

  // When date changes, load existing data or reset form
  useEffect(() => {
    if (selectedDateCheckIn && !editingCheckIn) {
      // Auto-load existing data for the selected date
      loadCheckInData(selectedDateCheckIn);
    } else if (!selectedDateCheckIn && !editingCheckIn) {
      // Reset form for a new date
      resetForm();
    }
  }, [selectedDate, selectedDateCheckIn?.id]);

  const loadCheckInData = (checkIn: CheckIn) => {
    setEditingCheckIn(checkIn);
    setSelectedTreatments(checkIn.treatments);
    setMood(checkIn.mood);
    setSkinFeeling(checkIn.skinFeeling);
    setSelectedSymptoms(checkIn.symptomsExperienced || []);
    
    const triggers = checkIn.triggers || [];
    const foodTriggers = triggers.filter(t => t.startsWith('food:'));
    if (foodTriggers.length > 0) {
      setFoodItems(foodTriggers.map(t => t.replace('food:', '')));
      setIsFoodDiaryOpen(true);
    } else {
      setFoodItems([]);
      setIsFoodDiaryOpen(false);
    }
    setFoodInputText('');
    
    const productTriggers = triggers.filter(t => t.startsWith('product:') || t.startsWith('new_product:'));
    if (productTriggers.length > 0) {
      setProductItems(productTriggers.map(t => 
        t.startsWith('product:') ? t.replace('product:', '') : t.replace('new_product:', '')
      ));
      setIsProductDiaryOpen(true);
    } else {
      setProductItems([]);
      setIsProductDiaryOpen(false);
    }
    setProductInputText('');
    
    setSelectedTriggers(triggers.filter(t => !t.startsWith('food:') && !t.startsWith('product:') && !t.startsWith('new_product:')));
    setPainScore(checkIn.painScore ?? null);
    setSleepScore(checkIn.sleepScore ?? null);
    setNotes(checkIn.notes || '');
  };

  const resetForm = () => {
    setEditingCheckIn(null);
    setSelectedTreatments([]);
    setCustomTreatment('');
    setCustomTriggerInput('');
    setMood(3);
    setSkinFeeling(3);
    setSelectedSymptoms([]);
    setSelectedTriggers([]);
    setFoodItems([]);
    setFoodInputText('');
    setProductItems([]);
    setProductInputText('');
    setPainScore(null);
    setSleepScore(null);
    setNotes('');
    setClientRequestId(crypto.randomUUID());
  };

  const handleDateChange = (newDate: Date) => {
    // If form has unsaved changes, we could warn - but for simplicity, just switch
    setSelectedDate(newDate);
    setEditingCheckIn(null); // Clear editing state, will be re-set by useEffect if data exists
  };

  // Legacy: for display in "today's check-in" section when on today
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIns = checkIns.filter((c) => format(new Date(c.timestamp), 'yyyy-MM-dd') === today);
  const hasTodayCheckIn = todayCheckIns.length > 0;

  // Extract recently logged foods from check-in history (last 30 days)
  const recentFoods = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const foodCounts: Record<string, number> = {};
    
    checkIns
      .filter(c => new Date(c.timestamp) >= thirtyDaysAgo)
      .forEach(c => {
        (c.triggers || []).forEach(trigger => {
          if (trigger.startsWith('food:')) {
            const food = trigger.slice(5).trim();
            if (food) {
              const normalizedFood = food.charAt(0).toUpperCase() + food.slice(1).toLowerCase();
              foodCounts[normalizedFood] = (foodCounts[normalizedFood] || 0) + 1;
            }
          }
        });
      });
    
    // Sort by frequency and return top 10
    return Object.entries(foodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([food]) => food);
  }, [checkIns]);

  // Extract recently logged products from check-in history (last 30 days)
  const recentProducts = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const productCounts: Record<string, number> = {};
    
    checkIns
      .filter(c => new Date(c.timestamp) >= thirtyDaysAgo)
      .forEach(c => {
        (c.triggers || []).forEach(trigger => {
          // Support both new product: prefix and legacy new_product: prefix
          if (trigger.startsWith('product:')) {
            const product = trigger.slice(8).trim();
            if (product) {
              const normalizedProduct = product.charAt(0).toUpperCase() + product.slice(1).toLowerCase();
              productCounts[normalizedProduct] = (productCounts[normalizedProduct] || 0) + 1;
            }
          } else if (trigger.startsWith('new_product:')) {
            const product = trigger.slice(12).trim();
            if (product) {
              const normalizedProduct = product.charAt(0).toUpperCase() + product.slice(1).toLowerCase();
              productCounts[normalizedProduct] = (productCounts[normalizedProduct] || 0) + 1;
            }
          }
        });
      });
    
    return Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([product]) => product);
  }, [checkIns]);

  // Filter food suggestions based on input text
  const filteredFoodSuggestions = useMemo(() => {
    const inputLower = foodInputText.toLowerCase().trim();
    const alreadyAdded = new Set(foodItems.map(f => f.toLowerCase()));
    
    // Combine recent foods and common suggestions, prioritizing recent
    const allSuggestions = [...new Set([...recentFoods, ...commonFoodSuggestions])];
    
    if (!inputLower) {
      // Show all suggestions not already added
      return allSuggestions.filter(s => !alreadyAdded.has(s.toLowerCase())).slice(0, 8);
    }
    
    // Filter by input
    return allSuggestions
      .filter(s => s.toLowerCase().includes(inputLower) && !alreadyAdded.has(s.toLowerCase()))
      .slice(0, 6);
  }, [foodInputText, foodItems, recentFoods]);

  // Filter product suggestions based on input text
  const filteredProductSuggestions = useMemo(() => {
    const inputLower = productInputText.toLowerCase().trim();
    const alreadyAdded = new Set(productItems.map(p => p.toLowerCase()));
    
    // Combine recent products and common suggestions, prioritizing recent
    const allSuggestions = [...new Set([...recentProducts, ...commonProductSuggestions])];
    
    if (!inputLower) {
      return allSuggestions.filter(s => !alreadyAdded.has(s.toLowerCase())).slice(0, 8);
    }
    
    return allSuggestions
      .filter(s => s.toLowerCase().includes(inputLower) && !alreadyAdded.has(s.toLowerCase()))
      .slice(0, 6);
  }, [productInputText, productItems, recentProducts]);

  const toggleTreatment = (id: string) => {
    if (isSaving) return;
    setSelectedTreatments((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const toggleTrigger = (id: string) => {
    if (isSaving) return;
    setSelectedTriggers((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleAddFoodItem = () => {
    if (isSaving) return;
    const trimmed = foodInputText.trim();
    if (!trimmed) return;
    // Normalize: capitalize first letter, lowercase rest
    const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    // Case-insensitive duplicate check
    const alreadyExists = foodItems.some(f => f.toLowerCase() === normalized.toLowerCase());
    if (!alreadyExists) {
      setFoodItems((prev) => [...prev, normalized]);
    }
    setFoodInputText('');
  };

  const handleRemoveFoodItem = (food: string) => {
    if (isSaving) return;
    setFoodItems((prev) => prev.filter((f) => f !== food));
  };

  const handleAddProductItem = () => {
    if (isSaving) return;
    const trimmed = productInputText.trim();
    if (!trimmed) return;
    // Normalize: capitalize first letter, lowercase rest
    const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    // Case-insensitive duplicate check
    const alreadyExists = productItems.some(p => p.toLowerCase() === normalized.toLowerCase());
    if (!alreadyExists) {
      setProductItems((prev) => [...prev, normalized]);
    }
    setProductInputText('');
  };

  const handleRemoveProductItem = (product: string) => {
    if (isSaving) return;
    setProductItems((prev) => prev.filter((p) => p !== product));
  };

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

  const handleAddCustomTrigger = () => {
    if (isSaving) return;
    const trimmed = customTriggerInput.trim();
    if (trimmed) {
      addCustomTrigger(trimmed);
      if (!selectedTriggers.includes(trimmed)) {
        setSelectedTriggers((prev) => [...prev, trimmed]);
      }
      setCustomTriggerInput('');
    }
  };

  const handleStartEdit = (checkIn: CheckIn) => {
    if (isSaving) return;
    loadCheckInData(checkIn);
  };

  const handleCancelEdit = () => {
    if (isSaving) return;
    // If there's existing data for this date, reload it; otherwise reset
    if (selectedDateCheckIn) {
      loadCheckInData(selectedDateCheckIn);
    } else {
      resetForm();
    }
  };

  const handleDeleteCheckIn = async () => {
    if (!editingCheckIn || isDeleting) return;
    
    setIsDeleting(true);
    try {
      await deleteCheckIn(editingCheckIn.id);
      toast.success('Check-in deleted');
      resetForm();
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete check-in');
    } finally {
      setIsDeleting(false);
    }
  };

  // Can submit if: editing existing entry OR no entry exists for selected date
  const canSubmit = Boolean(editingCheckIn) || !hasExistingData;

  const handleSubmit = async () => {
    if (!canSubmit || isSaving) return;

    // Defensive validation
    if (mood < 1 || mood > 5 || skinFeeling < 1 || skinFeeling > 5) {
      toast.error('Please choose a mood and skin rating before saving.');
      return;
    }

    setIsSaving(true);

    // Process triggers: add food items and product items as prefixed entries
    const processedTriggers = selectedTriggers
      .filter(t => !t.startsWith('product:')) // Remove any existing product:xxx entries (will re-add from productItems)
      .filter(t => !t.startsWith('new_product:')) // Clean up legacy new_product entries
      .filter(t => t !== 'new_product') // Clean up legacy new_product entry
      .filter(t => !t.startsWith('food:')) // Remove any existing food:xxx entries (will re-add from foodItems)
      .concat(foodItems.length > 0 ? foodItems.map(f => `food:${f}`) : [])
      .concat(productItems.length > 0 ? productItems.map(p => `product:${p}`) : []);

    try {
      if (editingCheckIn) {
        await updateCheckIn(editingCheckIn.id, {
          timeOfDay: 'morning', // Default, kept for DB compatibility
          treatments: selectedTreatments,
          mood,
          skinFeeling,
          symptomsExperienced: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
          triggers: processedTriggers.length > 0 ? processedTriggers : undefined,
          painScore: painScore ?? undefined,
          sleepScore: sleepScore ?? undefined,
          notes: notes || undefined,
        });

        toast.success(isBackfillMode ? 'Past entry updated' : 'Check-in updated');
        // Reload the data to show it's now in "edit" mode
        const updatedCheckIn = getCheckInForDate(selectedDate);
        if (updatedCheckIn) {
          setEditingCheckIn(updatedCheckIn);
        }
      } else {
        // New entry - pass custom date for backfill
        await addCheckIn({
          timeOfDay: 'morning', // Default, kept for DB compatibility
          treatments: selectedTreatments,
          mood,
          skinFeeling,
          symptomsExperienced: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
          triggers: processedTriggers.length > 0 ? processedTriggers : undefined,
          painScore: painScore ?? undefined,
          sleepScore: sleepScore ?? undefined,
          notes: notes || undefined,
        }, clientRequestId, isBackfillMode ? selectedDate : undefined);

        setShowSparkles(true);
        toast.success(isBackfillMode ? 'Past entry saved' : 'Check-in saved');
        
        // Track successful check-in (after DB insert succeeds)
        trackCheckInCompleted(isBackfillMode ? 'backfill' : 'daily');
        
        // Request in-app review after 7th check-in (once per user)
        const newCheckInCount = checkIns.length + 1;
        maybeRequestReview(newCheckInCount);
        
        // Generate new clientRequestId for next check-in (only on success)
        setClientRequestId(crypto.randomUUID());
        
        // After saving, the new entry should appear - set it as editing
        // Small delay to allow state to update
        setTimeout(() => {
          const newCheckIn = getCheckInForDate(selectedDate);
          if (newCheckIn) {
            setEditingCheckIn(newCheckIn);
          }
        }, 100);
      }
      // Don't reset form - stay on the same date with the saved data loaded
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
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto relative">
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
          {isBackfillMode ? 'Log Past Day' : editingCheckIn ? 'Edit Check-in' : 'Daily Check-in'}
        </h1>
        <p className="text-muted-foreground">
          {isBackfillMode 
            ? 'Fill in data for a previous day'
            : editingCheckIn 
              ? 'Update your check-in details' 
              : 'How are you feeling today?'}
        </p>
      </div>

      {/* Date Picker */}
      <CheckInDatePicker 
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        hasExistingData={hasExistingData}
      />

      {/* Editing indicator */}
      {editingCheckIn && (
        <div className="flex items-center justify-between glass-card-warm p-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/20">
              <Pencil className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold">
              {isBackfillMode 
                ? `Editing ${format(selectedDate, 'MMM d')} entry`
                : "Editing today's check-in"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the check-in for {format(selectedDate, 'EEEE, MMMM d')}. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCheckIn}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canSubmit && (
        <>
          {/* Mood Rating */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              How's your mood today?
            </h3>
            <div className="flex justify-between gap-2">
              {moodEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => setMood(idx + 1)}
                  className={cn(
                    'flex-1 py-4 text-2xl rounded-2xl transition-all duration-300',
                    mood === idx + 1 
                      ? 'bg-emerald-500/10 ring-2 ring-emerald-500/50 scale-110' 
                      : 'bg-muted/50 hover:bg-muted hover:scale-105'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Skin Feeling Rating */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.12s' }}>
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
                      ? 'bg-emerald-500/10 ring-2 ring-emerald-500/50 scale-105' 
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

          {/* Treatments */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              What did you do today?
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
                        <Check className="w-3 h-3 text-primary" />
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
                            <Check className="w-3 h-3 text-primary" />
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
              <AndroidSafeInput
                ref={customTreatmentRef}
                placeholder="Add your own treatment..."
                value={customTreatment}
                onValueChange={setCustomTreatment} 
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
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.18s' }}>
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
                const isSelected = selectedTriggers.includes(id);
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
            
            {/* Custom triggers as buttons */}
            {customTriggers.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {customTriggers.map((trigger) => {
                  const isSelected = selectedTriggers.includes(trigger);
                  return (
                    <div
                      key={trigger}
                      className={cn(
                        'relative py-2 px-3 text-sm font-medium rounded-full transition-all duration-200 flex items-center justify-between gap-1',
                        isSelected
                          ? 'bg-primary/5 ring-[1.5px] ring-primary text-foreground'
                          : 'bg-muted/50 text-muted-foreground/80 hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <button
                        onClick={() => toggleTrigger(trigger)}
                        className="flex-1 text-left truncate"
                      >
                        {trigger}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomTrigger(trigger);
                          setSelectedTriggers(prev => prev.filter(t => t !== trigger));
                        }}
                        className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title="Remove trigger"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Custom trigger input */}
            <div className="flex gap-2">
              <AndroidSafeInput
                ref={customTriggerRef}
                placeholder="Add your own trigger..."
                value={customTriggerInput}
                onValueChange={setCustomTriggerInput} 
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTrigger()}
                className="flex-1 h-11 rounded-xl border-2"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddCustomTrigger}
                disabled={!customTriggerInput.trim()}
                className="h-11 w-11 rounded-xl"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Select anything that might have contributed. Patterns are assessed over time.
            </p>
          </div>

          {/* Food Diary Section (Optional) - Collapsible */}
          <div className="space-y-3 animate-slide-up relative z-30" style={{ animationDelay: '0.19s' }}>
            <button
              type="button"
              onClick={() => setIsFoodDiaryOpen(!isFoodDiaryOpen)}
              className="flex items-center gap-2 w-full group"
            >
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <UtensilsCrossed className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-display font-bold text-lg text-foreground">
                  Food Diary
                  <span className="text-xs font-normal text-muted-foreground ml-2">(optional)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Track foods to find patterns in your skin reactions
                </p>
              </div>
              <div className="flex items-center gap-2">
                {foodItems.length > 0 && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                    {foodItems.length} logged
                  </span>
                )}
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200",
                  isFoodDiaryOpen && "rotate-180"
                )} />
              </div>
            </button>
            
            {/* Collapsible content */}
            <div className={cn(
              "overflow-hidden transition-all duration-200 ease-out",
              isFoodDiaryOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            )}>
              <div className="space-y-3 pt-1">
                {/* Food items chips */}
                {foodItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {foodItems.map((food) => (
                      <span
                        key={food}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium"
                      >
                        🍽️ {food}
                        <button
                          type="button"
                          onClick={() => handleRemoveFoodItem(food)}
                          className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Quick food suggestions */}
                {filteredFoodSuggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {recentFoods.length > 0 && foodInputText === '' ? 'Recent & common foods:' : 'Suggestions:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredFoodSuggestions.map((suggestion) => {
                        const isRecent = recentFoods.includes(suggestion);
                        return (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              if (!foodItems.includes(suggestion)) {
                                setFoodItems((prev) => [...prev, suggestion]);
                              }
                            }}
                            className={cn(
                              "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                              isRecent
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {isRecent && <span className="mr-1">🕐</span>}
                            {suggestion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Food input */}
                <div className="flex gap-2 relative z-20">
                  <AndroidSafeInput
                    ref={foodInputRef}
                    placeholder="Type to search or add custom food..."
                    value={foodInputText}
                    onValueChange={(val) => {
                      setFoodInputText(val);
                      setShowFoodSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddFoodItem();
                      }
                    }}
                    onFocus={() => setShowFoodSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowFoodSuggestions(false), 150)}
                    className="flex-1 h-10 rounded-xl border-2 border-amber-200 dark:border-amber-800/50 focus:border-amber-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddFoodItem}
                    disabled={!foodInputText.trim()}
                    className="h-10 w-10 rounded-xl border-amber-200 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  >
                    <Plus className="w-4 h-4 text-amber-600" />
                  </Button>
                  
                  {/* Autocomplete dropdown */}
                  {showFoodSuggestions && foodInputText.trim() && filteredFoodSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-12 mt-1 bg-background border border-amber-200 dark:border-amber-800 rounded-xl shadow-xl z-[100] overflow-hidden">
                      {filteredFoodSuggestions.slice(0, 5).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFoodItems((prev) => [...prev, suggestion]);
                            setFoodInputText('');
                            setShowFoodSuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2"
                        >
                          {recentFoods.includes(suggestion) && <span className="text-xs">🕐</span>}
                          <span>{suggestion}</span>
                          {recentFoods.includes(suggestion) && (
                            <span className="text-[10px] text-muted-foreground ml-auto">recent</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <p className="text-[10px] text-muted-foreground/70">
                  Foods you log appear in Insights → Food Breakdown to show correlations with your skin
                </p>
              </div>
            </div>
          </div>

          {/* Product Diary Section (Optional) - Collapsible */}
          <div className="space-y-3 animate-slide-up relative z-20" style={{ animationDelay: '0.195s' }}>
            <button
              type="button"
              onClick={() => setIsProductDiaryOpen(!isProductDiaryOpen)}
              className="flex items-center gap-2 w-full group"
            >
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-display font-bold text-lg text-foreground">
                  Product Diary
                  <span className="text-xs font-normal text-muted-foreground ml-2">(optional)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Track new products to find patterns in your skin reactions
                </p>
              </div>
              <div className="flex items-center gap-2">
                {productItems.length > 0 && (
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                    {productItems.length} logged
                  </span>
                )}
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200",
                  isProductDiaryOpen && "rotate-180"
                )} />
              </div>
            </button>
            
            {/* Collapsible content */}
            <div className={cn(
              "overflow-hidden transition-all duration-200 ease-out",
              isProductDiaryOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            )}>
              <div className="space-y-3 pt-1">
                {/* Product items chips */}
                {productItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {productItems.map((product) => (
                      <span
                        key={product}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium"
                      >
                        🧴 {product}
                        <button
                          type="button"
                          onClick={() => handleRemoveProductItem(product)}
                          className="p-0.5 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Quick product suggestions */}
                {filteredProductSuggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {recentProducts.length > 0 && productInputText === '' ? 'Recent & common products:' : 'Suggestions:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredProductSuggestions.map((suggestion) => {
                        const isRecent = recentProducts.includes(suggestion);
                        return (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              if (!productItems.includes(suggestion)) {
                                setProductItems((prev) => [...prev, suggestion]);
                              }
                            }}
                            className={cn(
                              "px-2.5 py-1 text-xs font-medium rounded-full transition-all",
                              isRecent
                                ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700"
                                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {isRecent && <span className="mr-1">🕐</span>}
                            {suggestion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Product input */}
                <div className="flex gap-2 relative">
                  <AndroidSafeInput
                    ref={productInputRef}
                    placeholder="Type to search or add custom product..."
                    value={productInputText}
                    onValueChange={setProductInputText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddProductItem();
                      }
                    }}
                    className="flex-1 h-10 rounded-xl border-2 border-purple-200 dark:border-purple-800/50 focus:border-purple-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddProductItem}
                    disabled={!productInputText.trim()}
                    className="h-10 w-10 rounded-xl border-purple-200 dark:border-purple-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <Plus className="w-4 h-4 text-purple-600" />
                  </Button>
                </div>
                
                <p className="text-[10px] text-muted-foreground/70">
                  Products you log appear in Insights → Product Breakdown to show correlations with your skin
                </p>
              </div>
            </div>
          </div>

          {/* Symptoms experienced today */}
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                Symptoms
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Select and rate severity: <span className="text-yellow-600">mild</span>, <span className="text-orange-500">moderate</span>, or <span className="text-red-500">severe</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {symptomsList.map((symptom) => {
                const selected = isSymptomSelected(symptom);
                const severity = getSymptomSeverity(symptom);
                const isExpanded = expandedSymptom === symptom;
                
                return (
                  <div
                    key={symptom}
                    className={cn(
                      'relative flex items-center rounded-xl transition-all duration-200 min-h-[46px] overflow-hidden',
                      selected
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'bg-muted/50 hover:bg-muted'
                    )}
                  >
                    <button
                      onClick={() => handleSymptomTap(symptom)}
                      className={cn(
                        'flex-1 min-w-0 px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-between gap-2',
                        selected
                          ? 'text-foreground'
                          : 'text-muted-foreground/80 hover:text-foreground'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        {selected && (
                          <span className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            severityColors.bg[severity]
                          )} />
                        )}
                        <span className="truncate text-left">{symptom}</span>
                      </span>
                      {selected && !isExpanded && (
                        <span className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
                          severity === 1 ? 'bg-yellow-200/80 text-yellow-800' :
                          severity === 2 ? 'bg-orange-200/80 text-orange-800' :
                          'bg-red-200/80 text-red-800'
                        )}>
                          {severityLabels[severity]}
                        </span>
                      )}
                    </button>
                    
                    {/* Inline severity selector - only show when expanded */}
                    {selected && isExpanded && (
                      <div className="flex items-center gap-1 pr-2 border-l border-primary/30 pl-2 flex-shrink-0">
                        {([1, 2, 3] as const).map((level) => (
                          <button
                            key={level}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSymptomSeverity(symptom, level);
                            }}
                            className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center transition-all',
                              severity === level
                                ? severityColors.bg[level]
                                : 'bg-muted/80 hover:bg-muted'
                            )}
                            title={severityLabels[level]}
                          >
                            <span className={cn(
                              'w-2 h-2 rounded-full',
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
                          className="ml-1 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sleep Quality */}
          <div className="space-y-3 animate-slide-up" style={{ animationDelay: '0.22s' }}>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                How was your sleep?
              </h3>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Overall sleep quality, including waking from symptoms.
              </p>
            </div>
            <div className="flex gap-1.5">
              {sleepOptions.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  onClick={() => setSleepScore(sleepScore === value ? null : value)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl transition-all duration-200 flex flex-col items-center gap-0.5',
                    sleepScore === value
                      ? 'bg-emerald-500/10 ring-2 ring-emerald-500/50 scale-105'
                      : 'bg-muted/50 hover:bg-muted hover:scale-102'
                  )}
                >
                  <span className="text-lg">{emoji}</span>
                  <span className={cn(
                    'text-[9px] font-medium leading-tight',
                    sleepScore === value
                      ? 'text-emerald-700 dark:text-emerald-500'
                      : 'text-muted-foreground/70'
                  )}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Pain Scale */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <h3 className="font-display font-bold text-lg text-foreground">
              Pain level today
            </h3>
            <div className="px-1">
              {/* Custom slider with colored thumb */}
              <div className="relative pt-2 pb-1">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={painScore ?? 5}
                  onChange={(e) => setPainScore(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer"
                  style={{
                    WebkitAppearance: 'none',
                    background: 'hsl(var(--muted))',
                  }}
                />
                {/* Custom thumb overlay */}
                <style>{`
                  input[type='range']::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                    background: ${
                      painScore === null ? 'hsl(var(--muted-foreground))' :
                      painScore <= 2 ? '#fde047' :
                      painScore <= 4 ? '#fbbf24' :
                      painScore <= 6 ? '#f97316' :
                      painScore <= 8 ? '#ef4444' :
                      '#b91c1c'
                    };
                  }
                  input[type='range']::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                    background: ${
                      painScore === null ? 'hsl(var(--muted-foreground))' :
                      painScore <= 2 ? '#fde047' :
                      painScore <= 4 ? '#fbbf24' :
                      painScore <= 6 ? '#f97316' :
                      painScore <= 8 ? '#ef4444' :
                      '#b91c1c'
                    };
                  }
                `}</style>
              </div>
              {/* Display current value */}
              {painScore !== null && (
                <div className="text-center mb-2">
                  <span className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold',
                    painScore <= 2 ? 'bg-yellow-300 text-yellow-900' :
                    painScore <= 4 ? 'bg-amber-400 text-amber-950' :
                    painScore <= 6 ? 'bg-orange-500 text-white' :
                    painScore <= 8 ? 'bg-red-500 text-white' :
                    'bg-red-700 text-white'
                  )}>
                    {painScore}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>No pain</span>
                <span>Worst pain imaginable</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Includes skin pain, burning, or soreness.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.28s' }}>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                {isBackfillMode ? 'Notes for this day (optional)' : "Today's notes (optional)"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your AI Coach uses these notes to give you personalised advice
              </p>
            </div>
            <AndroidSafeTextarea 
              ref={notesRef}
              placeholder={isBackfillMode 
                ? "What do you remember about this day?" 
                : "Anything specific happen today? Dive deeper into anything you think is important..."}
              value={notes}
              onValueChange={setNotes}
              rows={3}
              className="rounded-2xl border-2 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              variant="default"
              className="w-full h-12 text-base"
              size="lg"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {editingCheckIn 
                    ? (isBackfillMode ? 'Update Entry' : 'Update Check-in')
                    : (isBackfillMode ? 'Save Entry' : 'Save Check-in')}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CheckInPage;
