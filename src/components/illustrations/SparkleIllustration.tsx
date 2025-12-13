import { cn } from '@/lib/utils';

interface SparkleIllustrationProps {
  className?: string;
  variant?: 'single' | 'cluster' | 'trail';
}

export const SparkleIllustration = ({ className, variant = 'single' }: SparkleIllustrationProps) => {
  if (variant === 'cluster') {
    return (
      <svg
        viewBox="0 0 80 80"
        fill="none"
        className={cn('text-honey', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main sparkle */}
        <path
          d="M40 10 L43 35 L55 40 L43 45 L40 70 L37 45 L25 40 L37 35 Z"
          fill="currentColor"
          opacity="0.5"
        />
        {/* Small sparkles */}
        <path
          d="M15 20 L16 25 L20 26 L16 27 L15 32 L14 27 L10 26 L14 25 Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M65 55 L66 60 L70 61 L66 62 L65 67 L64 62 L60 61 L64 60 Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M60 15 L61 18 L64 19 L61 20 L60 23 L59 20 L56 19 L59 18 Z"
          fill="currentColor"
          opacity="0.3"
        />
        {/* Dots */}
        <circle cx="20" cy="60" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="70" cy="30" r="1.5" fill="currentColor" opacity="0.3" />
      </svg>
    );
  }

  if (variant === 'trail') {
    return (
      <svg
        viewBox="0 0 120 40"
        fill="none"
        className={cn('text-honey', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Trail of sparkles */}
        <path
          d="M20 20 L22 15 L27 14 L22 13 L20 8 L18 13 L13 14 L18 15 Z"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M45 18 L46 14 L50 13 L46 12 L45 8 L44 12 L40 13 L44 14 Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M70 22 L71 19 L74 18 L71 17 L70 14 L69 17 L66 18 L69 19 Z"
          fill="currentColor"
          opacity="0.35"
        />
        <path
          d="M95 20 L96 18 L98 17 L96 16 L95 14 L94 16 L92 17 L94 18 Z"
          fill="currentColor"
          opacity="0.3"
        />
        <circle cx="108" cy="20" r="1.5" fill="currentColor" opacity="0.25" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn('text-honey', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 2 L23 16 L37 20 L23 24 L20 38 L17 24 L3 20 L17 16 Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
};
