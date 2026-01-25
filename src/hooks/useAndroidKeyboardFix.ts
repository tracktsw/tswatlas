 import { useEffect, RefObject } from 'react';
import { getPlatformInfo } from './usePlatform';

/**
  * Fix for Android text re-injection bug with SwiftKey keyboard.
  * 
  * Root Cause: React controlled inputs write value back to DOM on every render.
  * When SwiftKey's deleteSurroundingText() fails to update DOM, our fix would
  * call onChange(), triggering re-render, which writes stale text back to input
  * WHILE user is typing. This breaks IME state and requires multiple backspaces.
  * 
  * Solution: Make DOM the source of truth while focused.
  * - During focus: Update DOM directly, NEVER call onChange
  * - On blur: Sync final DOM value to React state
  * - No text written back while user is editing
  * - Preserves IME composition state
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
     let isFocused = false;
     let lastSyncedValue = value;
 
     // Track focus state - critical for preventing re-injection
     const handleFocus = () => {
       isFocused = true;
       lastSyncedValue = value;
     };
 
     const handleBlur = () => {
       isFocused = false;
       // Sync final DOM value to React state
       const finalValue = element.value;
       if (finalValue !== lastSyncedValue) {
         onChange(finalValue);
         lastSyncedValue = finalValue;
       }
     };
 
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
      }
    };
     
     // Check if deletion actually happened
     const handleInput = () => {
       if (!pendingDelete) return;
       pendingDelete = false;
 
       // Skip during composition or when not focused
       if (isComposing || !isFocused) return;
 
       // Compare DOM value with last synced value
       const currentDOMValue = element.value;
       const expectedValue = lastSyncedValue;
 
       // If DOM didn't update (SwiftKey bug), manually delete
       if (currentDOMValue === expectedValue && expectedValue.length > 0) {
         const start = element.selectionStart ?? expectedValue.length;
         const end = element.selectionEnd ?? expectedValue.length;
 
         if (start === end && start > 0) {
           // Directly update DOM - don't call onChange while focused
           const newValue = expectedValue.slice(0, start - 1) + expectedValue.slice(end);
           const newPos = start - 1;
           
           element.value = newValue;
           element.setSelectionRange(newPos, newPos);
           lastSyncedValue = newValue;
         } else if (start !== end) {
           // Delete selection
           const newValue = expectedValue.slice(0, start) + expectedValue.slice(end);
           
           element.value = newValue;
           element.setSelectionRange(start, start);
           lastSyncedValue = newValue;
         }
       }
     };

     element.addEventListener('focus', handleFocus);
     element.addEventListener('blur', handleBlur);
     element.addEventListener('compositionstart', handleCompositionStart);
     element.addEventListener('compositionend', handleCompositionEnd);
    element.addEventListener('beforeinput', handleBeforeInput as EventListener);
     element.addEventListener('input', handleInput);
 
    return () => {
       element.removeEventListener('focus', handleFocus);
       element.removeEventListener('blur', handleBlur);
       element.removeEventListener('compositionstart', handleCompositionStart);
       element.removeEventListener('compositionend', handleCompositionEnd);
      element.removeEventListener('beforeinput', handleBeforeInput as EventListener);
       element.removeEventListener('input', handleInput);
    };
   }, [inputRef, value, onChange]);
}
