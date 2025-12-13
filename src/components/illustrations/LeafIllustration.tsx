import { cn } from '@/lib/utils';

interface LeafIllustrationProps {
  className?: string;
  variant?: 'single' | 'branch' | 'cluster';
}

export const LeafIllustration = ({ className, variant = 'single' }: LeafIllustrationProps) => {
  if (variant === 'branch') {
    return (
      <svg
        viewBox="0 0 120 100"
        fill="none"
        className={cn('text-primary', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stem */}
        <path
          d="M20 80 Q40 60 60 50 Q80 40 100 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
        {/* Leaves */}
        <path
          d="M40 55 Q30 45 35 35 Q45 40 40 55"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M60 45 Q50 30 60 20 Q70 30 60 45"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M80 35 Q70 25 75 15 Q90 20 80 35"
          fill="currentColor"
          opacity="0.3"
        />
      </svg>
    );
  }

  if (variant === 'cluster') {
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className={cn('text-primary', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M40 70 Q30 50 40 30 Q50 50 40 70"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M25 60 Q15 45 25 30 Q35 45 25 60"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M55 60 Q45 45 55 30 Q65 45 55 60"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M40 50 Q25 35 40 15 Q55 35 40 50"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 60 80"
      fill="none"
      className={cn('text-primary', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Single leaf */}
      <path
        d="M30 75 Q20 50 30 10 Q40 50 30 75"
        fill="currentColor"
        opacity="0.5"
      />
      {/* Leaf vein */}
      <path
        d="M30 70 L30 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M30 35 Q22 40 18 45"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M30 45 Q38 50 42 55"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
};
