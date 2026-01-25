import { useEffect, RefObject } from 'react';
import { getPlatformInfo } from './usePlatform';

/**
 * Fix for SwiftKey and other third-party Android keyboards that use
 * deleteSurroundingText() IME method instead of standard keydown events.
 * This hook intercepts beforeinput events and manually handles backspace.
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

    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'deleteContentBackward') {
        e.preventDefault();
        const start = element.selectionStart ?? value.length;
        const end = element.selectionEnd ?? value.length;
        
        let newValue: string;
        let newPos: number;
        
        if (start === end && start > 0) {
          // Delete single character before cursor
          newValue = value.slice(0, start - 1) + value.slice(end);
          newPos = start - 1;
        } else if (start !== end) {
          // Delete selection
          newValue = value.slice(0, start) + value.slice(end);
          newPos = start;
        } else {
          // Nothing to delete (cursor at position 0)
          return;
        }
        
        onChange(newValue);
        
        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
          element.setSelectionRange(newPos, newPos);
        });
      }
    };

    element.addEventListener('beforeinput', handleBeforeInput as EventListener);
    return () => {
      element.removeEventListener('beforeinput', handleBeforeInput as EventListener);
    };
  }, [inputRef, value, onChange]);
}
