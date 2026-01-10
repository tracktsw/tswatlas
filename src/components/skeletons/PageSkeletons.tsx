import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Shared decorative blobs for consistent styling
const DecorativeBlobs = () => (
  <>
    <div className="decorative-blob w-40 h-40 bg-sage/20 -top-10 -right-10 fixed" />
    <div className="decorative-blob w-48 h-48 bg-healing/15 bottom-40 -left-20 fixed" />
  </>
);

// Home Page Skeleton
export const HomePageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-10 h-10 rounded-2xl" />
      </div>
    </div>

    {/* Progress Card */}
    <div className="glass-card p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <div className="flex-1">
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    </div>

    {/* Today's Status */}
    <div className="glass-card p-5">
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center p-3 rounded-2xl bg-muted/50">
            <Skeleton className="h-7 w-10 mx-auto mb-2" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>

    {/* Community Favorites */}
    <div className="glass-card p-5">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Quick Actions */}
    <div className="space-y-4">
      <Skeleton className="h-5 w-28" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-4">
            <Skeleton className="w-11 h-11 rounded-xl mb-3" />
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Photo Diary Page Skeleton
export const PhotoDiaryPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
    </div>

    {/* Filters */}
    <div className="flex items-center gap-2">
      <Skeleton className="h-10 flex-1 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>

    {/* Photo Grid */}
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <Skeleton 
          key={i} 
          className="aspect-square rounded-xl" 
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  </div>
);

// Check-In Page Skeleton
export const CheckInPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div>
      <Skeleton className="h-7 w-28 mb-2" />
      <Skeleton className="h-4 w-40" />
    </div>

    {/* Time of Day Toggle */}
    <div className="glass-card p-4">
      <div className="flex gap-2">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 flex-1 rounded-xl" />
      </div>
    </div>

    {/* Mood Section */}
    <div className="glass-card p-5">
      <Skeleton className="h-5 w-24 mb-4" />
      <div className="flex justify-between">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="w-12 h-12 rounded-full" />
        ))}
      </div>
    </div>

    {/* Skin Section */}
    <div className="glass-card p-5">
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="flex justify-between">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="w-12 h-12 rounded-full" />
        ))}
      </div>
    </div>

    {/* Treatments Section */}
    <div className="glass-card p-5">
      <Skeleton className="h-5 w-28 mb-4" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    </div>
  </div>
);

// Insights Page Skeleton
export const InsightsPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div>
      <Skeleton className="h-7 w-24 mb-2" />
      <Skeleton className="h-4 w-36" />
    </div>

    {/* Flare Status */}
    <Skeleton className="h-14 w-full rounded-2xl" />

    {/* Weekly Overview */}
    <div className="glass-card p-5">
      <Skeleton className="h-5 w-28 mb-4" />
      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex-1 text-center">
            <Skeleton className="h-3 w-8 mx-auto mb-2" />
            <Skeleton className="aspect-square rounded-2xl" />
          </div>
        ))}
      </div>
    </div>

    {/* Chart Sections */}
    {[1, 2].map((i) => (
      <div key={i} className="glass-card p-5">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

// Community Page Skeleton
export const CommunityPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="w-10 h-10 rounded-xl" />
    </div>

    {/* Treatment Cards */}
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

// Journal Page Skeleton
export const JournalPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="w-24 h-10 rounded-xl" />
    </div>

    {/* Journal Entries */}
    {[1, 2, 3].map((i) => (
      <div key={i} className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);

// Coach Page Skeleton
export const CoachPageSkeleton = () => (
  <div className="flex flex-col h-full relative animate-fade-in">
    {/* Header */}
    <div className="px-4 pt-4 pb-4 border-b border-border/60 bg-card/50">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-2xl" />
        <div>
          <Skeleton className="h-5 w-20 mb-1" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>

    {/* Chat Area */}
    <div className="flex-1 p-4 space-y-4">
      {/* AI Message */}
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 max-w-[80%]">
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
      
      {/* User Message */}
      <div className="flex gap-3 justify-end">
        <div className="max-w-[80%]">
          <Skeleton className="h-12 w-48 rounded-2xl" />
        </div>
      </div>
      
      {/* AI Response */}
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="flex-1 max-w-[80%]">
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>

    {/* Input Area */}
    <div className="p-4 border-t border-border/60">
      <div className="flex gap-2">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  </div>
);

// Settings Page Skeleton
export const SettingsPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    
    {/* Header */}
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="h-7 w-24" />
    </div>

    {/* Settings Sections */}
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="glass-card p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2].map((j) => (
            <div key={j} className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    ))}

    {/* Sign Out Button */}
    <Skeleton className="h-12 w-full rounded-xl" />
  </div>
);

// Generic Page Skeleton (fallback)
export const GenericPageSkeleton = () => (
  <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative animate-fade-in">
    <DecorativeBlobs />
    <Skeleton className="h-7 w-32 mb-2" />
    <Skeleton className="h-4 w-48" />
    <div className="glass-card p-5">
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
    <div className="glass-card p-5">
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  </div>
);
