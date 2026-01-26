import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, TrendingUp, Moon, Zap, Heart, ArrowRight, BarChart3, UtensilsCrossed, Package } from 'lucide-react';
import { CheckIn } from '@/contexts/UserDataContext';
import { format, subDays } from 'date-fns';
import { analyzeFoodReactions } from '@/utils/foodAnalysis';
import { analyzeProductReactions } from '@/utils/productAnalysis';

interface DailyInsightProps {
  checkIns: CheckIn[];
  isPremium?: boolean;
}

const MIN_CHECKINS_FOR_INSIGHT = 5;

// Insight generators - each returns an insight object or null if not applicable
const insightGenerators = [
  // Best treatment insight
  (checkIns: CheckIn[]) => {
    const treatmentEffectiveness: Record<string, { goodDays: number; totalDays: number }> = {};
    
    checkIns.forEach(checkIn => {
      const isGoodDay = checkIn.skinFeeling >= 4;
      checkIn.treatments.forEach(treatment => {
        if (!treatmentEffectiveness[treatment]) {
          treatmentEffectiveness[treatment] = { goodDays: 0, totalDays: 0 };
        }
        treatmentEffectiveness[treatment].totalDays++;
        if (isGoodDay) treatmentEffectiveness[treatment].goodDays++;
      });
    });

    const sorted = Object.entries(treatmentEffectiveness)
      .filter(([_, stats]) => stats.totalDays >= 3)
      .map(([treatment, stats]) => ({
        treatment,
        effectiveness: Math.round((stats.goodDays / stats.totalDays) * 100)
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);

    if (sorted.length === 0) return null;

    const best = sorted[0];
    const treatmentLabel = best.treatment.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    return {
      icon: Heart,
      iconColor: 'text-coral',
      bgColor: 'bg-coral/10',
      title: 'Your Top Treatment',
      message: `${treatmentLabel} is associated with ${best.effectiveness}% good skin days.`,
      cta: 'See all treatment insights',
      ctaLink: '/insights'
    };
  },

  // Sleep correlation insight
  (checkIns: CheckIn[]) => {
    const withSleep = checkIns.filter(c => c.sleepScore !== undefined && c.sleepScore !== null);
    if (withSleep.length < 5) return null;

    const goodSleep = withSleep.filter(c => (c.sleepScore ?? 0) >= 4);
    const goodSleepGoodSkin = goodSleep.filter(c => c.skinFeeling >= 4);
    
    if (goodSleep.length < 3) return null;
    
    const correlation = Math.round((goodSleepGoodSkin.length / goodSleep.length) * 100);
    
    if (correlation < 50) return null;

    return {
      icon: Moon,
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      title: 'Sleep & Skin Connection',
      message: `When you sleep well, you have ${correlation}% better skin days.`,
      cta: 'Explore sleep patterns',
      ctaLink: '/insights'
    };
  },

  // Weekly improvement insight
  (checkIns: CheckIn[]) => {
    const now = new Date();
    const oneWeekAgo = subDays(now, 7);
    const twoWeeksAgo = subDays(now, 14);

    const thisWeek = checkIns.filter(c => new Date(c.timestamp) >= oneWeekAgo);
    const lastWeek = checkIns.filter(c => {
      const date = new Date(c.timestamp);
      return date >= twoWeeksAgo && date < oneWeekAgo;
    });

    if (thisWeek.length < 3 || lastWeek.length < 3) return null;

    const thisWeekAvg = thisWeek.reduce((sum, c) => sum + c.skinFeeling, 0) / thisWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, c) => sum + c.skinFeeling, 0) / lastWeek.length;
    
    const improvement = thisWeekAvg - lastWeekAvg;
    
    if (improvement <= 0) return null;

    return {
      icon: TrendingUp,
      iconColor: 'text-sage',
      bgColor: 'bg-sage/10',
      title: 'You\'re Improving!',
      message: `Your skin is trending ${improvement.toFixed(1)} points better than last week.`,
      cta: 'View your full progress',
      ctaLink: '/insights'
    };
  },

  // Trigger awareness insight
  (checkIns: CheckIn[]) => {
    const triggerImpact: Record<string, { badDays: number; totalDays: number }> = {};
    
    checkIns.forEach(checkIn => {
      const isBadDay = checkIn.skinFeeling <= 2;
      checkIn.triggers.forEach(trigger => {
        // Skip food and product entries - they have their own dedicated insights
        if (trigger.startsWith('food:') || trigger.startsWith('product:') || trigger.startsWith('new_product:')) {
          return;
        }
        if (!triggerImpact[trigger]) {
          triggerImpact[trigger] = { badDays: 0, totalDays: 0 };
        }
        triggerImpact[trigger].totalDays++;
        if (isBadDay) triggerImpact[trigger].badDays++;
      });
    });

    const sorted = Object.entries(triggerImpact)
      .filter(([_, stats]) => stats.totalDays >= 3)
      .map(([trigger, stats]) => ({
        trigger,
        impact: Math.round((stats.badDays / stats.totalDays) * 100)
      }))
      .sort((a, b) => b.impact - a.impact);

    if (sorted.length === 0 || sorted[0].impact < 40) return null;

    const worst = sorted[0];
    const triggerLabel = worst.trigger.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    return {
      icon: Zap,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      title: 'Watch Out For',
      message: `${triggerLabel} appears on ${worst.impact}% of your tough skin days.`,
      cta: 'See all trigger patterns',
      ctaLink: '/insights'
    };
  },

  // Food diary insight - problematic foods
  (checkIns: CheckIn[]) => {
    const foodResults = analyzeFoodReactions(checkIns, 9999);
    
    // Find foods with "often_worse" pattern and at least medium confidence
    const problematicFoods = foodResults.filter(
      f => f.pattern === 'often_worse' && (f.confidence === 'high' || f.confidence === 'medium')
    );
    
    if (problematicFoods.length === 0) return null;
    
    const worst = problematicFoods[0];
    const worsePercent = worst.analyzableExposures > 0 
      ? Math.round((worst.daysWorseAfter / worst.analyzableExposures) * 100)
      : 0;
    
    if (worsePercent < 50) return null;
    
    return {
      icon: UtensilsCrossed,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      title: 'Food Pattern Detected',
      message: `${worst.name} was followed by worse symptoms ${worsePercent}% of the time.`,
      cta: 'View food diary analysis',
      ctaLink: '/insights'
    };
  },

  // Food diary insight - beneficial foods
  (checkIns: CheckIn[]) => {
    const foodResults = analyzeFoodReactions(checkIns, 9999);
    
    // Find foods with "often_better" pattern
    const beneficialFoods = foodResults.filter(
      f => f.pattern === 'often_better' && (f.confidence === 'high' || f.confidence === 'medium')
    );
    
    if (beneficialFoods.length === 0) return null;
    
    const best = beneficialFoods[0];
    const betterPercent = best.analyzableExposures > 0 
      ? Math.round((best.daysBetterAfter / best.analyzableExposures) * 100)
      : 0;
    
    if (betterPercent < 50) return null;
    
    return {
      icon: UtensilsCrossed,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      title: 'Helpful Food Found',
      message: `${best.name} was followed by improvement ${betterPercent}% of the time.`,
      cta: 'View food diary analysis',
      ctaLink: '/insights'
    };
  },

  // Product diary insight - problematic products
  (checkIns: CheckIn[]) => {
    const productResults = analyzeProductReactions(checkIns, 9999);
    
    // Find products with "often_worse" pattern
    const problematicProducts = productResults.filter(
      p => p.pattern === 'often_worse' && (p.confidence === 'high' || p.confidence === 'medium')
    );
    
    if (problematicProducts.length === 0) return null;
    
    const worst = problematicProducts[0];
    const worsePercent = worst.analyzableExposures > 0 
      ? Math.round((worst.daysWorseAfter / worst.analyzableExposures) * 100)
      : 0;
    
    if (worsePercent < 50) return null;
    
    return {
      icon: Package,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      title: 'Product Alert',
      message: `${worst.name} was followed by worse symptoms ${worsePercent}% of the time.`,
      cta: 'View product diary analysis',
      ctaLink: '/insights'
    };
  },

  // Product diary insight - beneficial products
  (checkIns: CheckIn[]) => {
    const productResults = analyzeProductReactions(checkIns, 9999);
    
    // Find products with "often_better" pattern
    const beneficialProducts = productResults.filter(
      p => p.pattern === 'often_better' && (p.confidence === 'high' || p.confidence === 'medium')
    );
    
    if (beneficialProducts.length === 0) return null;
    
    const best = beneficialProducts[0];
    const betterPercent = best.analyzableExposures > 0 
      ? Math.round((best.daysBetterAfter / best.analyzableExposures) * 100)
      : 0;
    
    if (betterPercent < 50) return null;
    
    return {
      icon: Package,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      title: 'Helpful Product Found',
      message: `${best.name} was followed by improvement ${betterPercent}% of the time.`,
      cta: 'View product diary analysis',
      ctaLink: '/insights'
    };
  },

  // Consistency insight
  (checkIns: CheckIn[]) => {
    const last30Days = subDays(new Date(), 30);
    const recent = checkIns.filter(c => new Date(c.timestamp) >= last30Days);
    
    const uniqueDays = new Set(recent.map(c => format(new Date(c.timestamp), 'yyyy-MM-dd'))).size;
    
    if (uniqueDays < 10) return null;

    return {
      icon: Lightbulb,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      title: 'Great Consistency!',
      message: `You've checked in ${uniqueDays} days this month. Keep building those insights!`,
      cta: 'Unlock deeper analysis',
      ctaLink: '/insights'
    };
  },
];

