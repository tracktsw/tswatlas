import { useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { usePlatform } from '@/hooks/usePlatform';

const APP_STORE_URL = 'https://apps.apple.com/us/app/tracktsw/id6757331400';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.tracktsw.atlas';

const DISMISS_KEY = 'app_download_banner_dismissed_at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const AppDownloadBanner = () => {
  const { isWeb } = usePlatform();

  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - parseInt(dismissedAt, 10) < DISMISS_DURATION_MS;
  });

  if (!isWeb || dismissed) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const storeUrl = isIOS ? APP_STORE_URL : isAndroid ? PLAY_STORE_URL : APP_STORE_URL;
  const storeName = isIOS ? 'App Store' : isAndroid ? 'Google Play' : 'App Store';

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  return (
    <a
      href={storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors animate-fade-in touch-manipulation"
    >
      <div className="p-2 rounded-xl bg-primary/15 shrink-0">
        <Smartphone className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Get the free app</p>
        <p className="text-xs text-muted-foreground">
          Download on the {storeName} for the best experience
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </a>
  );
};

export default AppDownloadBanner;
