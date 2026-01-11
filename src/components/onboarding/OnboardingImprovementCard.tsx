import React from 'react';
import { CheckCircle2, Lightbulb, TrendingUp } from 'lucide-react';

export const OnboardingImprovementCard: React.FC = () => {
  const improvementPeriods = [
    { start: 'Jan 12', end: 'Jan 26' },
    { start: 'Jan 19', end: 'Feb 2' },
    { start: 'Feb 9', end: 'Feb 23' },
  ];

  const correlatedTreatments = [
    { name: 'Cold Compress', multiplier: '2.3x' },
    { name: 'NMT', multiplier: '1.8x' },
    { name: 'Exercise', multiplier: '1.5x' },
  ];

  return (
    <div className="bg-[hsl(85,30%,94%)] rounded-xl p-4 space-y-4">
      {/* Found improvement periods */}
      <div className="space-y-3">
        <p className="text-foreground text-sm">
          Found <span className="font-bold">29</span> improvement periods:
        </p>
        
        <div className="flex flex-wrap gap-2">
          {improvementPeriods.map((period, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-full text-xs font-medium text-foreground border border-primary/20"
            >
              <span>{period.start}</span>
              <span className="text-muted-foreground">→</span>
              <span>{period.end}</span>
              <TrendingUp className="w-3 h-3 text-primary" />
            </div>
          ))}
        </div>
      </div>

      {/* Correlated with improvement */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <p className="text-foreground text-sm font-medium">Correlated with improvement</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {correlatedTreatments.map((treatment, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-full text-xs border border-primary/20"
            >
              <span className="font-medium text-primary">{treatment.name}</span>
              <span className="text-muted-foreground">({treatment.multiplier})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insight */}
      <div className="flex items-start gap-2 pt-2 border-t border-primary/10">
        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/80 italic">
          Based on your data, <span className="font-semibold text-foreground">Cold Compress</span> may have contributed to your improvement.
        </p>
      </div>
    </div>
  );
};
