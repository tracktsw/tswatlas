import { cn } from '@/lib/utils';

interface TreatmentStatusBadgeProps {
  text: string | null | undefined;
  className?: string;
}

/**
 * An inline status badge displayed next to the treatment name.
 * Renders as a pill/label with truncation for long text.
 */
const TreatmentStatusBadge = ({ text, className }: TreatmentStatusBadgeProps) => {
  if (!text || text.trim() === '') return null;

  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 max-w-[140px] px-2 py-0.5 rounded-full",
        "bg-destructive/15 text-destructive text-[10px] font-semibold uppercase tracking-wide",
        "whitespace-nowrap overflow-hidden text-ellipsis",
        className
      )}
      title={text}
    >
      {text}
    </span>
  );
};

export default TreatmentStatusBadge;
