import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TopTreatment {
  id: string;
  name: string;
  category: string;
  helpfulVotes: number;
  totalVotes: number;
  helpfulPercentage: number;
}

export const useTopTreatments = (limit = 3) => {
  return useQuery({
    queryKey: ['top-treatments', limit],
    queryFn: async (): Promise<TopTreatment[]> => {
      // OPTIMIZED: Fetch treatments and vote counts in PARALLEL
      const [treatmentsResult, voteCountsResult] = await Promise.all([
        supabase
          .from('treatments')
          .select('id, name, category')
          .eq('is_approved', true),
        supabase
          .from('treatment_vote_counts')
          .select('*'),
      ]);

      if (treatmentsResult.error) throw treatmentsResult.error;
      if (voteCountsResult.error) throw voteCountsResult.error;

      const treatments = treatmentsResult.data;
      const voteCounts = voteCountsResult.data;

      // Combine treatments with vote counts
      const treatmentsWithVotes = treatments?.map(treatment => {
        const votes = voteCounts?.find(v => v.treatment_id === treatment.id);
        const totalVotes = Number(votes?.total_votes || 0);
        const helpfulVotes = Number(votes?.helpful_votes || 0);
        const harmfulVotes = Number(votes?.harmful_votes || 0);
        
        // Calculate score: (helpful - harmful) / total, or 0 if no votes
        const score = totalVotes > 0 ? (helpfulVotes - harmfulVotes) / totalVotes : 0;
        const helpfulPercentage = totalVotes > 0 ? Math.round((helpfulVotes / totalVotes) * 100) : 0;

        return {
          id: treatment.id,
          name: treatment.name,
          category: treatment.category,
          helpfulVotes,
          totalVotes,
          helpfulPercentage,
          score
        };
      }) || [];

      // Filter out treatments with no votes, sort by score, and return top N
      return treatmentsWithVotes
        .filter(t => t.totalVotes > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ score, ...rest }) => rest); // Remove score from final output
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
