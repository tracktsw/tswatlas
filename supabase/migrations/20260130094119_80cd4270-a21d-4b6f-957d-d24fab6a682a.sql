-- Add logged_at column to track when check-in was actually submitted
-- This is separate from created_at which represents the date being logged for
ALTER TABLE public.user_check_ins 
ADD COLUMN IF NOT EXISTS logged_at timestamp with time zone NOT NULL DEFAULT now();

-- For existing rows, set logged_at = created_at (best we can do for historical data)
UPDATE public.user_check_ins 
SET logged_at = created_at 
WHERE logged_at = now();