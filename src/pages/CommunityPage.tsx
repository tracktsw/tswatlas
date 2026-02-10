import { useState, useEffect, useRef, useMemo } from 'react';
import { Users, ThumbsUp, ThumbsDown, Minus, Plus, Send, Loader2, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AndroidSafeInput } from '@/components/ui/android-safe-input';
import { AndroidSafeTextarea } from '@/components/ui/android-safe-textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import TreatmentStatusBadge from '@/components/TreatmentStatusBadge';
import { PlantIllustration } from '@/components/illustrations';


interface Treatment {
  id: string;
  name: string;
  description: string | null;
  category: string;
  banner_text: string | null;
}

interface TreatmentWithVotes extends Treatment {
  totalVotes: number;
  helpfulVotes: number;
  neutralVotes: number;
  harmfulVotes: number;
  userVote: 'helps' | 'neutral' | 'harms' | null;
}

const categories = [
  { value: 'moisture', label: 'Moisture' },
  { value: 'therapy', label: 'Therapy' },
  { value: 'bathing', label: 'Bathing' },
  { value: 'relief', label: 'Relief' },
  { value: 'medication', label: 'Medication' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'supplements', label: 'Supplements' },
  { value: 'protection', label: 'Protection' },
  { value: 'general', label: 'General' },
];

// Session storage key for persisting selected category
const CATEGORY_FILTER_KEY = 'community_category_filter';

