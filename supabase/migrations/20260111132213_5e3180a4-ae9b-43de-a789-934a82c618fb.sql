-- Create onboarding_responses table for storing user survey answers
-- Data is ONLY persisted after successful account creation
CREATE TABLE public.onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_version TEXT NOT NULL DEFAULT '1.0',
  tsw_duration TEXT,
  goal TEXT,
  initial_severity INTEGER,
  first_log JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one response per user per version (idempotent)
  CONSTRAINT unique_user_onboarding_version UNIQUE (user_id, onboarding_version)
);

-- Enable Row Level Security
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Users can only view their own onboarding responses
CREATE POLICY "Users can view their own onboarding responses"
ON public.onboarding_responses
FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own onboarding responses
CREATE POLICY "Users can insert their own onboarding responses"
ON public.onboarding_responses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own onboarding responses (for retries/corrections)
CREATE POLICY "Users can update their own onboarding responses"
ON public.onboarding_responses
FOR UPDATE
USING (auth.uid() = user_id);

-- Add index for faster lookups by user_id
CREATE INDEX idx_onboarding_responses_user_id ON public.onboarding_responses(user_id);