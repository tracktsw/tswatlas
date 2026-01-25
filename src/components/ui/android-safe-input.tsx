import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
 * Android-safe Input that works around Android WebView IME bugs.
 * 
 * Root cause: Android WebView's deleteSurroundingText() doesn't work correctly,
 * especially with SwiftKey. Any React reconciliation during composition breaks it.
 * 
 * Solution: Make input completely uncontrolled on Android. Never pass value prop,
 * never update DOM while focused. Sync only on blur.
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
    const lastValueRef = React.useRef(value);

    if (isAndroid) {
      React.useEffect(() => {
        const element = resolvedRef.current;
        if (!element) return;

        const handleFocus = () => {
          isFocusedRef.current = true;
          lastValueRef.current = element.value;
        };
 
        const handleBlur = (e: FocusEvent) => {
          isFocusedRef.current = false;
          const target = e.target as HTMLInputElement;
          
          // Sync to React state on blur
          if (target.value !== lastValueRef.current) {
            onValueChange(target.value);
            lastValueRef.current = target.value;
          }
        };
 
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
 
        return () => {
          element.removeEventListener('focus', handleFocus);
          element.removeEventListener('blur', handleBlur);
        };
      }, [onValueChange]);
 
      // Sync external value changes only when not focused
      React.useEffect(() => {
        const element = resolvedRef.current;
        if (!element || isFocusedRef.current) return;
        
        if (element.value !== value) {
          element.value = value;
          lastValueRef.current = value;
        }
      }, [value]);
 
      return (
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={resolvedRef}
          defaultValue={value}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          onBlur={onBlur}
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
