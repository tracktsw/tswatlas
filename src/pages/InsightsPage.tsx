import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Calendar, Heart, ChevronLeft, ChevronRight, Sparkles, Eye, Pencil, Crown, Loader2, Flame, Activity, CalendarDays, Moon, Wand2, Trash2, RotateCcw, RefreshCw, AlertTriangle, CheckCircle, Lock, FileDown } from 'lucide-react';
import { useUserData, BodyPart, CheckIn } from '@/contexts/UserDataContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { format, subDays, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isSameMonth, addMonths, subMonths, getDay, setMonth, setYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentRouter } from '@/hooks/usePaymentRouter';
import { getTermsUrl, PRIVACY_POLICY_URL, type Platform } from '@/utils/platformLinks';
import { PlantIllustration, SparkleIllustration, SunIllustration } from '@/components/illustrations';
import DemoEditModal from '@/components/DemoEditModal';
import SymptomsInsights from '@/components/SymptomsInsights';
import TriggerPatternsInsights from '@/components/TriggerPatternsInsights';
import SleepTrendsInsights from '@/components/SleepTrendsInsights';
import PainTrendsInsights from '@/components/PainTrendsInsights';
import MoodTrendsInsights from '@/components/MoodTrendsInsights';
import WhatHelpedInsights from '@/components/WhatHelpedInsights';
import { FlareStatusBadge } from '@/components/FlareStatusBadge';
import { severityColors, severityLabels } from '@/constants/severityColors';
import { toast } from 'sonner';
import { useFlareState } from '@/hooks/useFlareState';
import { InsightsPageSkeleton } from '@/components/skeletons/PageSkeletons';
import { trackInsightsClicked } from '@/utils/analytics';
import ExportDataModal from '@/components/ExportDataModal';
import PaywallGuard from '@/components/PaywallGuard';
import LockedInsightsPreview from '@/components/insights/LockedInsightsPreview';

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];
const skinEmojis = ['🔴', '🟠', '🟡', '🟢', '💚'];
const sleepEmojis = ['😫', '😪', '😐', '😌', '😴'];

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

const bodyParts: { value: BodyPart; label: string; emoji: string }[] = [
  { value: 'face', label: 'Face', emoji: '😊' },
  { value: 'neck', label: 'Neck', emoji: '🦒' },
  { value: 'arms', label: 'Arms', emoji: '💪' },
  { value: 'hands', label: 'Hands', emoji: '🤲' },
  { value: 'legs', label: 'Legs', emoji: '🦵' },
  { value: 'feet', label: 'Feet', emoji: '🦶' },
  { value: 'torso', label: 'Torso', emoji: '👕' },
  { value: 'back', label: 'Back', emoji: '🔙' },
];

const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/fZudR12RBaH1cEveGH1gs01';

