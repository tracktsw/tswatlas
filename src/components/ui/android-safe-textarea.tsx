import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
  * Android-safe Textarea component - uses native input event for better Android compatibility.
 * 
  * Root cause: React's onChange uses synthetic events that don't always fire correctly
  * with SwiftKey's deleteSurroundingText() IME method. Native input events are more reliable.
 * 
  * Solution: Use native input event on Android, synthetic onChange on iOS/Web.
 */

export interface AndroidSafeTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'defaultValue'> {
  value: string;
  onValueChange: (value: string) => void;
}

const AndroidSafeTextarea = React.forwardRef<HTMLTextAreaElement, AndroidSafeTextareaProps>(
  ({ className, value, onValueChange, onBlur, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLTextAreaElement>) || innerRef;
    const isAndroid = getPlatformInfo().isAndroid;

    if (isAndroid) {
       // Use native input event instead of React's synthetic onChange
       React.useEffect(() => {
         const element = resolvedRef.current;
         if (!element) return;

         const handleInput = (e: Event) => {
           const target = e.target as HTMLTextAreaElement;
           onValueChange(target.value);
         };
 
         // Use native addEventListener instead of React event
         element.addEventListener('input', handleInput);
         return () => element.removeEventListener('input', handleInput);
       }, [onValueChange]);
 
       const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
         // Ensure sync on blur as backup
         const finalValue = e.target.value;
         if (finalValue !== value) {
           onValueChange(finalValue);
         }
         onBlur?.(e);
       };
 
      return (
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={resolvedRef}
           value={value}
          onBlur={handleBlur}
          {...props}
        />
      );
    }

    // On iOS/Web: Standard controlled textarea
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={resolvedRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);
AndroidSafeTextarea.displayName = "AndroidSafeTextarea";

export { AndroidSafeTextarea };
