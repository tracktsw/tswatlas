import { cn } from '@/lib/utils';

interface SunIllustrationProps {
  className?: string;
  variant?: 'simple' | 'rays' | 'rising';
}

export const SunIllustration = ({ className, variant = 'simple' }: SunIllustrationProps) => {
  if (variant === 'rays') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className={cn('text-honey', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Sun center */}
        <circle cx="50" cy="50" r="20" fill="currentColor" opacity="0.5" />
        <circle cx="50" cy="50" r="14" fill="currentColor" opacity="0.3" />
        {/* Rays */}
        <line x1="50" y1="5" x2="50" y2="20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <line x1="50" y1="80" x2="50" y2="95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <line x1="5" y1="50" x2="20" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <line x1="80" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        {/* Diagonal rays */}
        <line x1="18" y1="18" x2="28" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <line x1="72" y1="72" x2="82" y2="82" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <line x1="18" y1="82" x2="28" y2="72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <line x1="72" y1="28" x2="82" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      </svg>
    );
  }

  if (variant === 'rising') {
    return (
      <svg
        viewBox="0 0 120 80"
        fill="none"
        className={cn('text-honey', className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Horizon line */}
        <line x1="0" y1="60" x2="120" y2="60" stroke="currentColor" strokeWidth="2" opacity="0.2" />
        {/* Sun */}
        <circle cx="60" cy="60" r="25" fill="currentColor" opacity="0.4" />
        <circle cx="60" cy="60" r="18" fill="currentColor" opacity="0.3" />
        {/* Rays above */}
        <line x1="60" y1="10" x2="60" y2="25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <line x1="30" y1="25" x2="38" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <line x1="90" y1="25" x2="82" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <line x1="20" y1="50" x2="30" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <line x1="100" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 60 60"
      fill="none"
      className={cn('text-honey', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="30" cy="30" r="15" fill="currentColor" opacity="0.5" />
      <circle cx="30" cy="30" r="10" fill="currentColor" opacity="0.3" />
    </svg>
  );
};
