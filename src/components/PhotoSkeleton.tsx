import { Skeleton } from '@/components/ui/skeleton';

interface PhotoSkeletonProps {
  count?: number;
}

export const PhotoSkeleton = ({ count = 4 }: PhotoSkeletonProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index} 
          className="glass-card overflow-hidden animate-pulse"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <Skeleton className="w-full aspect-square" />
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};
