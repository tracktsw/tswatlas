import { useState } from 'react';
import { Users, ThumbsUp, Plus, Send, Loader2 } from 'lucide-react';
import { useLocalStorage } from '@/contexts/LocalStorageContext';
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
  userVoted: boolean;
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
  const { voterId } = useLocalStorage();
  const queryClient = useQueryClient();
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentDesc, setNewTreatmentDesc] = useState('');
  const [newTreatmentCategory, setNewTreatmentCategory] = useState('general');

  // Fetch treatments with votes
  const { data: treatments = [], isLoading } = useQuery({
    queryKey: ['treatments', voterId],
    queryFn: async () => {
      const { data: treatmentData, error: treatmentError } = await supabase
        .from('treatments')
        .select('*')
        .eq('is_approved', true);

      if (treatmentError) throw treatmentError;

      const { data: voteData, error: voteError } = await supabase
        .from('treatment_votes')
        .select('*');

      if (voteError) throw voteError;

      const treatmentsWithVotes: TreatmentWithVotes[] = (treatmentData || []).map(treatment => {
        const votes = voteData?.filter(v => v.treatment_id === treatment.id) || [];
        const helpfulVotes = votes.filter(v => v.helps).length;
        const userVoted = votes.some(v => v.voter_id === voterId);

        return {
          ...treatment,
          totalVotes: votes.length,
          helpfulVotes,
          userVoted,
        };
      });

      return treatmentsWithVotes.sort((a, b) => {
        if (a.totalVotes === 0 && b.totalVotes === 0) return 0;
        if (a.totalVotes === 0) return 1;
        if (b.totalVotes === 0) return -1;
        const aPercent = a.helpfulVotes / a.totalVotes;
        const bPercent = b.helpfulVotes / b.totalVotes;
        return bPercent - aPercent || b.totalVotes - a.totalVotes;
      });
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (treatmentId: string) => {
      const existing = treatments.find(t => t.id === treatmentId);
      
      if (existing?.userVoted) {
        // Remove vote
        const { error } = await supabase
          .from('treatment_votes')
          .delete()
          .eq('treatment_id', treatmentId)
          .eq('voter_id', voterId);
        if (error) throw error;
      } else {
        // Add vote
        const { error } = await supabase
          .from('treatment_votes')
          .insert({
            treatment_id: treatmentId,
            voter_id: voterId,
            helps: true,
          });
        if (error) throw error;
      }
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

  const handleVote = (treatmentId: string) => {
    voteMutation.mutate(treatmentId);
  };

  const handleSuggest = () => {
    if (!newTreatmentName.trim()) {
      toast.error('Please enter a treatment name');
      return;
    }
    suggestMutation.mutate();
  };

  const getPercentage = (treatment: TreatmentWithVotes) => {
    if (treatment.totalVotes === 0) return 0;
    return Math.round((treatment.helpfulVotes / treatment.totalVotes) * 100);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Community</h1>
          <p className="text-sm text-muted-foreground">What's helping others heal</p>
        </div>
        <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Suggest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Suggest a Treatment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Treatment Name</label>
                <Input 
                  placeholder="e.g., Vitamin D supplements"
                  value={newTreatmentName}
                  onChange={(e) => setNewTreatmentName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={newTreatmentCategory} onValueChange={setNewTreatmentCategory}>
                  <SelectTrigger>
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
                <label className="text-sm font-medium mb-2 block">Description (optional)</label>
                <Textarea 
                  placeholder="Brief description of how it helps..."
                  value={newTreatmentDesc}
                  onChange={(e) => setNewTreatmentDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <Button 
                onClick={handleSuggest} 
                className="w-full gap-2"
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
      <div className="glass-card p-4 warm-gradient">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/20">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Anonymous Voting</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tap "This helps me" on treatments that work for you. See what's helping the TSW community heal.
            </p>
          </div>
        </div>
      </div>

      {/* Treatments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {treatments.map((treatment, index) => {
            const percentage = getPercentage(treatment);
            return (
              <div 
                key={treatment.id} 
                className={cn(
                  'glass-card p-4 transition-all',
                  treatment.userVoted && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {index < 3 && treatment.totalVotes > 0 && (
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          index === 0 && 'bg-yellow-500/20 text-yellow-700',
                          index === 1 && 'bg-gray-400/20 text-gray-600',
                          index === 2 && 'bg-amber-600/20 text-amber-700'
                        )}>
                          #{index + 1}
                        </span>
                      )}
                      <h3 className="font-semibold text-foreground">{treatment.name}</h3>
                    </div>
                    {treatment.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {treatment.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                        {treatment.category}
                      </span>
                      {treatment.totalVotes > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {percentage}% find this helpful ({treatment.totalVotes} votes)
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant={treatment.userVoted ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleVote(treatment.id)}
                    disabled={voteMutation.isPending}
                    className="shrink-0 gap-1"
                  >
                    <ThumbsUp className={cn(
                      'w-4 h-4',
                      treatment.userVoted && 'fill-current'
                    )} />
                    {treatment.userVoted ? 'Voted' : 'Helps me'}
                  </Button>
                </div>
                {treatment.totalVotes > 0 && (
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
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
