import { useEffect, useState, useRef, useCallback } from 'react';
import { getPlatformInfo } from '@/hooks/usePlatform';
import { AlertCircle, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'keyboard-warning-dismissed';
const FAILED_BACKSPACE_THRESHOLD = 3;

export function KeyboardWarning() {
  const [show, setShow] = useState(false);
  const [forceShow, setForceShow] = useState(false);
  const { isAndroid } = getPlatformInfo();
  const failedBackspaceCount = useRef(0);
  const lastValueRef = useRef<string>('');
  const lastSelectionRef = useRef<number>(0);
  const location = useLocation();
  
  const isAuthPage = location.pathname === '/auth';

  const checkAndShow = useCallback(() => {
    if (!isAndroid) return;
    
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed && isAuthPage) {
      setShow(true);
    }
  }, [isAndroid, isAuthPage]);

  useEffect(() => {
    checkAndShow();
  }, [checkAndShow]);

  // Global backspace failure detection
  useEffect(() => {
    if (!isAndroid) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target || !('value' in target)) return;
      
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
      
      if (hadSelection && previousValue.length > 0 && currentValue.length >= previousValue.length) {
        failedBackspaceCount.current++;
        
        if (failedBackspaceCount.current >= FAILED_BACKSPACE_THRESHOLD) {
          failedBackspaceCount.current = 0;
          setForceShow(true);
          setShow(true);
        }
      } else {
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

  // Only show on auth page initially, or anywhere if force-shown due to backspace issues
  if (!show || (!isAuthPage && !forceShow)) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
    setForceShow(false);
    failedBackspaceCount.current = 0;
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-3 py-2 bg-amber-50/95 backdrop-blur-sm border-b border-amber-200 safe-area-top">
      <div className="flex items-center gap-2 max-w-lg mx-auto">
        <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="flex-1 text-xs text-amber-700">
          For the best experience, use your device's default keyboard.
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-0.5 rounded-full hover:bg-amber-100 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5 text-amber-600" />
        </button>
      </div>
    </div>
  );
}