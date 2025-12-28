-- Add welcome_email_sent_at to user_settings to track if welcome email was sent
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;