-- Step 1: Drop the existing view that depends on the 'helps' column
DROP VIEW IF EXISTS public.treatment_vote_counts;

-- Step 2: Add new vote_type column to treatment_votes table
ALTER TABLE public.treatment_votes 
ADD COLUMN vote_type text;

-- Step 3: Migrate existing data from boolean 'helps' to text 'vote_type'
UPDATE public.treatment_votes 
SET vote_type = CASE 
  WHEN helps = true THEN 'helps'
  WHEN helps = false THEN 'harms'
  ELSE 'neutral'
END;

-- Step 4: Make vote_type NOT NULL after migration
ALTER TABLE public.treatment_votes 
ALTER COLUMN vote_type SET NOT NULL;

-- Step 5: Add constraint to ensure valid vote types
ALTER TABLE public.treatment_votes 
ADD CONSTRAINT vote_type_check CHECK (vote_type IN ('helps', 'neutral', 'harms'));

-- Step 6: Drop the old boolean column
ALTER TABLE public.treatment_votes 
DROP COLUMN helps;

-- Step 7: Recreate the view to include neutral votes
CREATE VIEW public.treatment_vote_counts AS
SELECT 
  treatment_id,
  COUNT(*) AS total_votes,
  COUNT(*) FILTER (WHERE vote_type = 'helps') AS helpful_votes,
  COUNT(*) FILTER (WHERE vote_type = 'neutral') AS neutral_votes,
  COUNT(*) FILTER (WHERE vote_type = 'harms') AS harmful_votes
FROM public.treatment_votes
GROUP BY treatment_id;