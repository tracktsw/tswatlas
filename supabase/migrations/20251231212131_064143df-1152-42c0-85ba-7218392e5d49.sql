-- Add sleep_score column to user_check_ins table
-- Sleep quality scale: 1=Very poor, 2=Poor, 3=Okay, 4=Good, 5=Very good (nullable)
ALTER TABLE public.user_check_ins 
ADD COLUMN IF NOT EXISTS sleep_score smallint;

-- Add a check constraint to ensure valid values
ALTER TABLE public.user_check_ins
ADD CONSTRAINT sleep_score_range CHECK (sleep_score IS NULL OR (sleep_score >= 1 AND sleep_score <= 5));