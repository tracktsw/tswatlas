-- Add symptoms_experienced column to user_check_ins
ALTER TABLE public.user_check_ins 
ADD COLUMN symptoms_experienced text[] DEFAULT '{}'::text[];