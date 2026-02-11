import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ArrowLeft, Building2, Globe, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlantIllustration } from "@/components/illustrations";

interface Practitioner {
  id: string;
  name: string;
  practitioner_type: string | null;
  city: string;
  country: string;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  services: string[];
  remote_available: boolean;
  about: string | null;
}

const SERVICE_LABELS: Record<string, string> = {
  meditation: "Meditation",
  cap_therapy: "CAP therapy",
  naturopathy: "Naturopathy",
};

const PractitionerDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: practitioner, isLoading, error } = useQuery({
    queryKey: ["practitioner", id],
    queryFn: async () => {
      if (!id) throw new Error("Practitioner ID required");
      const { data, error } = await supabase
        .from("practitioners")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Practitioner;
    },
    enabled: !!id,
  });

  const handleBack = () => navigate("/practitioners");

  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/8 to-sage-light/20 rounded-full blur-3xl" />
          <div className="absolute bottom-40 -left-20 w-48 h-48 bg-gradient-to-tr from-coral/8 to-cream/30 rounded-full blur-2xl" />
        </div>
        <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top relative">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="glass-card p-6 space-y-3">
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !practitioner) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/8 to-sage-light/20 rounded-full blur-3xl" />
        </div>
        <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top relative">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-full bg-card/80 shadow-warm hover:bg-card transition-all active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div className="glass-card py-12 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">Practitioner not found.</p>
            <Button variant="outline" className="mt-4" onClick={handleBack}>
              Back to Directory
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            className="p-2.5 rounded-full bg-card/80 shadow-warm hover:bg-card hover:shadow-warm-md transition-all active:scale-95 touch-manipulation shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/70" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight font-display">
              {practitioner.name}
            </h1>
            {practitioner.practitioner_type && (
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                {practitioner.practitioner_type}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Details card */}
          <div className="glass-card p-6 space-y-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-foreground/90">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{practitioner.city}, {practitioner.country}</span>
            </div>

            {/* Contact */}
            {practitioner.contact_email && (
              <div className="flex items-center gap-2 text-sm text-foreground/90">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${practitioner.contact_email}`} className="text-primary hover:underline truncate">
                  {practitioner.contact_email}
                </a>
              </div>
            )}
            {practitioner.contact_phone && (
              <div className="flex items-center gap-2 text-sm text-foreground/90">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={`tel:${practitioner.contact_phone}`} className="text-primary hover:underline">
                  {practitioner.contact_phone}
                </a>
              </div>
            )}

            {/* Services */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services</p>
              <div className="flex flex-wrap gap-1.5">
                {practitioner.services.map((service) => (
                  <Badge key={service} variant="secondary">
                    {SERVICE_LABELS[service] || service}
                  </Badge>
                ))}
                {practitioner.remote_available && (
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    <Globe className="w-3 h-3 mr-1" />
                    Remote available
                  </Badge>
                )}
              </div>
            </div>

            {/* About */}
            {practitioner.about && (
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">About</p>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {practitioner.about}
                </p>
              </div>
            )}
          </div>

          {/* Website button */}
          {practitioner.website && (
            <Button
              variant="default"
              className="w-full gap-2 h-12 text-base font-semibold shadow-warm hover:shadow-warm-md transition-all animate-slide-up"
              style={{ animationDelay: '0.1s' }}
              asChild
            >
              <a href={practitioner.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Visit website
              </a>
            </Button>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center animate-fade-in" style={{ animationDelay: '0.15s' }}>
            This is a paid listing. TrackTSW does not verify or endorse this practitioner.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PractitionerDetailPage;
