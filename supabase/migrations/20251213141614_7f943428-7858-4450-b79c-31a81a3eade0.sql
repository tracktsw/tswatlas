-- Allow users to update their own check-ins
CREATE POLICY "Users can update their own check-ins" 
ON public.user_check_ins 
FOR UPDATE 
USING (auth.uid() = user_id);