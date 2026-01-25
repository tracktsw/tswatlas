import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
  * Android-safe Input component - uses native input event for better Android compatibility.
 * 
  * Root cause: React's onChange uses synthetic events that don't always fire correctly
  * with SwiftKey's deleteSurroundingText() IME method. Native input events are more reliable.
 * 
  * Solution: Use native input event on Android, synthetic onChange on iOS/Web.
 */

export interface AndroidSafeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'defaultValue'> {
  value: string;
  onValueChange: (value: string) => void;
}

const AndroidSafeInput = React.forwardRef<HTMLInputElement, AndroidSafeInputProps>(
  ({ className, type, value, onValueChange, onBlur, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLInputElement>) || innerRef;
    const isAndroid = getPlatformInfo().isAndroid;

    if (isAndroid) {
       // Use native input event instead of React's synthetic onChange
       React.useEffect(() => {
         const element = resolvedRef.current;
         if (!element) return;

         const handleInput = (e: Event) => {
           const target = e.target as HTMLInputElement;
           onValueChange(target.value);
         };
 
         // Use native addEventListener instead of React event
         element.addEventListener('input', handleInput);
         return () => element.removeEventListener('input', handleInput);
       }, [onValueChange]);
 
       const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
         // Ensure sync on blur as backup
         const finalValue = e.target.value;
         if (finalValue !== value) {
           onValueChange(finalValue);
         }
         onBlur?.(e);
       };
 
      return (
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={resolvedRef}
           value={value}
          onBlur={handleBlur}
          {...props}
        />
      );
    }

    // On iOS/Web: Standard controlled input
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
AndroidSafeInput.displayName = "AndroidSafeInput";

export { AndroidSafeInput };
