import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BookOpen, ChevronRight, Lightbulb, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { decodeHtmlEntities } from "@/utils/htmlDecode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PlantIllustration, SparkleIllustration } from "@/components/illustrations";

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

// Domain icon mapping for visual variety
const getDomainIcon = (domain: string): string => {
  if (domain.includes('itsan')) return '🌍';
  if (domain.includes('reddit')) return '💬';
  if (domain.includes('youtube')) return '🎬';
  if (domain.includes('pubmed') || domain.includes('ncbi')) return '🔬';
  if (domain.includes('instagram')) return '📸';
  if (domain.includes('facebook')) return '👥';
  return '📄';
};

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
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-full max-w-md bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
        <div className="glass-card-warm p-6 text-center">
          <p className="text-destructive">Failed to load resources. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top relative">
      {/* Decorative elements */}
      <div className="decorative-blob w-36 h-36 bg-honey/20 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-44 h-44 bg-primary/15 bottom-32 -left-16 fixed" />
      <PlantIllustration variant="growing" className="w-16 h-20 fixed top-24 right-2 opacity-20 pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 rounded-full bg-card/80 shadow-warm hover:bg-card hover:shadow-warm-md transition-all active:scale-95 touch-manipulation shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-honey/30 to-honey/10 shadow-sm">
                <BookOpen className="w-5 h-5 text-honey-dark" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">TSW Resources</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Educational content about Topical Steroid Withdrawal
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSuggestModal(true)}
          className="shrink-0 gap-1.5 border-honey/30 hover:bg-honey/10 hover:border-honey/50"
        >
          <Lightbulb className="w-4 h-4 text-honey" />
          Suggest
        </Button>
      </div>

      {!resources || resources.length === 0 ? (
        <div className="glass-card-warm py-12 text-center animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-honey/20 to-coral/10 flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-honey" />
          </div>
          <p className="text-muted-foreground font-medium">No resources available yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Check back soon for educational content about TSW.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((resource, index) => {
            const title = decodeHtmlEntities(resource.custom_title) || resource.source_domain;
            const icon = getDomainIcon(resource.source_domain);
            
            return (
              <button
                key={resource.id}
                onClick={() => handleResourceClick(resource.id)}
                className={cn(
                  "w-full glass-card p-4 text-left transition-all duration-200 animate-slide-up",
                  "hover:shadow-warm-md hover:scale-[1.01] active:scale-[0.99]",
                  "group"
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-sage-light/50 flex items-center justify-center text-xl shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground truncate">
                        {resource.source_domain}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Suggest Article Modal */}
      <Dialog open={showSuggestModal} onOpenChange={setShowSuggestModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-honey" />
              Suggest an Article
            </DialogTitle>
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
              className="h-11"
            />
            <Button 
              className="w-full" 
              onClick={handleSuggestSubmit}
              disabled={suggestMutation.isPending}
            >
              {suggestMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Submit Suggestion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResourcesPage;
