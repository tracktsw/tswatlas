import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ArrowLeft, Loader2, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { decodeHtmlEntities } from "@/utils/htmlDecode";
import { PlantIllustration } from "@/components/illustrations";

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
      <div className="min-h-screen relative overflow-hidden">
        {/* Decorative background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/8 to-sage-light/20 rounded-full blur-3xl" />
          <div className="absolute bottom-40 -left-20 w-48 h-48 bg-gradient-to-tr from-coral/8 to-cream/30 rounded-full blur-2xl" />
        </div>
        
        <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top relative">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="glass-card p-6 space-y-3">
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Decorative background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/8 to-sage-light/20 rounded-full blur-3xl" />
        </div>
        
        <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top relative">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-full bg-white/80 shadow-warm hover:bg-white transition-all active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div className="glass-card py-12 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">Resource not found.</p>
            <Button variant="outline" className="mt-4" onClick={handleBack}>
              Back to Resources
            </Button>
          </div>
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/8 to-sage-light/20 rounded-full blur-3xl" />
        <div className="absolute bottom-40 -left-20 w-48 h-48 bg-gradient-to-tr from-coral/8 to-cream/30 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-8 opacity-[0.04]">
          <PlantIllustration className="w-32 h-32" />
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-12 py-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top relative">
        {/* Header with back button */}
        <div className="flex items-start gap-3 mb-6 animate-fade-in">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-full bg-white/80 shadow-warm hover:bg-white hover:shadow-warm-md transition-all active:scale-95 touch-manipulation shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight font-display">
              {title}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {resource.source_domain}
              </span>
            </div>
          </div>
        </div>

        {/* Summary content */}
        <div className="space-y-4">
          {isPending ? (
            <div className="glass-card p-6 animate-slide-up">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-sage-light/30 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground/80">Generating summary...</p>
                  <p className="text-xs text-muted-foreground">This usually takes a few seconds</p>
                </div>
              </div>
            </div>
          ) : isUnavailable ? (
            <div className="glass-card p-6 animate-slide-up">
              <p className="text-muted-foreground italic">
                Summary unavailable for this resource. Please view the original source for details.
              </p>
            </div>
          ) : (
            <div className="glass-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
              {/* Auto-generated label at top */}
              {isAiGenerated && (
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary/60" />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    Auto-generated summary
                  </span>
                </div>
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
            className="w-full gap-2 h-12 text-base font-semibold shadow-warm hover:shadow-warm-md transition-all animate-slide-up"
            style={{ animationDelay: '0.1s' }}
            asChild
          >
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Read full source
            </a>
          </Button>

          {/* Attribution notice */}
          <p className="text-xs text-muted-foreground text-center animate-fade-in" style={{ animationDelay: '0.15s' }}>
            Content sourced from {resource.source_domain}. The original website remains the authoritative source.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResourceDetailPage;
