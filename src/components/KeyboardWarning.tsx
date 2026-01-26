import { useEffect, useState } from 'react';
import { getPlatformInfo } from '@/hooks/usePlatform';
import { AlertCircle, X } from 'lucide-react';

export function KeyboardWarning() {
  const [show, setShow] = useState(false);
  const { isAndroid } = getPlatformInfo();

  useEffect(() => {
    if (isAndroid) {
      const dismissed = localStorage.getItem('keyboard-warning-dismissed');
      if (!dismissed) {
        setShow(true);
      }
    }
  }, [isAndroid]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem('keyboard-warning-dismissed', 'true');
    setShow(false);
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
