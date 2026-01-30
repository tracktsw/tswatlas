-- Add custom_triggers column to user_settings table for user-defined triggers
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS custom_triggers text[] NOT NULL DEFAULT '{}'::text[];