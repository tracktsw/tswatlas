import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { decodeHtmlEntities } from "@/utils/htmlDecode";

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

const ResourceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: resource, isLoading, error } = useQuery({
    queryKey: ["resource", id],
    queryFn: async () => {
      if (!id) throw new Error("Resource ID required");
      
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Resource;
    },
    enabled: !!id,
  });

  const handleBack = () => {
    navigate("/resources");
  };

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
        <button
          onClick={handleBack}
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="glass-card py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Resource not found.</p>
          <Button variant="outline" className="mt-4" onClick={handleBack}>
            Back to Resources
          </Button>
        </div>
      </div>
    );
  }

  const title = decodeHtmlEntities(resource.custom_title) || resource.source_domain;
  const summary = decodeHtmlEntities(resource.custom_summary) || decodeHtmlEntities(resource.ai_summary);
  const isUnavailable = resource.summary_status === "unavailable" || (!summary && resource.summary_status !== "pending");
  const isPending = resource.summary_status === "pending";
  const isAiGenerated = !resource.custom_summary && resource.ai_summary;

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
      {/* Header with back button */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={handleBack}
          className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {resource.source_domain}
          </p>
        </div>
      </div>

      {/* Summary content */}
      <div className="space-y-4">
        {isPending ? (
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating summary...</span>
            </div>
          </div>
        ) : isUnavailable ? (
          <div className="glass-card p-6">
            <p className="text-muted-foreground italic">
              Summary unavailable for this resource. Please view the original source for details.
            </p>
          </div>
        ) : (
          <div className="glass-card p-6 space-y-4">
            {/* Auto-generated label at top */}
            {isAiGenerated && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Auto-generated summary
              </Badge>
            )}
            
            {/* Summary text - fully visible, no clipping */}
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {summary}
            </div>
          </div>
        )}

        {/* External link button */}
        <Button
          variant="default"
          className="w-full gap-2"
          asChild
        >
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Read full source
          </a>
        </Button>

        {/* Attribution notice */}
        <p className="text-xs text-muted-foreground text-center">
          Content sourced from {resource.source_domain}. The original website remains the authoritative source.
        </p>
      </div>
    </div>
  );
};

export default ResourceDetailPage;
