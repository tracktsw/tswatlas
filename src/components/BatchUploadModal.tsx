import { useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, Upload, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { BodyPart } from '@/contexts/UserDataContext';
import { UploadItem } from '@/hooks/useBatchUpload';

interface BatchUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: UploadItem[];
  isUploading: boolean;
  stats: {
    total: number;
    pending: number;
    uploading: number;
    success: number;
    failed: number;
  };
  currentIndex: number;
  bodyPart: BodyPart;
  onBodyPartChange: (part: BodyPart) => void;
  onStartUpload: () => void;
  onRetryFailed: () => void;
  onCancel: () => void;
  onClose: () => void;
  selectedFiles: File[];
}

const bodyParts: { value: BodyPart; label: string }[] = [
  { value: 'face', label: 'Face' },
  { value: 'neck', label: 'Neck' },
  { value: 'arms', label: 'Arms' },
  { value: 'hands', label: 'Hands' },
  { value: 'legs', label: 'Legs' },
  { value: 'feet', label: 'Feet' },
  { value: 'torso', label: 'Torso' },
  { value: 'back', label: 'Back' },
];

export const BatchUploadModal = ({
  open,
  onOpenChange,
  items,
  isUploading,
  stats,
  currentIndex,
  bodyPart,
  onBodyPartChange,
  onStartUpload,
  onRetryFailed,
  onCancel,
  onClose,
  selectedFiles,
}: BatchUploadModalProps) => {
  const isComplete = !isUploading && items.length > 0 && stats.pending === 0 && stats.uploading === 0;
  const hasStarted = items.length > 0;
  const hasFailures = stats.failed > 0;
  const allSuccess = isComplete && stats.failed === 0;

  // Calculate overall progress
  const overallProgress = items.length > 0
    ? Math.round(((stats.success + stats.failed) / stats.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80dvh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {hasStarted ? 'Uploading Photos' : 'Upload Photos'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Body part selector - shown before upload starts */}
          {!hasStarted && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
              
              <div>
                <label className="text-sm font-semibold mb-2 block">Body Area for all photos</label>
                <Select value={bodyPart} onValueChange={(v) => onBodyPartChange(v as BodyPart)}>
                  <SelectTrigger className="h-11 rounded-xl border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyParts.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                className="w-full h-11 gap-2" 
                onClick={onStartUpload}
              >
                <Upload className="w-4 h-4" />
                Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {/* Progress view - shown during/after upload */}
          {hasStarted && (
            <div className="space-y-4">
              {/* Overall progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {isUploading 
                      ? `Uploading ${currentIndex} of ${stats.total}...`
                      : allSuccess
                        ? `All ${stats.total} photos uploaded!`
                        : `${stats.success} uploaded, ${stats.failed} failed`
                    }
                  </span>
                  <span className="text-muted-foreground">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </div>

              {/* File list */}
              <div className="space-y-2 max-h-[40dvh] overflow-auto pr-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                      item.status === 'success' && "bg-primary/5 border-primary/20",
                      item.status === 'error' && "bg-destructive/5 border-destructive/20",
                      item.status === 'uploading' && "bg-muted/50 border-primary/30",
                      item.status === 'pending' && "bg-muted/30 border-border"
                    )}
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      {item.status === 'success' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      {item.status === 'error' && (
                        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        </div>
                      )}
                      {item.status === 'uploading' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        </div>
                      )}
                      {item.status === 'pending' && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      {item.status === 'uploading' && (
                        <div className="mt-1">
                          <Progress value={item.progress} className="h-1" />
                        </div>
                      )}
                      {item.status === 'error' && item.error && (
                        <p className="text-xs text-destructive mt-0.5">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {isUploading ? (
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    onClick={onCancel}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                ) : (
                  <>
                    {hasFailures && (
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2" 
                        onClick={onRetryFailed}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retry {stats.failed} Failed
                      </Button>
                    )}
                    <Button 
                      className="flex-1" 
                      onClick={onClose}
                    >
                      {allSuccess ? 'Done' : 'Close'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
