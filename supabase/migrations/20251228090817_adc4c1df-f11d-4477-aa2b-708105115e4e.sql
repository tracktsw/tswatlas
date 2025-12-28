-- Add reminder state columns to user_settings for PWA-friendly reminders
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS last_reminded_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS snoozed_until timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT NULL;