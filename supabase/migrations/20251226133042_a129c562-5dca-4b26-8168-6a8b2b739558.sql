-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view their own votes" ON public.treatment_votes;

-- Create a new policy that restricts SELECT to only the user's own votes
CREATE POLICY "Users can view their own votes" 
ON public.treatment_votes 
FOR SELECT 
USING (auth.uid()::text = voter_id);

-- Also fix UPDATE and DELETE policies to properly check ownership
DROP POLICY IF EXISTS "Users can update their own votes" ON public.treatment_votes;
CREATE POLICY "Users can update their own votes" 
ON public.treatment_votes 
FOR UPDATE 
USING (auth.uid()::text = voter_id);

DROP POLICY IF EXISTS "Users can delete their own votes" ON public.treatment_votes;
CREATE POLICY "Users can delete their own votes" 
ON public.treatment_votes 
FOR DELETE 
USING (auth.uid()::text = voter_id);