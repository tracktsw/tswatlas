import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
 * Android-safe Input that prevents React reconciliation during focus.
 * 
 * Root cause: React's reconciliation interferes with IME composition state.
 * Plain HTML inputs work fine with SwiftKey - this makes React behave the same.
 * 
 * Solution: Use native DOM events and prevent all React updates during focus.
 * Sync to React state only on blur.
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
    const isFocusedRef = React.useRef(false);

    // iOS/Web: Standard controlled input
    if (!isAndroid) {
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

    // Android: Native event listeners to prevent React reconciliation
    React.useEffect(() => {
      const element = resolvedRef.current;
      if (!element) return;

      const handleFocus = () => {
        isFocusedRef.current = true;
      };
 
      const handleBlur = (e: FocusEvent) => {
        isFocusedRef.current = false;
        const finalValue = (e.target as HTMLInputElement).value;
        
        // Sync to React state only on blur
        if (finalValue !== value) {
          onValueChange(finalValue);
        }
        
        // Call original onBlur if provided
        if (onBlur) {
          onBlur(e as any);
        }
      };
 
      element.addEventListener('focus', handleFocus);
      element.addEventListener('blur', handleBlur);
 
      return () => {
        element.removeEventListener('focus', handleFocus);
        element.removeEventListener('blur', handleBlur);
      };
    }, [onValueChange, onBlur, value]);
 
    // Sync external value changes only when not focused
    React.useEffect(() => {
      const element = resolvedRef.current;
      if (!element || isFocusedRef.current) return;
        
      if (element.value !== value) {
        element.value = value;
      }
    }, [value]);
 
    // Android: Uncontrolled input (like plain HTML)
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={resolvedRef}
        defaultValue={value}
        {...props}
      />
    );
  }
);
AndroidSafeInput.displayName = "AndroidSafeInput";

export { AndroidSafeInput };
