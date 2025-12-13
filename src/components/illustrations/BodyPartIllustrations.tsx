import { cn } from '@/lib/utils';

interface IllustrationProps {
  className?: string;
}

export const FaceIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <circle cx="12" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="9.5" cy="9" r="1" fill="currentColor" />
    <circle cx="14.5" cy="9" r="1" fill="currentColor" />
    <path d="M9 13.5C9.5 14.5 10.5 15 12 15C13.5 15 14.5 14.5 15 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 17V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const NeckIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M8 4C8 4 7 8 7 12C7 16 8 20 8 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 4C16 4 17 8 17 12C17 16 16 20 16 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 4H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 12H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <path d="M8 20H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ArmsIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M6 8C6 8 4 12 4 14C4 16 5 18 5 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M18 8C18 8 20 12 20 14C20 16 19 18 19 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 18L3 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M19 18L21 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const HandsIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M12 20V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 20V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 20V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6 20V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M18 20V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 12C12 12 10 10 10 8C10 6 11 4 12 4C13 4 14 6 14 8C14 10 12 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const LegsIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M9 4V12C9 14 8 18 7 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 4V12C15 14 16 18 17 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 4H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="7" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="17" cy="21" r="1.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const FeetIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M6 10C6 10 4 12 4 15C4 18 6 20 9 20C12 20 12 18 12 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M18 10C18 10 20 12 20 15C20 18 18 20 15 20C12 20 12 18 12 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="6" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="6" r="1" fill="currentColor" opacity="0.5" />
    <circle cx="15" cy="6" r="1" fill="currentColor" opacity="0.5" />
  </svg>
);

export const TorsoIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M8 4C8 4 6 6 6 12C6 18 8 20 8 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 4C16 4 18 6 18 12C18 18 16 20 16 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 4H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 20H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 10H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <path d="M10 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
);

export const BackIllustration = ({ className }: IllustrationProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={cn("w-5 h-5", className)}>
    <path d="M8 4C8 4 6 8 6 12C6 16 8 20 8 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M16 4C16 4 18 8 18 12C18 16 16 20 16 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 4H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 20H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 6V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" opacity="0.5" />
    <path d="M10 9L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    <path d="M10 15L14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
  </svg>
);

export const bodyPartIllustrations = {
  face: FaceIllustration,
  neck: NeckIllustration,
  arms: ArmsIllustration,
  hands: HandsIllustration,
  legs: LegsIllustration,
  feet: FeetIllustration,
  torso: TorsoIllustration,
  back: BackIllustration,
};