const CommunityPage = () => {
  const [voterId, setVoterId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentDesc, setNewTreatmentDesc] = useState('');
  const [newTreatmentCategory, setNewTreatmentCategory] = useState('general');
  
  // Category filter state - persist in session storage
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(CATEGORY_FILTER_KEY) || 'all';
    }
    return 'all';
  });

  // Refs for inputs
  const treatmentNameRef = useRef<HTMLInputElement>(null);
  const treatmentDescRef = useRef<HTMLTextAreaElement>(null);

  // Persist category selection to session storage
  useEffect(() => {
    sessionStorage.setItem(CATEGORY_FILTER_KEY, selectedCategory);
  }, [selectedCategory]);

  // Get user ID for voting
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setVoterId(user?.id || null);
    };
    getUser();
  }, []);

  // Fetch treatments with aggregate vote counts (public) and user's own votes (private)
  const { data: treatments = [], isLoading } = useQuery({
    queryKey: ['treatments', voterId],
    queryFn: async () => {
      // Fetch approved treatments
      const { data: treatmentData, error: treatmentError } = await supabase
        .from('treatments')
        .select('*')
        .eq('is_approved', true);

      if (treatmentError) throw treatmentError;

      // Fetch aggregate vote counts from the public view (no voter IDs exposed)
      const { data: voteCounts, error: voteCountError } = await supabase
        .from('treatment_vote_counts')
        .select('*');

      if (voteCountError) throw voteCountError;

      // Fetch only the current user's votes (if logged in)
      let userVotes: { treatment_id: string; vote_type: string }[] = [];
      if (voterId) {
        const { data: userVoteData, error: userVoteError } = await supabase
          .from('treatment_votes')
          .select('treatment_id, vote_type');

        if (!userVoteError && userVoteData) {
          userVotes = userVoteData;
        }
      }

      // Combine treatments with vote counts and user's vote status
      const treatmentsWithVotes: TreatmentWithVotes[] = (treatmentData || []).map(treatment => {
        const counts = voteCounts?.find(v => v.treatment_id === treatment.id);
        const userVoteData = userVotes.find(v => v.treatment_id === treatment.id);
        
        return {
          ...treatment,
          totalVotes: Number(counts?.total_votes || 0),
          helpfulVotes: Number(counts?.helpful_votes || 0),
          neutralVotes: Number((counts as any)?.neutral_votes || 0),
          harmfulVotes: Number(counts?.harmful_votes || 0),
          userVote: userVoteData ? (userVoteData.vote_type as 'helps' | 'neutral' | 'harms') : null,
        };
      });

      // Sort all treatments by score (this is the base ranking)
      return treatmentsWithVotes.sort((a, b) => {
        if (a.totalVotes === 0 && b.totalVotes === 0) return 0;
        if (a.totalVotes === 0) return 1;
        if (b.totalVotes === 0) return -1;
        const aScore = (a.helpfulVotes - a.harmfulVotes) / a.totalVotes;
        const bScore = (b.helpfulVotes - b.harmfulVotes) / b.totalVotes;
        return bScore - aScore || b.totalVotes - a.totalVotes;
      });
    },
  });

  // Filter treatments by category (view-layer only - doesn't affect votes/rankings)
  const filteredTreatments = useMemo(() => {
    if (selectedCategory === 'all') return treatments;
    return treatments.filter(t => t.category === selectedCategory);
  }, [treatments, selectedCategory]);

  // Handle category selection and pre-fill suggestion category
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  // Open suggestion dialog with pre-selected category
  const handleOpenSuggestion = () => {
    if (selectedCategory !== 'all') {
      setNewTreatmentCategory(selectedCategory);
    }
    setSuggestionOpen(true);
  };

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ treatmentId, voteType }: { treatmentId: string; voteType: 'helps' | 'neutral' | 'harms' }) => {
      const existing = treatments.find(t => t.id === treatmentId);
      
      if (existing?.userVote) {
        // User already voted - delete existing vote first
        await supabase
          .from('treatment_votes')
          .delete()
          .eq('treatment_id', treatmentId)
          .eq('voter_id', voterId);
        
        // If clicking the same button, just remove (toggle off)
        if (existing.userVote === voteType) {
          return;
        }
      }
      
      // Add new vote
      const { error } = await supabase
        .from('treatment_votes')
        .insert({
          treatment_id: treatmentId,
          voter_id: voterId,
          vote_type: voteType,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
    },
    onError: () => {
      toast.error('Failed to record vote');
    },
  });

  // Suggest treatment mutation
  const suggestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('treatment_suggestions')
        .insert({
          name: newTreatmentName.trim(),
          description: newTreatmentDesc.trim() || null,
          category: newTreatmentCategory,
          suggested_by: voterId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Suggestion submitted!', {
        description: 'Your treatment suggestion will be reviewed.',
      });
      setNewTreatmentName('');
      setNewTreatmentDesc('');
      setNewTreatmentCategory('general');
      setSuggestionOpen(false);
    },
    onError: () => {
      toast.error('Failed to submit suggestion');
    },
  });

  const handleVote = (treatmentId: string, voteType: 'helps' | 'neutral' | 'harms') => {
    voteMutation.mutate({ treatmentId, voteType });
  };

  const handleSuggest = () => {
    if (!newTreatmentName.trim()) {
      toast.error('Please enter a treatment name');
      return;
    }
    suggestMutation.mutate();
  };

  const getVotePercentages = (treatment: TreatmentWithVotes) => {
    if (treatment.totalVotes === 0) return { helps: 0, neutral: 0, harms: 0 };
    return {
      helps: Math.round((treatment.helpfulVotes / treatment.totalVotes) * 100),
      neutral: Math.round((treatment.neutralVotes / treatment.totalVotes) * 100),
      harms: Math.round((treatment.harmfulVotes / treatment.totalVotes) * 100),
    };
  };

  return (
    <div className="py-6 space-y-6 w-full max-w-lg md:max-w-none mx-auto px-safe md:px-8 lg:px-12 safe-area-inset-top relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-16 -right-16 w-56 h-56 bg-gradient-to-br from-terracotta/12 to-coral/8 rounded-full blur-3xl" />
        <div className="absolute bottom-40 -left-20 w-48 h-48 bg-gradient-to-tr from-primary/10 to-sage-light/20 rounded-full blur-2xl" />
        <div className="absolute top-1/2 right-4 opacity-[0.03]">
          <PlantIllustration className="w-28 h-28" />
        </div>
      </div>
        <div className="flex items-center justify-between animate-fade-in px-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Community</h1>
            <p className="text-sm text-muted-foreground mt-0.5">What's helping others heal</p>
          </div>
          <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 rounded-xl bg-card/80 shadow-warm hover:shadow-warm-md hover:bg-card transition-all" 
                onClick={handleOpenSuggestion}
              >
                <Plus className="w-4 h-4" />
                Suggest
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-sage-light/40 flex items-center justify-center shadow-warm-sm">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <DialogTitle className="font-display text-xl">Suggest a Treatment</DialogTitle>
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Treatment Name</label>
                  <AndroidSafeInput 
                    ref={treatmentNameRef}
                    placeholder="e.g., Vitamin D supplements"
                    value={newTreatmentName}
                    onValueChange={setNewTreatmentName}
                    className="h-11 rounded-xl border-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Category</label>
                  <Select value={newTreatmentCategory} onValueChange={setNewTreatmentCategory}>
                    <SelectTrigger className="h-11 rounded-xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Description (optional)</label>
                  <AndroidSafeTextarea 
                    ref={treatmentDescRef}
                    placeholder="Brief description of how it helps..."
                    value={newTreatmentDesc}
                    onValueChange={setNewTreatmentDesc}
                    rows={2}
                    className="rounded-xl border-2 resize-none"
                  />
                </div>
                <Button 
                  onClick={handleSuggest} 
                  variant="warm"
                  className="w-full h-11 gap-2 shadow-warm hover:shadow-warm-md"
                  disabled={suggestMutation.isPending}
                >
                  {suggestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Suggestion
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info Card */}
        <div className="glass-card p-5 animate-slide-up mx-4 border-primary/10" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-terracotta/15 to-coral-light/30 shadow-warm-sm shrink-0">
              <Users className="w-6 h-6 text-terracotta" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-foreground">Anonymous Voting</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Vote on what helps, has no effect, or worsens your symptoms. Help others learn from the community's experience.
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="px-4 animate-slide-up" style={{ animationDelay: '0.08s' }}>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategorySelect('all')}
                className={cn(
                  'rounded-full px-4 shrink-0 transition-all h-9',
                    selectedCategory === 'all' 
                      ? 'shadow-warm' 
                      : 'bg-card/70 hover:bg-card/90 border-border/50'
                )}
              >
                All
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategorySelect(cat.value)}
                  className={cn(
                    'rounded-full px-4 shrink-0 transition-all h-9',
                    selectedCategory === cat.value 
                      ? 'shadow-warm' 
                      : 'bg-card/70 hover:bg-card/90 border-border/50'
                  )}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>

        {/* Treatments List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-sage-light/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Loading treatments...</p>
          </div>
        ) : filteredTreatments.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 mb-4 shadow-warm-sm">
              <Users className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg text-foreground mb-2">
              No treatments yet in this category
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">
              Be the first to suggest a {selectedCategory !== 'all' ? categories.find(c => c.value === selectedCategory)?.label.toLowerCase() : ''} treatment for the community.
            </p>
            <Button variant="warm" onClick={handleOpenSuggestion} className="gap-2 shadow-warm">
              <Plus className="w-4 h-4" />
              Suggest a Treatment
            </Button>
          </div>
        ) : (
          <div className="space-y-3 px-4">
            {filteredTreatments.map((treatment, index) => {
              const percentages = getVotePercentages(treatment);
              
              return (
                <div 
                  key={treatment.id} 
                  className={cn(
                    'glass-card p-4 transition-all duration-200 animate-slide-up',
                    'hover:shadow-warm-md active:scale-[0.99]',
                    treatment.userVote === 'helps' && 'ring-2 ring-primary/70 bg-primary/[0.02]',
                    treatment.userVote === 'neutral' && 'ring-2 ring-amber-500/70 bg-amber-500/[0.02]',
                    treatment.userVote === 'harms' && 'ring-2 ring-destructive/70 bg-destructive/[0.02]'
                  )}
                  style={{ animationDelay: `${0.1 + index * 0.03}s` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {index < 3 && treatment.totalVotes > 0 && (
                          <span className={cn(
                            'text-xs font-bold px-2.5 py-1 rounded-full shrink-0 shadow-sm',
                            index === 0 && 'bg-gradient-to-r from-honey/40 to-honey/20 text-honey-dark border border-honey/30',
                            index === 1 && 'bg-gradient-to-r from-muted to-muted/70 text-muted-foreground border border-border/50',
                            index === 2 && 'bg-gradient-to-r from-terracotta/25 to-coral-light/25 text-terracotta border border-terracotta/20'
                          )}>
                            #{index + 1}
                          </span>
                        )}
                        <h3 className="font-display font-bold text-foreground">{treatment.name}</h3>
                        <TreatmentStatusBadge text={treatment.banner_text} />
                      </div>
                      {treatment.description && (
                        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                          {treatment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-muted/80 font-medium px-2.5 py-1 rounded-full capitalize border border-border/30">
                          {treatment.category}
                        </span>
                        {treatment.totalVotes > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {treatment.totalVotes} vote{treatment.totalVotes !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Voting buttons - 3 options */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button
                      variant={treatment.userVote === 'helps' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleVote(treatment.id, 'helps')}
                      disabled={voteMutation.isPending}
                      className={cn(
                        'gap-1 rounded-xl text-xs px-2 h-9 transition-all',
                        treatment.userVote !== 'helps' && 'bg-card/80 hover:bg-card border-border/50'
                      )}
                    >
                      <ThumbsUp className={cn(
                        'w-3.5 h-3.5',
                        treatment.userVote === 'helps' && 'fill-current'
                      )} />
                      Helps
                    </Button>
                    <Button
                      variant={treatment.userVote === 'neutral' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleVote(treatment.id, 'neutral')}
                      disabled={voteMutation.isPending}
                      className={cn(
                        'gap-1 rounded-xl text-xs px-2 h-9 transition-all',
                        treatment.userVote === 'neutral' 
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                          : 'bg-card/80 hover:bg-card border-border/50'
                      )}
                    >
                      <Minus className="w-3.5 h-3.5" />
                      No change
                    </Button>
                    <Button
                      variant={treatment.userVote === 'harms' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleVote(treatment.id, 'harms')}
                      disabled={voteMutation.isPending}
                      className={cn(
                        'gap-1 rounded-xl text-xs px-2 h-9 transition-all',
                        treatment.userVote !== 'harms' && 'bg-card/80 hover:bg-card border-border/50'
                      )}
                    >
                      <ThumbsDown className={cn(
                        'w-3.5 h-3.5',
                        treatment.userVote === 'harms' && 'fill-current'
                      )} />
                      Worsens
                    </Button>
                  </div>
                  
                  {/* Vote breakdown bar - segmented */}
                  {treatment.totalVotes > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs gap-2">
                        <span className="text-primary font-semibold flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {percentages.helps}%
                        </span>
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <Minus className="w-3 h-3" />
                          {percentages.neutral}%
                        </span>
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3" />
                          {percentages.harms}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted/60 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                          style={{ width: `${percentages.helps}%` }}
                        />
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                          style={{ width: `${percentages.neutral}%` }}
                        />
                        <div 
                          className="h-full bg-gradient-to-r from-destructive/80 to-destructive transition-all duration-500"
                          style={{ width: `${percentages.harms}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
};

export default CommunityPage;