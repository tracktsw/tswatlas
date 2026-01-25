import * as React from "react";
import { cn } from "@/lib/utils";
import { getPlatformInfo } from "@/hooks/usePlatform";

/**
  * Android-safe Textarea component that completely prevents React value updates during focus.
 * 
  * Root cause: SwiftKey's deleteSurroundingText() gets confused when React writes
  * the value prop back to the DOM during deletion. ANY React update breaks IME state.
 * 
  * Solution: On Android, track focus state and BLOCK all React value updates while focused.
  * React only updates the textarea when it's not focused. User typing is pure DOM.
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
     const isFocusedRef = React.useRef(false);

    if (isAndroid) {
       React.useEffect(() => {
         const element = resolvedRef.current;
         if (!element) return;

         const handleFocus = () => {
           isFocusedRef.current = true;
         };
 
         const handleInput = (e: Event) => {
           const target = e.target as HTMLTextAreaElement;
           onValueChange(target.value);
         };
 
         const handleBlur = () => {
           isFocusedRef.current = false;
           // Final sync on blur
           onValueChange(element.value);
         };
 
         element.addEventListener('focus', handleFocus);
         element.addEventListener('input', handleInput);
         element.addEventListener('blur', handleBlur);
 
         return () => {
           element.removeEventListener('focus', handleFocus);
           element.removeEventListener('input', handleInput);
           element.removeEventListener('blur', handleBlur);
         };
       }, [onValueChange]);
 
       // Update textarea value only when NOT focused
       React.useEffect(() => {
         const element = resolvedRef.current;
         if (!element || isFocusedRef.current) return;
         
         // Only update if value prop differs from DOM
         if (element.value !== value) {
           element.value = value;
         }
       }, [value]);
 
      return (
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={resolvedRef}
           defaultValue={value}
           onBlur={onBlur}
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
