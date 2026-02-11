import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ChevronRight, Globe, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PlantIllustration } from "@/components/illustrations";

interface Practitioner {
  id: string;
  name: string;
  practitioner_type: string | null;
  city: string;
  country: string;
  services: string[];
  remote_available: boolean;
  website: string | null;
  avatar_url: string | null;
}


const PractitionerDirectoryPage = () => {
  const navigate = useNavigate();

  const { data: practitioners, isLoading, error } = useQuery({
    queryKey: ["practitioners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioners")
        .select("id, name, practitioner_type, city, country, services, remote_available, website, avatar_url")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Practitioner[];
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-full max-w-md bg-muted animate-pulse rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 md:px-8 lg:px-12 py-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top">
        <div className="glass-card-warm p-6 text-center">
          <p className="text-destructive">Failed to load directory. Please try again.</p>
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
      <div className="space-y-2 animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-honey/30 to-honey/10 shadow-sm">
            <Building2 className="w-5 h-5 text-honey-dark" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">
            TSW Practitioner Directory
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A curated directory of TSW-focused practitioners
        </p>
        <div className="flex items-start gap-1.5 text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p className="text-xs">
            Practitioners offering TSW-related services can request a listing via the email in Settings.
          </p>
        </div>
      </div>

      {!practitioners || practitioners.length === 0 ? (
        <div className="glass-card-warm py-12 text-center animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-honey/20 to-coral/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-honey" />
          </div>
          <p className="text-muted-foreground font-medium">No practitioners listed yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Check back soon for TSW-supportive clinics.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {practitioners.map((practitioner, index) => (
            <button
              key={practitioner.id}
              onClick={() => navigate(`/practitioners/${practitioner.id}`)}
              className={cn(
                "w-full glass-card p-4 text-left transition-all duration-200 animate-slide-up",
                "hover:shadow-warm-md hover:scale-[1.01] active:scale-[0.99]",
                "group"
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center gap-3">
                {practitioner.avatar_url ? (
                  <img
                    src={practitioner.avatar_url}
                    alt={practitioner.name}
                    className="w-11 h-11 rounded-full object-cover shrink-0 shadow-sm group-hover:shadow-md transition-shadow"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-sage-light/50 flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {practitioner.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {practitioner.city}, {practitioner.country}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {practitioner.services.map((service) => (
                      <Badge
                        key={service}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {service}
                      </Badge>
                    ))}
                    {practitioner.remote_available && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
                      >
                        <Globe className="w-2.5 h-2.5 mr-0.5" />
                        Remote
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PractitionerDirectoryPage;
