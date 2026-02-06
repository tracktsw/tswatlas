import { cn } from '@/lib/utils';

interface DiagonalBannerProps {
  text: string;
  className?: string;
}

/**
 * A diagonal ribbon banner that overlays the top-right corner of a card.
 * Text is truncated if too long and displays on a diagonal strip.
 */
const DiagonalBanner = ({ text, className }: DiagonalBannerProps) => {
  if (!text || text.trim() === '') return null;

  return (
    <div className="absolute -right-[40px] top-[18px] z-10 pointer-events-none overflow-hidden">
      <div
        className={cn(
          "rotate-45 bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wide",
          "px-10 py-1 text-center shadow-md",
          "whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]",
          className
        )}
        title={text}
      >
        {text}
      </div>
    </div>
  );
};

export default DiagonalBanner;
