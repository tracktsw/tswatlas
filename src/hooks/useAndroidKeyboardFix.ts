 import { useEffect, RefObject } from 'react';
import { getPlatformInfo } from './usePlatform';

/**
 * Fix for SwiftKey and other third-party Android keyboards that use
 * deleteSurroundingText() IME method instead of standard keydown events.
  * 
  * Root cause: IME composition interference - SwiftKey sends batch delete operations
  * that don't trigger proper DOM updates in React controlled inputs.
  * 
  * Solution: Detect failed deletions by comparing DOM value with React state,
  * but ONLY when NOT composing. Let IME composition finish naturally.
 * 
 * Only active on Android - no-op on iOS and Web.
 */
export function useAndroidKeyboardFix(
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>,
  value: string,
  onChange: (newValue: string) => void
) {
  useEffect(() => {
    // Only apply fix on Android
    if (!getPlatformInfo().isAndroid) return;
    
    const element = inputRef.current;
    if (!element) return;

     let pendingDelete = false;
     let isComposing = false;
 
     // Detect composition state
     const handleCompositionStart = () => {
       isComposing = true;
     };
 
     const handleCompositionEnd = () => {
       isComposing = false;
     };
 
     // Mark when backspace is pressed
    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'deleteContentBackward') {
         pendingDelete = true;
         // Never preventDefault - let native behavior try first
      }
    };
     
     // Check if deletion actually happened
     const handleInput = () => {
       if (!pendingDelete) return;
       pendingDelete = false;
 
       // Skip during composition - let IME finish naturally
       if (isComposing) return;
 
       // Compare DOM value with React state
       const currentDOMValue = element.value;
       const currentReactValue = value;
 
       // If DOM didn't update (SwiftKey bug), manually delete
       if (currentDOMValue === currentReactValue && currentReactValue.length > 0) {
         const start = element.selectionStart ?? currentReactValue.length;
         const end = element.selectionEnd ?? currentReactValue.length;
 
         if (start === end && start > 0) {
           const newValue = currentReactValue.slice(0, start - 1) + currentReactValue.slice(end);
           const newPos = start - 1;
           
           // Update state only - don't mutate DOM during input event
           onChange(newValue);
           
           // Restore cursor after React updates
           requestAnimationFrame(() => {
             if (element === document.activeElement) {
               element.setSelectionRange(newPos, newPos);
             }
           });
         } else if (start !== end) {
           const newValue = currentReactValue.slice(0, start) + currentReactValue.slice(end);
           onChange(newValue);
           
           requestAnimationFrame(() => {
             if (element === document.activeElement) {
               element.setSelectionRange(start, start);
             }
           });
         }
       }
     };

     element.addEventListener('compositionstart', handleCompositionStart);
     element.addEventListener('compositionend', handleCompositionEnd);
    element.addEventListener('beforeinput', handleBeforeInput as EventListener);
     element.addEventListener('input', handleInput);
 
    return () => {
       element.removeEventListener('compositionstart', handleCompositionStart);
       element.removeEventListener('compositionend', handleCompositionEnd);
      element.removeEventListener('beforeinput', handleBeforeInput as EventListener);
       element.removeEventListener('input', handleInput);
    };
   }, [inputRef, value, onChange]);
}
