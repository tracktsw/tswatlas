import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Share, MoreVertical, Plus, Download, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export function PWAInstallPrompt() {
  const { platform, shouldShowPrompt, dismiss, triggerInstall, canTriggerInstall } = usePWAInstall();
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  if (!shouldShowPrompt) {
    return null;
  }

  // On native Android, use the CSS var set by AndroidSafeAreaContext; otherwise use env()
  const safeBottomStyle = isNativeAndroid
    ? 'calc(80px + var(--app-safe-bottom, 0px))'
    : 'calc(80px + env(safe-area-inset-bottom, 0px))';

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      style={{ paddingBottom: safeBottomStyle }}
    >
      <div className="w-full max-w-md max-h-full overflow-auto animate-in fade-in zoom-in-95 duration-300">
        <div className="rounded-2xl bg-card border border-border shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Add TrackTSW to your Home Screen
            </h2>
            <button 
              onClick={dismiss}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Install TrackTSW for quick access and a better experience — just like a regular app.
            </p>

            {platform === 'ios' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Share className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Step 1</p>
                    <p className="text-sm text-muted-foreground">
                      Tap the <span className="font-medium">Share</span> icon in Safari/Chrome
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Step 2</p>
                    <p className="text-sm text-muted-foreground">
                      Scroll down and tap <span className="font-medium">Add to Home Screen</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Step 3</p>
                    <p className="text-sm text-muted-foreground">
                      Tap <span className="font-medium">Add</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {platform === 'android' && (
              <div className="space-y-3">
                {canTriggerInstall ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Download className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-3">
                        Tap the button below to install TrackTSW
                      </p>
                      <Button onClick={triggerInstall} className="w-full">
                        Install App
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <MoreVertical className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Step 1</p>
                        <p className="text-sm text-muted-foreground">
                          Tap the <span className="font-medium">three-dot menu</span> in Chrome
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Step 2</p>
                        <p className="text-sm text-muted-foreground">
                          Tap <span className="font-medium">Add to Home screen</span> or <span className="font-medium">Install app</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">✓</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Step 3</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Confirm</span>
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={dismiss}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
