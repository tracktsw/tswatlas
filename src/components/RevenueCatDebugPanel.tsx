import { Bug, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRevenueCatContext } from '@/contexts/RevenueCatContext';
import { useState } from 'react';

const RevenueCatDebugPanel = () => {
  const revenueCat = useRevenueCatContext();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await revenueCat.retryInitialization();
    } finally {
      setIsRetrying(false);
    }
  };

  const debugInfo = revenueCat.getDebugInfo();

  return (
    <div className="glass-card p-4 border-purple-500/50">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-purple-500/10">
          <Bug className="w-5 h-5 text-purple-500" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">RevenueCat Debug</h3>
            <p className="text-sm text-muted-foreground">iOS subscription state</p>
          </div>

          <div className="space-y-2 text-sm font-mono bg-muted/50 p-3 rounded-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground">isInitialized:</span>
              <span className={revenueCat.isInitialized ? 'text-green-500' : 'text-red-500'}>
                {String(revenueCat.isInitialized)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">offeringsStatus:</span>
              <span className={
                revenueCat.offeringsStatus === 'ready' ? 'text-green-500' :
                revenueCat.offeringsStatus === 'error' ? 'text-red-500' :
                revenueCat.offeringsStatus === 'loading' ? 'text-amber-500' :
                'text-muted-foreground'
              }>
                {revenueCat.offeringsStatus}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">boundUserId:</span>
              <span className="text-foreground truncate max-w-[150px]" title={revenueCat.boundUserId || 'null'}>
                {revenueCat.boundUserId ? `...${revenueCat.boundUserId.slice(-8)}` : 'null'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">appUserId:</span>
              <span className="text-foreground truncate max-w-[150px]" title={revenueCat.appUserId || 'null'}>
                {revenueCat.appUserId ? `...${revenueCat.appUserId.slice(-8)}` : 'null'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">isPremiumFromRC:</span>
              <span className={revenueCat.isPremiumFromRC ? 'text-green-500' : 'text-muted-foreground'}>
                {String(revenueCat.isPremiumFromRC)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">isUserLoggedIn:</span>
              <span className={revenueCat.isUserLoggedIn ? 'text-green-500' : 'text-red-500'}>
                {String(revenueCat.isUserLoggedIn)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">isLoading:</span>
              <span className={revenueCat.isLoading ? 'text-amber-500' : 'text-muted-foreground'}>
                {String(revenueCat.isLoading)}
              </span>
            </div>
            {revenueCat.offeringsError && (
              <div className="pt-2 border-t border-border">
                <span className="text-red-500">Error: {revenueCat.offeringsError}</span>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full border-purple-500/50 text-purple-600"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Initialization
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RevenueCatDebugPanel;
