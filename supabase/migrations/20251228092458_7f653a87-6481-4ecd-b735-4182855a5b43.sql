-- Cleanup duplicate check-ins: keep only the first 2 per user per day
-- This fixes historical duplicates created before the idempotency fix

WITH ranked_checkins AS (
  SELECT 
    id,
    user_id,
    DATE(created_at AT TIME ZONE 'UTC') as checkin_date,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, DATE(created_at AT TIME ZONE 'UTC') 
      ORDER BY created_at ASC
    ) as row_num
  FROM public.user_check_ins
),
duplicates_to_delete AS (
  SELECT id 
  FROM ranked_checkins 
  WHERE row_num > 2
)
DELETE FROM public.user_check_ins 
WHERE id IN (SELECT id FROM duplicates_to_delete);