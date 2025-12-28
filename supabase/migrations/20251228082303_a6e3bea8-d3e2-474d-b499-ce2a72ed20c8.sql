-- Add uploaded_at separate from created_at (created_at remains for legacy/ordering)
ALTER TABLE public.user_photos
ADD COLUMN IF NOT EXISTS uploaded_at timestamp with time zone NOT NULL DEFAULT now();

-- Backfill uploaded_at for existing rows
UPDATE public.user_photos
SET uploaded_at = created_at
WHERE uploaded_at IS NULL;

-- Store taken_at as local device time (no timezone) to prevent ±1 day shifts
-- Existing taken_at values were stored as timestamptz; convert to timezone-less timestamp.
ALTER TABLE public.user_photos
ALTER COLUMN taken_at TYPE timestamp without time zone
USING (CASE WHEN taken_at IS NULL THEN NULL ELSE (taken_at AT TIME ZONE 'UTC') END);

-- Helpful index for per-user ordering (matches common queries)
CREATE INDEX IF NOT EXISTS idx_user_photos_user_uploaded_at_desc
ON public.user_photos (user_id, uploaded_at DESC);