// AI Coach Button Component
const AICoachButton = ({ isPremium }: { isPremium: boolean }) => {
  const navigate = useNavigate();
  const { startPurchase, isPurchasing, isNative, isOfferingsReady, priceString } = usePaymentRouter();

  const handleClick = async () => {
    if (isPremium) {
      navigate('/coach');
    } else {
      await startPurchase();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="animate-slide-up"
      style={{ animationDelay: '0.05s' }}
    >
      <button
        onClick={handleClick}
        disabled={isPurchasing || (!isPremium && isNative && !isOfferingsReady)}
        className={cn(
          "w-full glass-card p-4 flex items-center gap-4 transition-all duration-200",
          isPremium 
            ? "hover:shadow-warm-md active:scale-[0.98] cursor-pointer" 
            : "cursor-pointer hover:shadow-md"
        )}
      >
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-warm-sm",
          isPremium 
            ? "bg-gradient-to-br from-coral/20 to-coral-light" 
            : "bg-muted/50"
        )}>
          {isPremium ? (
            <Sparkles className="w-6 h-6 text-coral" />
          ) : (
            <Lock className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-foreground">AI Coach</h3>
            {!isPremium && (
              <span className="text-xs bg-honey/20 text-honey-dark px-2 py-0.5 rounded-full font-medium">
                Premium
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isPremium 
              ? "Get personalized insights from your data" 
              : "Unlock personalized skin guidance"}
          </p>
        </div>
        <ChevronRight className={cn(
          "w-5 h-5",
          isPremium ? "text-coral" : "text-muted-foreground"
        )} />
      </button>
    </motion.div>
  );
};

const InsightsPage = () => {
  const { checkIns: realCheckIns, photos } = useUserData();
  const { isDemoMode, isAdmin, getEffectiveCheckIns, demoCheckIns, generateSampleData, clearDemoData } = useDemoMode();
  const { isPremium: isPremiumFromBackend, isLoading: isBackendLoading, refreshSubscription } = useSubscription();
  const {
    platform,
    isNative,
    isPurchasing,
    isRestoring,
    statusMessage,
    isOfferingsReady,
    priceString,
    isTrialEligible,
    startPurchase,
    restorePurchases,
    retryOfferings,
    isUserLoggedIn,
    isRevenueCatLoading,
  } = usePaymentRouter();
  const { baselineConfidence, dailyFlareStates } = useFlareState();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [demoEditDate, setDemoEditDate] = useState<Date | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  
  // Track insights page view (once per session)
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (!hasTrackedRef.current && !isBackendLoading) {
      trackInsightsClicked('insights_page', 'navigation');
      hasTrackedRef.current = true;
    }
  }, [isBackendLoading]);

  // Auto-show paywall modal after 2 seconds for free users
  useEffect(() => {
    if (!isBackendLoading && !isPremiumFromBackend && !isAdmin && realCheckIns.length > 0) {
      const timer = setTimeout(() => setPaywallOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isBackendLoading, isPremiumFromBackend, isAdmin, realCheckIns.length]);

  // Premium is enforced by backend for ALL platforms.
  const isPremium = isAdmin || isPremiumFromBackend;
  const isSubscriptionLoading = isBackendLoading;

  const handleUpgrade = async () => {
    await startPurchase();
  };

  const handleRestore = async () => {
    await restorePurchases();
  };

  const handleRetryOfferings = async () => {
    await retryOfferings();
  };
  
  // Use effective check-ins (real + demo overrides when in demo mode)
  const checkIns = useMemo(() => getEffectiveCheckIns(realCheckIns), [realCheckIns, getEffectiveCheckIns]);
  
  const last7Days = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, 6);
    return eachDayOfInterval({ start, end });
  }, []);

  const weeklyData = useMemo(() => {
    return last7Days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayCheckIns = checkIns.filter((c) => format(new Date(c.timestamp), 'yyyy-MM-dd') === dateStr);
      const avgMood = dayCheckIns.length 
        ? dayCheckIns.reduce((sum, c) => sum + c.mood, 0) / dayCheckIns.length 
        : 0;
      const avgSkin = dayCheckIns.length 
        ? dayCheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / dayCheckIns.length 
        : 0;
      const painScores = dayCheckIns.filter(c => c.painScore !== null && c.painScore !== undefined);
      const avgPain = painScores.length 
        ? Math.round(painScores.reduce((sum, c) => sum + (c.painScore || 0), 0) / painScores.length)
        : null;
      const sleepScores = dayCheckIns.filter(c => c.sleepScore !== null && c.sleepScore !== undefined);
      const avgSleep = sleepScores.length 
        ? Math.round(sleepScores.reduce((sum, c) => sum + (c.sleepScore || 0), 0) / sleepScores.length)
        : null;
      
      return {
        date,
        dateStr,
        checkIns: dayCheckIns.length,
        avgMood,
        avgSkin,
        avgPain,
        avgSleep,
      };
    });
  }, [checkIns, last7Days]);

  const treatmentStats = useMemo(() => {
    const stats: Record<string, { count: number; goodDays: number }> = {};
    
    // Collect all treatments from check-ins (including custom ones)
    checkIns.forEach(checkIn => {
      checkIn.treatments.forEach(t => {
        if (!stats[t]) {
          stats[t] = { count: 0, goodDays: 0 };
        }
        stats[t].count++;
        if (checkIn.skinFeeling >= 4) {
          stats[t].goodDays++;
        }
      });
    });
    
    return Object.entries(stats)
      .filter(([_, data]) => data.count > 0)
      .map(([id, data]) => ({
        id,
        label: treatments.find(t => t.id === id)?.label || id,
        count: data.count,
        effectiveness: data.count > 0 ? Math.round((data.goodDays / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);
  }, [checkIns]);

  const photosByBodyPart = useMemo(() => {
    const counts: Record<BodyPart, number> = {
      face: 0, neck: 0, arms: 0, hands: 0, legs: 0, feet: 0, torso: 0, back: 0
    };
    photos.forEach(p => {
      counts[p.bodyPart]++;
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [photos]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding for first week
    const startPadding = getDay(start);
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);
    
    return [...paddedDays, ...days];
  }, [calendarMonth]);

  const getCheckInsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return checkIns.filter((c) => format(new Date(c.timestamp), 'yyyy-MM-dd') === dateStr);
  };

  const getPhotosForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return photos.filter((p) => format(new Date(p.timestamp), 'yyyy-MM-dd') === dateStr);
  };

  const selectedDayCheckIns = selectedDate ? getCheckInsForDate(selectedDate) : [];
  const selectedDayPhotos = selectedDate ? getPhotosForDate(selectedDate) : [];

  // Show skeleton while subscription is loading to prevent premium UI flash
  if (isSubscriptionLoading) {
    return <InsightsPageSkeleton />;
  }

  if (checkIns.length === 0) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto relative">
        {/* Decorative elements */}
        <div className="decorative-blob w-36 h-36 bg-honey/25 -top-10 -right-10 fixed" />
        <div className="decorative-blob w-44 h-44 bg-primary/20 bottom-32 -left-16 fixed" />
        
        {/* Decorative illustrations */}
        <SunIllustration variant="rays" className="w-20 h-20 fixed top-20 right-4 opacity-25 pointer-events-none" />
        
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">Insights</h1>
          <p className="text-muted-foreground">Track your healing patterns</p>
        </div>
        <div className="glass-card-warm p-8 text-center animate-slide-up relative overflow-hidden">
          <PlantIllustration variant="sprout" className="w-16 h-16 absolute -left-2 -bottom-2 opacity-20" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-honey/20 to-coral-light flex items-center justify-center animate-float relative">
            <BarChart3 className="w-8 h-8 text-honey" />
          </div>
          <p className="font-display font-bold text-lg text-foreground">No data yet</p>
          <p className="text-muted-foreground mt-1">
            Start doing daily check-ins to see your insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto relative">
      {/* Decorative elements */}
      <div className="decorative-blob w-36 h-36 bg-honey/25 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-44 h-44 bg-primary/20 bottom-32 -left-16 fixed" />
      
      {/* Decorative illustrations */}
      <PlantIllustration variant="growing" className="w-20 h-24 fixed top-20 right-0 opacity-25 pointer-events-none" />
      <SparkleIllustration variant="cluster" className="w-16 h-16 fixed bottom-48 left-2 opacity-20 pointer-events-none animate-pulse-soft" />
      
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">Insights</h1>
              {isDemoMode && isAdmin && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <Eye className="w-3 h-3 mr-1" />
                  Demo Preview
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Your healing patterns</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)}>
            {isPremium ? <FileDown className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            Export
          </Button>
        </div>
        
        {/* Demo Mode Controls */}
        {isDemoMode && isAdmin && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => {
                generateSampleData(30);
                toast.success('Generated 30 days of sample data');
              }}
            >
              <Wand2 className="w-3.5 h-3.5" />
              30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => {
                generateSampleData(365);
                toast.success('Generated 365 days of sample data');
              }}
            >
              <Wand2 className="w-3.5 h-3.5" />
              365 Days
            </Button>
            {demoCheckIns.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  clearDemoData();
                  toast.success('Cleared all demo data');
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Demo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Flare Status Badge */}
      <FlareStatusBadge />

      {/* AI Coach Button */}
      <AICoachButton isPremium={isPremium} />

      {/* Weekly Overview */}
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-honey/20">
            <Calendar className="w-4 h-4 text-honey" />
          </div>
          Last 7 Days
        </h3>
        <div className="glass-card p-5">
          <div className="flex justify-between gap-2">
            {weeklyData.map(({ date, avgMood, avgSkin, avgPain, avgSleep, checkIns: count }, index) => {
              return (
                <div 
                  key={date.toISOString()} 
                  className={cn(
                    "flex-1 text-center animate-scale-in relative",
                    isDemoMode && isAdmin && "cursor-pointer hover:opacity-80"
                  )}
                  style={{ animationDelay: `${0.15 + index * 0.03}s` }}
                  onClick={() => {
                    if (isDemoMode && isAdmin) {
                      setDemoEditDate(date);
                    }
                  }}
                >
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    {format(date, 'EEE')}
                  </p>
                  <div className={cn(
                    'aspect-square rounded-2xl flex flex-col items-center justify-center text-lg mb-1.5 transition-all duration-300',
                    count > 0 
                      ? 'bg-gradient-to-br from-primary/15 to-sage-light/50 shadow-warm-sm' 
                      : 'bg-muted/50'
                  )}>
                    {count > 0 ? skinEmojis[Math.round(avgSkin) - 1] || '—' : '—'}
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {avgPain !== null && (
                        <span 
                          title={`Pain: ${avgPain}/10`}
                          className={cn(
                            'text-[8px] font-bold px-1 py-0 rounded-full leading-tight',
                            avgPain <= 2 ? 'bg-yellow-200 text-yellow-900' :
                            avgPain <= 4 ? 'bg-amber-300 text-amber-900' :
                            avgPain <= 6 ? 'bg-orange-400 text-white' :
                            avgPain <= 8 ? 'bg-red-500 text-white' :
                            'bg-red-700 text-white'
                          )}
                        >
                          {avgPain}
                        </span>
                      )}
                      {avgSleep !== null && (
                        <span 
                          title={`Sleep: ${['Very poor', 'Poor', 'Okay', 'Good', 'Very good'][avgSleep - 1]}`}
                          className="text-[9px] leading-none"
                        >
                          {sleepEmojis[avgSleep - 1]}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm">
                    {count > 0 ? moodEmojis[Math.round(avgMood) - 1] : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Premium Features Section */}
      <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
        {isPremium ? (
          <div className="space-y-6">
            <WhatHelpedInsights checkIns={checkIns} />
            <TriggerPatternsInsights checkIns={checkIns} baselineConfidence={baselineConfidence} />
            <SymptomsInsights checkIns={checkIns} />
            <MoodTrendsInsights checkIns={checkIns} dailyFlareStates={dailyFlareStates} />
            <SleepTrendsInsights checkIns={checkIns} dailyFlareStates={dailyFlareStates} />
            <PainTrendsInsights checkIns={checkIns} dailyFlareStates={dailyFlareStates} />
          </div>
        ) : !isSubscriptionLoading ? (
          <LockedInsightsPreview checkIns={checkIns} />
        ) : null}
      </div>

      {/* Paywall Modal - auto-opens after 2s for free users */}
      {!isPremium && !isSubscriptionLoading && (
        <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
          <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none [&>button]:z-50">
            <PaywallGuard feature="Insights">
              <div />
            </PaywallGuard>
          </DialogContent>
        </Dialog>
      )}

      {/* Calendar Button - Premium only */}
      {isPremium && (
        <Dialog open={!!selectedDate || calendarOpen} onOpenChange={(open) => {
          if (!open) {
            setSelectedDate(null);
            setCalendarOpen(false);
          }
        }}>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 hover:shadow-warm transition-all duration-300 mt-4"
            onClick={() => setCalendarOpen(true)}
          >
            <Calendar className="w-5 h-5" />
            View Flare Calendar
          </Button>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Flare Calendar'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedDate ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} className="mb-2 rounded-xl">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to calendar
                </Button>
                {selectedDayCheckIns.length > 0 ? (
                  selectedDayCheckIns.map((checkIn, idx) => (
                    <div key={idx} className="p-4 bg-muted/50 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground font-medium">
                          {format(new Date(checkIn.timestamp), 'h:mm a')}
                        </span>
                        <div className="flex gap-2 items-center">
                          <span title="Mood" className="text-lg">{moodEmojis[checkIn.mood - 1]}</span>
                          <span title="Skin" className="text-lg">{skinEmojis[checkIn.skinFeeling - 1]}</span>
                          {checkIn.sleepScore !== null && checkIn.sleepScore !== undefined && (
                            <span title={`Sleep: ${['Very poor', 'Poor', 'Okay', 'Good', 'Very good'][checkIn.sleepScore - 1]}`} className="text-lg">
                              {sleepEmojis[checkIn.sleepScore - 1]}
                            </span>
                          )}
                          {checkIn.painScore !== null && checkIn.painScore !== undefined && (
                            <span 
                              title="Pain" 
                              className={cn(
                                'text-xs font-medium px-2 py-0.5 rounded-full',
                                checkIn.painScore <= 2 ? 'bg-yellow-200 text-yellow-900' :
                                checkIn.painScore <= 4 ? 'bg-amber-300 text-amber-900' :
                                checkIn.painScore <= 6 ? 'bg-orange-400 text-white' :
                                checkIn.painScore <= 8 ? 'bg-red-500 text-white' :
                                'bg-red-700 text-white'
                              )}
                            >
                              {checkIn.painScore}/10
                            </span>
                          )}
                        </div>
                      </div>
                      {checkIn.treatments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {checkIn.treatments.map(t => (
                            <Badge key={t} variant="secondary" className="text-xs rounded-full">
                              {treatments.find(tr => tr.id === t)?.label || t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {checkIn.symptomsExperienced && checkIn.symptomsExperienced.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-1.5">Symptoms</p>
                          <div className="flex flex-wrap gap-1.5">
                            {checkIn.symptomsExperienced.map(entry => {
                              const colorClass = severityColors.badgeOutline[entry.severity as 1 | 2 | 3] || severityColors.badgeOutline[2];
                              return (
                                <Badge 
                                  key={entry.symptom} 
                                  variant="outline" 
                                  className={cn('text-xs rounded-full', colorClass)}
                                >
                                  <span className={cn(
                                    'w-1.5 h-1.5 rounded-full mr-1',
                                    severityColors.bg[entry.severity as 1 | 2 | 3]
                                  )} />
                                  {entry.symptom}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {checkIn.notes && (
                        <p className="text-sm text-muted-foreground italic">"{checkIn.notes}"</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No check-ins this day</p>
                )}
                
                {selectedDayPhotos.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2">Photos ({selectedDayPhotos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedDayPhotos.map((photo, idx) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden shadow-warm-sm">
                          <img 
                            src={photo.photoUrl} 
                            alt={photo.bodyPart}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Month Navigation */}
                <div className="flex items-center justify-between">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-1">
                    <Select 
                      value={calendarMonth.getMonth().toString()} 
                      onValueChange={(val) => setCalendarMonth(prev => setMonth(prev, parseInt(val)))}
                    >
                      <SelectTrigger className="h-8 w-auto min-w-[100px] text-sm font-semibold focus:ring-0 focus:ring-offset-0 gap-1 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {format(new Date(2000, i, 1), 'MMMM')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={calendarMonth.getFullYear().toString()} 
                      onValueChange={(val) => setCalendarMonth(prev => setYear(prev, parseInt(val)))}
                    >
                      <SelectTrigger className="h-8 w-auto min-w-[70px] text-sm font-semibold focus:ring-0 focus:ring-offset-0 gap-1 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.from({ length: new Date().getFullYear() - 2000 + 2 }, (_, i) => 2000 + i).map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}
                    disabled={isSameMonth(calendarMonth, new Date())}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Day Labels */}
                <div className="grid grid-cols-7 gap-1">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="text-center text-xs text-muted-foreground font-semibold">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((date, idx) => {
                    if (!date) {
                      return <div key={`empty-${idx}`} className="aspect-square" />;
                    }
                    
                    const dayCheckIns = getCheckInsForDate(date);
                    const dayPhotos = getPhotosForDate(date);
                    const hasData = dayCheckIns.length > 0 || dayPhotos.length > 0;
                    const isToday = isSameDay(date, new Date());
                    const avgSkin = dayCheckIns.length 
                      ? Math.round(dayCheckIns.reduce((sum, c) => sum + c.skinFeeling, 0) / dayCheckIns.length)
                      : 0;
                    const avgMood = dayCheckIns.length 
                      ? Math.round(dayCheckIns.reduce((sum, c) => sum + c.mood, 0) / dayCheckIns.length)
                      : 0;
                    const painScores = dayCheckIns.filter(c => c.painScore !== null && c.painScore !== undefined);
                    const avgPain = painScores.length 
                      ? Math.round(painScores.reduce((sum, c) => sum + (c.painScore || 0), 0) / painScores.length)
                      : null;
                    const sleepScores = dayCheckIns.filter(c => c.sleepScore !== null && c.sleepScore !== undefined);
                    const avgSleep = sleepScores.length 
                      ? Math.round(sleepScores.reduce((sum, c) => sum + (c.sleepScore || 0), 0) / sleepScores.length)
                      : null;
                    
                    // Check if this date has demo data
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const hasDemoData = isDemoMode && isAdmin && demoCheckIns.has(dateStr);
                    
                    // In demo mode, calendar dates are always clickable for editing
                    const isClickable = hasData || (isDemoMode && isAdmin);
                    
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => {
                          if (isDemoMode && isAdmin) {
                            // In demo mode, clicking opens demo editor
                            setCalendarOpen(false);
                            setDemoEditDate(date);
                          } else if (hasData) {
                            setSelectedDate(date);
                          }
                        }}
                        disabled={!isClickable}
                        className={cn(
                          'aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-all duration-300 relative p-0.5',
                          isClickable ? 'hover:bg-coral/20 hover:shadow-warm-sm cursor-pointer' : 'cursor-default',
                          isToday && 'ring-2 ring-coral',
                          hasData && 'bg-gradient-to-br from-primary/10 to-sage-light/30',
                          hasDemoData && 'ring-2 ring-amber-500/50'
                        )}
                      >
                        <span className={cn(
                          'font-semibold text-[11px]',
                          hasData || (isDemoMode && isAdmin) ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                          {format(date, 'd')}
                        </span>
                        {hasData && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {avgMood > 0 && (
                              <span className="text-[9px] leading-none" title="Mood">{moodEmojis[avgMood - 1]}</span>
                            )}
                            {avgSkin > 0 && (
                              <span className="text-[9px] leading-none" title="Skin">{skinEmojis[avgSkin - 1]}</span>
                            )}
                            {avgSleep !== null && (
                              <span className="text-[9px] leading-none" title={`Sleep: ${['Very poor', 'Poor', 'Okay', 'Good', 'Very good'][avgSleep - 1]}`}>
                                {sleepEmojis[avgSleep - 1]}
                              </span>
                            )}
                          </div>
                        )}
                        {avgPain !== null && (
                          <span 
                            title={`Pain: ${avgPain}/10`}
                            className={cn(
                              'text-[7px] font-bold px-1 py-0 rounded-full mt-0.5 leading-tight',
                              avgPain <= 2 ? 'bg-yellow-200 text-yellow-900' :
                              avgPain <= 4 ? 'bg-amber-300 text-amber-900' :
                              avgPain <= 6 ? 'bg-orange-400 text-white' :
                              avgPain <= 8 ? 'bg-red-500 text-white' :
                              'bg-red-700 text-white'
                            )}
                          >
                            {avgPain}
                          </span>
                        )}
                        {/* Demo mode indicator */}
                        {hasDemoData && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">Legend</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-12">Mood:</span>
                      <div className="flex gap-1.5">
                        {moodEmojis.map((emoji, i) => (
                          <span key={i} title={['Very low', 'Low', 'Okay', 'Good', 'Great'][i]} className="text-sm">{emoji}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-12">Skin:</span>
                      <div className="flex gap-1.5">
                        {skinEmojis.map((emoji, i) => (
                          <span key={i} title={['Very bad', 'Bad', 'Okay', 'Good', 'Great'][i]} className="text-sm">{emoji}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-12">Pain:</span>
                      <div className="flex gap-1 items-center">
                        <span className="bg-yellow-200 text-yellow-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">1-2</span>
                        <span className="bg-amber-300 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">3-4</span>
                        <span className="bg-orange-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">5-6</span>
                        <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">7-8</span>
                        <span className="bg-red-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">9-10</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-12">Sleep:</span>
                      <div className="flex gap-1.5">
                        {sleepEmojis.map((emoji, i) => (
                          <span key={i} title={['Very poor', 'Poor', 'Okay', 'Good', 'Very good'][i]} className="text-sm">{emoji}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Stats Summary */}
      <div className="glass-card-warm p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h3 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          Summary
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-coral/10 to-coral-light/50 rounded-2xl shadow-warm-sm">
            <p className="text-3xl font-bold text-coral">{checkIns.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Total Check-ins</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-sage-light/50 rounded-2xl shadow-warm-sm">
            <p className="text-3xl font-bold text-primary">{photos.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Photos Taken</p>
          </div>
        </div>
      </div>


      {/* Demo Edit Modal - Only for admin in demo mode */}
      {isDemoMode && isAdmin && demoEditDate && (
        <DemoEditModal
          open={!!demoEditDate}
          onOpenChange={(open) => !open && setDemoEditDate(null)}
          date={demoEditDate}
          existingMood={weeklyData.find(d => format(d.date, 'yyyy-MM-dd') === format(demoEditDate, 'yyyy-MM-dd'))?.avgMood}
          existingSkin={weeklyData.find(d => format(d.date, 'yyyy-MM-dd') === format(demoEditDate, 'yyyy-MM-dd'))?.avgSkin}
        />
      )}

      <ExportDataModal open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
};

export default InsightsPage;