const DailyInsight = ({ checkIns, isPremium = false }: DailyInsightProps) => {
  const insight = useMemo(() => {
    if (checkIns.length < MIN_CHECKINS_FOR_INSIGHT) {
      return null;
    }

    // Generate a daily seed based on the current date
    const today = format(new Date(), 'yyyy-MM-dd');
    const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Collect all valid insights
    const validInsights = insightGenerators
      .map(generator => generator(checkIns))
      .filter((insight): insight is NonNullable<typeof insight> => insight !== null);

    if (validInsights.length === 0) return null;

    // Pick one based on the daily seed
    const selectedIndex = seed % validInsights.length;
    return validInsights[selectedIndex];
  }, [checkIns]);

  // Not enough data state
  if (checkIns.length < MIN_CHECKINS_FOR_INSIGHT) {
    const remaining = MIN_CHECKINS_FOR_INSIGHT - checkIns.length;
    
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_hsl(45_100%_60%_/_0.4)_0%,_transparent_70%)] blur-sm scale-150 animate-[pulse_3s_ease-in-out_infinite]" />
            <Lightbulb className="w-5 h-5 text-amber-500 relative z-10 animate-[pulse_3s_ease-in-out_infinite]" />
          </div>
          <h3 className="font-display font-bold text-lg text-anchor">Your Daily Insight</h3>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-muted/60">
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium">
              {checkIns.length === 0 
                ? "Start checking in to unlock personalized insights"
                : `${remaining} more check-in${remaining > 1 ? 's' : ''} to unlock your first insight`
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Daily check-ins help us understand your unique patterns and what works for your skin.
            </p>
            <Link 
              to="/check-in"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-3 hover:underline"
            >
              Check in now <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No valid insights generated
  if (!insight) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_hsl(45_100%_60%_/_0.4)_0%,_transparent_70%)] blur-sm scale-150 animate-[pulse_3s_ease-in-out_infinite]" />
            <Lightbulb className="w-5 h-5 text-amber-500 relative z-10 animate-[pulse_3s_ease-in-out_infinite]" />
          </div>
          <h3 className="font-display font-bold text-lg text-anchor">Your Daily Insight</h3>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-muted/60">
            <BarChart3 className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium">
              Not enough patterns detected yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Keep logging check-ins, foods, and products consistently. Meaningful insights emerge once we can identify reliable patterns in your data.
            </p>
            <Link 
              to="/check-in"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-3 hover:underline"
            >
              Log today's check-in <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const IconComponent = insight.icon;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_hsl(45_100%_60%_/_0.4)_0%,_transparent_70%)] blur-sm scale-150 animate-[pulse_3s_ease-in-out_infinite]" />
          <Lightbulb className="w-5 h-5 text-amber-500 relative z-10 animate-[pulse_3s_ease-in-out_infinite]" />
        </div>
        <h3 className="font-display font-bold text-lg text-anchor">Your Daily Insight</h3>
      </div>
      
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${insight.bgColor}`}>
          <IconComponent className={`w-6 h-6 ${insight.iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{insight.message}</p>
          <Link 
            to={insight.ctaLink}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-3 hover:underline"
          >
            {insight.cta} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
      
      {/* Premium hint - only for free users */}
      {!isPremium && (
        <div className="mt-4 pt-3 border-t border-muted/50">
          <p className="text-[10px] text-muted-foreground text-center">
            ✨ This is just a glimpse. <Link to="/insights" className="text-primary font-medium hover:underline">Unlock full insights</Link> with Premium.
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyInsight;
