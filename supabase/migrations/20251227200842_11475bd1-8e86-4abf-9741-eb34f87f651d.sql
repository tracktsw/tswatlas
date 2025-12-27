-- Add taken_at column to user_photos table
ALTER TABLE public.user_photos 
ADD COLUMN taken_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing photos: set taken_at = created_at for existing records
UPDATE public.user_photos 
SET taken_at = created_at 
WHERE taken_at IS NULL;