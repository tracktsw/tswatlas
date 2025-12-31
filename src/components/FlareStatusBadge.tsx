import { Flame, TrendingUp, TrendingDown, Activity, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlareState, getFlareStateLabel } from '@/hooks/useFlareState';
import { FlareState } from '@/utils/flareStateEngine';
import { PlantIllustration } from '@/components/illustrations';

const stateConfig: Record<FlareState, {
  icon: typeof Flame;
  gradient: string;
  iconColor: string;
  ringColor: string;
  description: string;
}> = {
  stable: {
    icon: TrendingUp,
    gradient: 'bg-gradient-to-br from-primary/20 to-sage-light',
    iconColor: 'text-primary',
    ringColor: 'ring-primary/30',
    description: 'Your symptoms are at baseline',
  },
  pre_flare: {
    icon: Activity,
    gradient: 'bg-gradient-to-br from-yellow-500/20 to-amber-100',
    iconColor: 'text-yellow-600',
    ringColor: 'ring-yellow-500/30',
    description: 'Symptoms are rising',
  },
  active_flare: {
    icon: Flame,
    gradient: 'bg-gradient-to-br from-orange-500/20 to-amber-100',
    iconColor: 'text-orange-600',
    ringColor: 'ring-orange-500/30',
    description: 'Active flare detected',
  },
  peak_flare: {
    icon: Flame,
    gradient: 'bg-gradient-to-br from-red-500/20 to-coral-light',
    iconColor: 'text-red-600',
    ringColor: 'ring-red-500/30',
    description: 'Peak flare activity',
  },
  resolving_flare: {
    icon: TrendingDown,
    gradient: 'bg-gradient-to-br from-blue-500/20 to-sky-100',
    iconColor: 'text-blue-600',
    ringColor: 'ring-blue-500/30',
    description: 'Flare is resolving',
  },
};

interface FlareStatusBadgeProps {
  className?: string;
}

export function FlareStatusBadge({ className }: FlareStatusBadgeProps) {
  const { currentState, isInActiveFlare, currentFlareDuration, isLoading, dailyBurdens } = useFlareState();
  
  // Need at least some data to show meaningful state
  if (isLoading || dailyBurdens.length < 3) {
    return null;
  }
  
  const config = stateConfig[currentState];
  const Icon = config.icon;
  const label = getFlareStateLabel(currentState);
  
  return (
    <div 
      className={cn(
        'glass-card-warm p-5 animate-slide-up relative overflow-hidden',
        currentState === 'stable' && 'ring-2',
        config.ringColor,
        className
      )}
    >
      {currentState === 'stable' && (
        <PlantIllustration variant="growing" className="w-16 h-20 absolute -right-2 -bottom-4 opacity-15" />
      )}
      <div className="flex items-center gap-4 relative">
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center shadow-warm-sm',
          config.gradient
        )}>
          <Icon className={cn('w-7 h-7', config.iconColor)} />
        </div>
        <div>
          <p className="font-display font-bold text-lg text-foreground">
            {label}
            {isInActiveFlare && currentFlareDuration && currentFlareDuration > 1 && (
              <span className="text-muted-foreground font-normal text-sm ml-2">
                Day {currentFlareDuration}
              </span>
            )}
          </p>
          <p className="text-muted-foreground">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}
