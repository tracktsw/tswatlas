import { cn } from '@/lib/utils';

interface PlantIllustrationProps {
  className?: string;
  variant?: 'pot' | 'growing' | 'sprout';
}

export const PlantIllustration = ({ className, variant = 'pot' }: PlantIllustrationProps) => {
  if (variant === 'growing') {
    return (
      <svg
        viewBox="0 0 100 120"
        fill="none"
        className={cn('', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stem */}
        <path
          d="M50 110 Q50 70 50 40"
          stroke="hsl(145, 28%, 42%)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        {/* Leaves */}
        <path
          d="M50 80 Q30 65 25 45 Q45 55 50 80"
          fill="hsl(145, 28%, 42%)"
          opacity="0.5"
        />
        <path
          d="M50 60 Q70 45 75 25 Q55 35 50 60"
          fill="hsl(145, 28%, 42%)"
          opacity="0.5"
        />
        <path
          d="M50 40 Q35 25 40 10 Q55 20 50 40"
          fill="hsl(145, 28%, 42%)"
          opacity="0.6"
        />
        {/* Small leaves */}
        <path
          d="M50 95 Q60 90 65 85 Q58 92 50 95"
          fill="hsl(145, 28%, 42%)"
          opacity="0.4"
        />
      </svg>
    );
  }

  if (variant === 'sprout') {
    return (
      <svg
        viewBox="0 0 60 60"
        fill="none"
        className={cn('', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ground */}
        <ellipse cx="30" cy="50" rx="20" ry="5" fill="hsl(30, 20%, 60%)" opacity="0.3" />
        {/* Stem */}
        <path
          d="M30 50 Q30 40 30 30"
          stroke="hsl(145, 28%, 42%)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Two leaves */}
        <path
          d="M30 35 Q20 25 22 15 Q32 22 30 35"
          fill="hsl(145, 28%, 42%)"
          opacity="0.5"
        />
        <path
          d="M30 35 Q40 25 38 15 Q28 22 30 35"
          fill="hsl(145, 28%, 42%)"
          opacity="0.5"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 80 100"
      fill="none"
      className={cn('', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Pot */}
      <path
        d="M20 70 L25 95 L55 95 L60 70 Z"
        fill="hsl(15, 50%, 55%)"
        opacity="0.5"
      />
      <rect x="18" y="65" width="44" height="8" rx="2" fill="hsl(15, 50%, 55%)" opacity="0.6" />
      {/* Soil */}
      <ellipse cx="40" cy="68" rx="18" ry="4" fill="hsl(30, 20%, 40%)" opacity="0.4" />
      {/* Stem */}
      <path
        d="M40 65 Q40 45 40 25"
        stroke="hsl(145, 28%, 42%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Leaves */}
      <path
        d="M40 50 Q25 40 20 25 Q35 35 40 50"
        fill="hsl(145, 28%, 42%)"
        opacity="0.5"
      />
      <path
        d="M40 35 Q55 25 60 10 Q45 20 40 35"
        fill="hsl(145, 28%, 42%)"
        opacity="0.5"
      />
      <path
        d="M40 25 Q30 15 35 5 Q45 12 40 25"
        fill="hsl(145, 28%, 42%)"
        opacity="0.6"
      />
    </svg>
  );
};
