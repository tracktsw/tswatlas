import { useEffect, useState, useRef, useCallback } from 'react';
import { getPlatformInfo } from '@/hooks/usePlatform';
import { AlertCircle, X } from 'lucide-react';

const STORAGE_KEY = 'keyboard-warning-dismissed';
const FAILED_BACKSPACE_THRESHOLD = 3;

export function KeyboardWarning() {
  const [show, setShow] = useState(false);
  const { isAndroid } = getPlatformInfo();
  const failedBackspaceCount = useRef(0);
  const lastValueRef = useRef<string>('');
  const lastSelectionRef = useRef<number>(0);

  const checkAndShow = useCallback(() => {
    if (!isAndroid) return;
    
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setShow(true);
    }
  }, [isAndroid]);

  // Initial check - show if not dismissed
  useEffect(() => {
    checkAndShow();
  }, [checkAndShow]);

  // Backspace failure detection - re-show warning if user is still having issues
  useEffect(() => {
    if (!isAndroid) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || !('value' in target)) return;
      
      // Store current state before backspace
      lastValueRef.current = target.value;
      lastSelectionRef.current = target.selectionStart || 0;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || !('value' in target)) return;
      
      const currentValue = target.value;
      const previousValue = lastValueRef.current;
      const hadSelection = lastSelectionRef.current > 0 || previousValue.length > 0;
      
      // Check if backspace should have deleted something but didn't
      if (hadSelection && previousValue.length > 0 && currentValue.length >= previousValue.length) {
        failedBackspaceCount.current++;
        
        // If we hit threshold, show warning again even if dismissed
        if (failedBackspaceCount.current >= FAILED_BACKSPACE_THRESHOLD) {
          failedBackspaceCount.current = 0;
          setShow(true);
        }
      } else {
        // Successful backspace, reset counter
        failedBackspaceCount.current = 0;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isAndroid]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
    failedBackspaceCount.current = 0;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-amber-50 border-b border-amber-200 shadow-sm safe-area-top">
      <div className="flex items-start gap-3 max-w-lg mx-auto">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            Keyboard Recommendation
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            For the best typing experience, we recommend using your device's default keyboard. 
            Some third-party keyboards may have compatibility issues with text deletion.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded-full hover:bg-amber-100 transition-colors"
          aria-label="Dismiss keyboard warning"
        >
          <X className="h-4 w-4 text-amber-600" />
        </button>
      </div>
    </div>
  );
}
