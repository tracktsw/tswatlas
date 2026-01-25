 import { useEffect, useRef, RefObject } from 'react';
import { getPlatformInfo } from './usePlatform';

/**
 * Fix for SwiftKey and other third-party Android keyboards that use
 * deleteSurroundingText() IME method instead of standard keydown events.
  * This hook intercepts input events and detects when backspace fails to delete.
 * 
 * Only active on Android - no-op on iOS and Web.
 */
export function useAndroidKeyboardFix(
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>,
  value: string,
  onChange: (newValue: string) => void
) {
   const lastValueRef = useRef(value);
 
   useEffect(() => {
     lastValueRef.current = value;
   }, [value]);
 
  useEffect(() => {
    // Only apply fix on Android
    if (!getPlatformInfo().isAndroid) return;
    
    const element = inputRef.current;
    if (!element) return;

     let isDeleting = false;
 
    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'deleteContentBackward') {
         isDeleting = true;
      }
    };
 
     const handleInput = () => {
       if (!isDeleting) return;
       isDeleting = false;
 
       // Check if the value actually changed
       const currentDOMValue = element.value;
       const lastValue = lastValueRef.current;
 
       // If SwiftKey bug: DOM value didn't change but backspace was pressed
       if (currentDOMValue === lastValue) {
         const start = element.selectionStart ?? lastValue.length;
         const end = element.selectionEnd ?? lastValue.length;
 
         let newValue: string;
         let newPos: number;
 
         if (start === end && start > 0) {
           // Delete single character before cursor
           newValue = lastValue.slice(0, start - 1) + lastValue.slice(end);
           newPos = start - 1;
         } else if (start !== end) {
           // Delete selection
           newValue = lastValue.slice(0, start) + lastValue.slice(end);
           newPos = start;
         } else {
           // Nothing to delete
           return;
         }
 
         // Update DOM directly first
         element.value = newValue;
         element.setSelectionRange(newPos, newPos);
 
         // Then update React state
         onChange(newValue);
       }
     };

    element.addEventListener('beforeinput', handleBeforeInput as EventListener);
     element.addEventListener('input', handleInput);
 
    return () => {
      element.removeEventListener('beforeinput', handleBeforeInput as EventListener);
       element.removeEventListener('input', handleInput);
    };
   }, [inputRef, onChange]);
}
