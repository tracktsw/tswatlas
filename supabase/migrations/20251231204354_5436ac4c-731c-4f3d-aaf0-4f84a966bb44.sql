-- Add pain_score column to user_check_ins table
-- This is an optional field (0-10 scale) for tracking pain levels
-- It is intentionally separate from flare detection and symptom scoring

ALTER TABLE public.user_check_ins
ADD COLUMN pain_score smallint DEFAULT NULL;

-- Add constraint to ensure valid range (0-10) when provided
ALTER TABLE public.user_check_ins
ADD CONSTRAINT pain_score_range CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10));

-- Add index for potential future analytics queries
CREATE INDEX idx_user_check_ins_pain_score ON public.user_check_ins (pain_score) WHERE pain_score IS NOT NULL;