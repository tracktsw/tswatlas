import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ChevronRight, Lightbulb, Loader2, X } from "lucide-react";
import { decodeHtmlEntities } from "@/utils/htmlDecode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Resource {
  id: string;
  url: string;
  source_domain: string;
  custom_title: string | null;
  custom_summary: string | null;
  ai_summary: string | null;
  summary_status: string;
  created_at: string;
  sort_order: number;
}

const ResourcesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestUrl, setSuggestUrl] = useState("");

  const { data: resources, isLoading, error } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as Resource[];
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("resource_suggestions")
        .insert({
          url: url.trim(),
          submitted_by: user?.id || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — your suggestion has been sent for review");
      setSuggestUrl("");
      setShowSuggestModal(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit suggestion");
    },
  });

  const handleSuggestSubmit = () => {
    const trimmedUrl = suggestUrl.trim();
    if (!trimmedUrl) {
      toast.error("Please enter a URL");
      return;
    }
    
    // Basic URL validation
    try {
      new URL(trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }
    
    suggestMutation.mutate(trimmedUrl);
  };

  const handleResourceClick = (resourceId: string) => {
    navigate(`/resources/${resourceId}`);
  };

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
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
      <div className="px-4 md:px-8 lg:px-12 py-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
        <p className="text-destructive">Failed to load resources. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">TSW Resources</h1>
          <p className="text-muted-foreground text-sm">
            Educational content about Topical Steroid Withdrawal. Tap any resource to learn more.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSuggestModal(true)}
          className="shrink-0"
        >
          <Lightbulb className="w-4 h-4 mr-1" />
          Suggest
        </Button>
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
            const title = decodeHtmlEntities(resource.custom_title) || resource.source_domain;
            
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

      {/* Suggest Article Modal */}
      <Dialog open={showSuggestModal} onOpenChange={setShowSuggestModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Suggest an Article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Know a helpful TSW resource? Share the link and we'll review it.
            </p>
            <Input
              value={suggestUrl}
              onChange={(e) => setSuggestUrl(e.target.value)}
              placeholder="https://example.com/article"
              type="url"
              autoComplete="url"
            />
            <Button 
              className="w-full" 
              onClick={handleSuggestSubmit}
              disabled={suggestMutation.isPending}
            >
              {suggestMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Suggest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResourcesPage;
