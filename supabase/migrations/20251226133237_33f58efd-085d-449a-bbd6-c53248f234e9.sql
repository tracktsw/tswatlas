-- Create a view that provides aggregate vote counts per treatment
-- This exposes only aggregates, not individual voter data
CREATE VIEW public.treatment_vote_counts AS
SELECT 
  treatment_id,
  COUNT(*) AS total_votes,
  COUNT(*) FILTER (WHERE helps = true) AS helpful_votes,
  COUNT(*) FILTER (WHERE helps = false) AS harmful_votes
FROM public.treatment_votes
GROUP BY treatment_id;

-- Grant SELECT access on the view to all users (including anonymous)
-- This is safe because the view only contains aggregated data
GRANT SELECT ON public.treatment_vote_counts TO anon, authenticated;