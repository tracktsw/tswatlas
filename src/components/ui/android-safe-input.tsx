import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
  * Android-safe Input component that prevents ALL React DOM writes during focus.
 * 
  * Root cause: SwiftKey's deleteSurroundingText() breaks when React touches the DOM
  * during IME composition, even via parent re-renders or passive observation.
 * 
  * Solution: On Android, input is 100% uncontrolled while focused. No value prop,
  * no onValueChange calls during typing. State syncs only on blur via DOM ref.
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
    const pendingValueRef = React.useRef(value);

    if (isAndroid) {
      React.useEffect(() => {
        const element = resolvedRef.current;
        if (!element) return;

        const handleFocus = () => {
          isFocusedRef.current = true;
        };
 
        const handleBlur = (e: FocusEvent) => {
          isFocusedRef.current = false;
          const target = e.target as HTMLInputElement;
          const currentValue = target.value;
          
          // Only call onValueChange if value actually changed
          if (currentValue !== pendingValueRef.current) {
            onValueChange(currentValue);
            pendingValueRef.current = currentValue;
          }
        };
 
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
 
        return () => {
          element.removeEventListener('focus', handleFocus);
          element.removeEventListener('blur', handleBlur);
        };
      }, [onValueChange]);
 
      // Sync external value changes (only when NOT focused)
      React.useEffect(() => {
        const element = resolvedRef.current;
        if (!element) return;
        
        pendingValueRef.current = value;
        
        // Only touch DOM if not focused
        if (!isFocusedRef.current && element.value !== value) {
          element.value = value;
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
