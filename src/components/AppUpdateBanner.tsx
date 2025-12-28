import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/useAppUpdate";

export function AppUpdateBanner() {
  const { updateAvailable, isUpdating, performUpdate, dismissUpdate, remoteVersion } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <RefreshCw className="h-6 w-6 text-primary" />
          </div>
        </div>
        
        <h2 className="mb-2 text-center text-lg font-semibold text-foreground">
          Update available
        </h2>
        
        <p className="mb-6 text-center text-sm text-muted-foreground">
          A new version is ready. Refresh to update.
          {remoteVersion && (
            <span className="block mt-1 text-xs">
              v{remoteVersion}
            </span>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={performUpdate}
            disabled={isUpdating}
            className="w-full"
            size="lg"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh now"
            )}
          </Button>
          
          <Button
            variant="ghost"
            onClick={dismissUpdate}
            disabled={isUpdating}
            className="w-full text-muted-foreground"
            size="sm"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
