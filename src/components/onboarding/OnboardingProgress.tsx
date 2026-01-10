import React from 'react';

interface OnboardingProgressProps {
  current: number;
  total: number;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ current, total }) => {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current 
              ? 'w-6 bg-primary' 
              : i === current 
                ? 'w-6 bg-primary/50' 
                : 'w-1.5 bg-muted'
          }`}
        />
      ))}
    </div>
  );
};
