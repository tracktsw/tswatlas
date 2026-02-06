import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, BookOpen, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

const ResourceCard = ({ resource }: { resource: Resource }) => {
  const title = resource.custom_title || resource.source_domain;
  const summary = resource.custom_summary || resource.ai_summary;
  const isUnavailable = resource.summary_status === "unavailable" || (!summary && resource.summary_status !== "pending");
  const isPending = resource.summary_status === "pending";

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
              {title}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {resource.source_domain}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        <div className="flex-1 mb-4">
          {isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : isUnavailable ? (
            <p className="text-sm text-muted-foreground italic">
              Summary unavailable — tap to view source
            </p>
          ) : (
            <>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {summary}
              </p>
              {!resource.custom_summary && resource.ai_summary && (
                <Badge variant="secondary" className="mt-3 text-[10px] font-normal">
                  Auto-generated educational summary
                </Badge>
              )}
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          asChild
        >
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            View Source
          </a>
        </Button>
      </CardContent>
    </Card>
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
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <p className="text-destructive">Failed to load resources. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">TSW Resources</h1>
        <p className="text-muted-foreground text-sm">
          Educational content about Topical Steroid Withdrawal from trusted sources. 
          All summaries are auto-generated for convenience — always refer to the original source.
        </p>
      </div>

      {!resources || resources.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No resources available yet.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Check back soon for educational content about TSW.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResourcesPage;
