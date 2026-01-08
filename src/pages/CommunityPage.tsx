import { useState, useEffect } from 'react';
import { Users, ThumbsUp, ThumbsDown, Minus, Plus, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';


interface Treatment {
  id: string;
  name: string;
  description: string | null;
  category: string;
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

const CommunityPage = () => {
  const [voterId, setVoterId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentDesc, setNewTreatmentDesc] = useState('');
  const [newTreatmentCategory, setNewTreatmentCategory] = useState('general');

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
    <div className="py-6 space-y-6 w-full max-w-lg mx-auto px-safe">
      {/* Decorative elements */}
      <div className="decorative-blob w-36 h-36 bg-terracotta/25 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-44 h-44 bg-primary/20 bottom-32 -left-16 fixed" />
      
      <div className="flex items-center justify-between animate-fade-in px-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">Community</h1>
          <p className="text-muted-foreground">What's helping others heal</p>
        </div>
        <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <Plus className="w-4 h-4" />
              Suggest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Suggest a Treatment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Treatment Name</label>
                <Input 
                  placeholder="e.g., Vitamin D supplements"
                  value={newTreatmentName}
                  onChange={(e) => setNewTreatmentName(e.target.value)}
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
                <Textarea 
                  placeholder="Brief description of how it helps..."
                  value={newTreatmentDesc}
                  onChange={(e) => setNewTreatmentDesc(e.target.value)}
                  rows={2}
                  className="rounded-xl border-2 resize-none"
                />
              </div>
              <Button 
                onClick={handleSuggest} 
                variant="warm"
                className="w-full h-11 gap-2"
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
      <div className="glass-card-warm p-5 animate-slide-up mx-4" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-terracotta/20 to-coral-light shadow-warm-sm animate-float">
            <Users className="w-6 h-6 text-terracotta" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">Anonymous Voting</h2>
            <p className="text-muted-foreground mt-1">
              Vote on what helps, has no effect, or worsens your symptoms. Help others learn from the community's experience.
            </p>
          </div>
        </div>
      </div>

      {/* Treatments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          {treatments.map((treatment, index) => {
            const percentages = getVotePercentages(treatment);
            
            return (
              <div 
                key={treatment.id} 
                className={cn(
                  'glass-card p-4 transition-all duration-300 animate-slide-up hover:shadow-warm',
                  treatment.userVote === 'helps' && 'ring-2 ring-primary',
                  treatment.userVote === 'neutral' && 'ring-2 ring-amber-500',
                  treatment.userVote === 'harms' && 'ring-2 ring-destructive'
                )}
                style={{ animationDelay: `${0.1 + index * 0.03}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {index < 3 && treatment.totalVotes > 0 && (
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-full shrink-0',
                          index === 0 && 'bg-gradient-to-r from-honey/30 to-honey/10 text-honey',
                          index === 1 && 'bg-muted text-muted-foreground',
                          index === 2 && 'bg-gradient-to-r from-terracotta/20 to-coral-light/20 text-terracotta'
                        )}>
                          #{index + 1}
                        </span>
                      )}
                      <h3 className="font-display font-bold text-foreground">{treatment.name}</h3>
                    </div>
                    {treatment.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {treatment.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-muted font-medium px-2.5 py-1 rounded-full capitalize">
                        {treatment.category}
                      </span>
                      {treatment.totalVotes > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {treatment.totalVotes} votes
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
                    className="gap-1 rounded-xl text-xs px-2"
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
                      'gap-1 rounded-xl text-xs px-2',
                      treatment.userVote === 'neutral' && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
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
                    className="gap-1 rounded-xl text-xs px-2"
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
                    <div className="flex justify-between text-xs text-muted-foreground gap-2">
                      <span className="text-primary font-semibold">
                        👍 {percentages.helps}%
                      </span>
                      <span className="text-amber-600 font-semibold">
                        ➖ {percentages.neutral}%
                      </span>
                      <span className="text-destructive font-semibold">
                        👎 {percentages.harms}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
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