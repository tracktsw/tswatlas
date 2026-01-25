import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
 * Android-safe Input component that prevents SwiftKey backspace bug.
 * 
 * Root cause: React controlled inputs participate in IME reconciliation.
 * Even read-only hooks or conditional value comparisons cause SwiftKey
 * to suppress delete operations, requiring multiple backspace presses.
 * 
 * Solution: Fully uncontrolled input while focused on Android.
 * - Uses defaultValue, not value prop
 * - No onChange during typing
 * - State syncs ONLY on blur by reading from DOM ref
 * - React never participates in input reconciliation during focus
 * 
 * On iOS/Web: Standard controlled input behavior.
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

    // On Android: Fully uncontrolled - only sync on blur
    if (isAndroid) {
      const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // Read final value from DOM and sync to React state
        const finalValue = e.target.value;
        onValueChange(finalValue);
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
          defaultValue={value}
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
