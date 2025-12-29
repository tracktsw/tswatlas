-- Change symptoms_experienced column from text[] to jsonb to store symptom objects with severity
-- Each element will be: { "symptom": "Burning", "severity": 2 }

-- Step 1: Add new jsonb column
ALTER TABLE public.user_check_ins 
ADD COLUMN symptoms_data jsonb DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing data from text[] to jsonb array with default severity of 2 (Moderate)
UPDATE public.user_check_ins 
SET symptoms_data = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('symptom', elem, 'severity', 2)
    ),
    '[]'::jsonb
  )
  FROM unnest(symptoms_experienced) AS elem
)
WHERE symptoms_experienced IS NOT NULL AND array_length(symptoms_experienced, 1) > 0;

-- Step 3: Drop the old column
ALTER TABLE public.user_check_ins 
DROP COLUMN symptoms_experienced;

-- Step 4: Rename new column to original name
ALTER TABLE public.user_check_ins 
RENAME COLUMN symptoms_data TO symptoms_experienced;