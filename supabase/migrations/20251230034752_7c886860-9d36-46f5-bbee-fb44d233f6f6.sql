-- Drop and recreate the view with security_invoker = false (SECURITY DEFINER behavior)
-- This allows the view to aggregate all votes regardless of RLS on treatment_votes
DROP VIEW IF EXISTS treatment_vote_counts;

CREATE VIEW treatment_vote_counts 
WITH (security_invoker = false)
AS
SELECT 
  treatment_id,
  count(*) AS total_votes,
  count(*) FILTER (WHERE vote_type = 'helps') AS helpful_votes,
  count(*) FILTER (WHERE vote_type = 'neutral') AS neutral_votes,
  count(*) FILTER (WHERE vote_type = 'harms') AS harmful_votes
FROM treatment_votes
GROUP BY treatment_id;

-- Grant access to the view
GRANT SELECT ON treatment_vote_counts TO authenticated;
GRANT SELECT ON treatment_vote_counts TO anon;