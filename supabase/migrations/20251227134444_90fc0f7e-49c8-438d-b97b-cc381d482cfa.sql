-- Add explicit URL columns for the three image sizes
-- These will store the actual storage paths (not signed URLs)
ALTER TABLE public.user_photos
ADD COLUMN IF NOT EXISTS thumb_url text,
ADD COLUMN IF NOT EXISTS medium_url text,
ADD COLUMN IF NOT EXISTS original_url text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_photos_user_created 
ON public.user_photos(user_id, created_at DESC);