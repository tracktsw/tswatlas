import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ChevronRight } from "lucide-react";

interface Resource {
  id: string;
  url: string;
  source_domain: string;
  custom_title: string | null;
  custom_summary: string | null;
  ai_summary: string | null;
  summary_status: string;
  created_at: string;
}

const ResourcesPage = () => {
  const navigate = useNavigate();

  const { data: resources, isLoading, error } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Resource[];
    },
  });

  const handleResourceClick = (resourceId: string) => {
    navigate(`/resources/${resourceId}`);
  };

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full max-w-md bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 max-w-lg md:max-w-none mx-auto">
        <p className="text-destructive">Failed to load resources. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">TSW Resources</h1>
        <p className="text-muted-foreground text-sm">
          Educational content about Topical Steroid Withdrawal. Tap any resource to learn more.
        </p>
      </div>

      {!resources || resources.length === 0 ? (
        <div className="glass-card py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No resources available yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Check back soon for educational content about TSW.
          </p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-border">
          {resources.map((resource) => {
            const title = resource.custom_title || resource.source_domain;
            
            return (
              <button
                key={resource.id}
                onClick={() => handleResourceClick(resource.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground line-clamp-2">
                    {title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {resource.source_domain}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResourcesPage;
