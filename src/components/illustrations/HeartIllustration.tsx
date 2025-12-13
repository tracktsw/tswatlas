import { cn } from '@/lib/utils';

interface HeartIllustrationProps {
  className?: string;
  variant?: 'simple' | 'decorated' | 'floating';
}

export const HeartIllustration = ({ className, variant = 'simple' }: HeartIllustrationProps) => {
  if (variant === 'decorated') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className={cn('text-coral', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main heart */}
        <path
          d="M50 85 C20 55 10 35 25 20 C35 10 50 20 50 30 C50 20 65 10 75 20 C90 35 80 55 50 85"
          fill="currentColor"
          opacity="0.4"
        />
        {/* Sparkles */}
        <circle cx="20" cy="30" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="80" cy="30" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="50" cy="15" r="1.5" fill="currentColor" opacity="0.4" />
        {/* Small hearts */}
        <path
          d="M15 50 C12 47 10 44 13 41 C15 39 18 41 18 43 C18 41 21 39 23 41 C26 44 24 47 18 50"
          fill="currentColor"
          opacity="0.3"
          transform="scale(0.8) translate(5, 10)"
        />
      </svg>
    );
  }

  if (variant === 'floating') {
    return (
      <svg
        viewBox="0 0 80 100"
        fill="none"
        className={cn('text-coral animate-float', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M40 80 C15 50 5 35 18 22 C28 12 40 22 40 32 C40 22 52 12 62 22 C75 35 65 50 40 80"
          fill="currentColor"
          opacity="0.5"
        />
        <path
          d="M40 65 C25 45 20 35 28 27 C34 21 40 27 40 33 C40 27 46 21 52 27 C60 35 55 45 40 65"
          fill="currentColor"
          opacity="0.3"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 60 60"
      fill="none"
      className={cn('text-coral', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M30 52 C10 32 2 20 12 10 C20 2 30 10 30 18 C30 10 40 2 48 10 C58 20 50 32 30 52"
        fill="currentColor"
        opacity="0.4"
      />
    </svg>
  );
};
