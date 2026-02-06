import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, BookOpen, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

const ResourceItem = ({ resource }: { resource: Resource }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const title = resource.custom_title || resource.source_domain;
  const summary = resource.custom_summary || resource.ai_summary;
  const isUnavailable = resource.summary_status === "unavailable" || (!summary && resource.summary_status !== "pending");
  const isPending = resource.summary_status === "pending";
  const isAiGenerated = !resource.custom_summary && resource.ai_summary;

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Collapsed Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 py-4 px-1 text-left hover:bg-muted/50 transition-colors rounded-lg -mx-1 group"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {resource.source_domain}
          </p>
        </div>
        <ChevronDown 
          className={cn(
            "w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} 
        />
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          isExpanded ? "max-h-[500px] opacity-100 pb-4" : "max-h-0 opacity-0"
        )}
      >
        <div className="pl-1 pr-1 space-y-3">
          {isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : isUnavailable ? (
            <p className="text-sm text-muted-foreground italic py-2">
              Summary unavailable — view the source for details.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Summary content - supports both paragraphs and bullet points */}
              <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                {summary}
              </div>
              
              {/* Auto-generated label */}
              {isAiGenerated && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Auto-generated summary
                </Badge>
              )}
            </div>
          )}

          {/* External link button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            asChild
          >
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Read full source
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

const ResourcesPage = () => {
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

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <p className="text-destructive">Failed to load resources. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">TSW Resources</h1>
        <p className="text-muted-foreground text-sm">
          Tap any resource to view a summary. Always refer to the original source for complete information.
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
        <div className="glass-card px-4">
          {resources.map((resource) => (
            <ResourceItem key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResourcesPage;
