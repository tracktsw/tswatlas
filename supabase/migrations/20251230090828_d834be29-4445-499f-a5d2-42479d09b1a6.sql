-- Add triggers column to user_check_ins table
ALTER TABLE public.user_check_ins
ADD COLUMN triggers text[] NOT NULL DEFAULT '{}'::text[];