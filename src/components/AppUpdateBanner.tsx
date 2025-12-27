import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/useAppUpdate";

export function AppUpdateBanner() {
  const { updateAvailable, isUpdating, performUpdate } = useAppUpdate();

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
          New Version Available
        </h2>
        
        <p className="mb-6 text-center text-sm text-muted-foreground">
          A new version of TrackTSW is available with improvements and fixes.
        </p>

        <Button
          onClick={performUpdate}
          disabled={isUpdating}
          className="w-full"
          size="lg"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Now"
          )}
        </Button>
      </div>
    </div>
  );
}
