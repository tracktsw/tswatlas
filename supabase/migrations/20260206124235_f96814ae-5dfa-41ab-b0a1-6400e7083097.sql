-- Add sort_order column to resources table
ALTER TABLE public.resources 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on current created_at order (oldest first = lowest number)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.resources
)
UPDATE public.resources r
SET sort_order = o.rn
FROM ordered o
WHERE r.id = o.id;

-- Create index for efficient ordering
CREATE INDEX idx_resources_sort_order ON public.resources(sort_order);