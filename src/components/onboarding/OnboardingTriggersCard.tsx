import React from 'react';
import { TrendingUp } from 'lucide-react';

export const OnboardingTriggersCard: React.FC = () => {
  const triggers = [
    { name: 'Shower / Hard Water', percentage: 82, days: 26 },
    { name: 'Stress', percentage: 77, days: 23, showWorsening: true },
    { name: 'Heat / Sweat', percentage: 77, days: 29 },
  ];

  return (
    <div className="bg-[hsl(40,40%,94%)] rounded-xl p-4 space-y-4">
      {/* Header */}
      <p className="text-foreground/70 text-sm">
        Triggers correlated with worse-than-average skin days
      </p>

      {/* Trigger bars */}
      <div className="space-y-4">
        {triggers.map((trigger, index) => (
          <div key={index} className="space-y-1.5">
            {/* Trigger name and stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-600 text-base">
                  {trigger.name}
                </span>
                {trigger.showWorsening && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded-full font-medium">
                    <TrendingUp className="w-3 h-3" />
                    Worsening
                  </span>
                )}
              </div>
              <span className="text-foreground/70 text-sm">
                {trigger.percentage}% worse <span className="text-muted-foreground">({trigger.days}d)</span>
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-3 bg-amber-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${trigger.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
