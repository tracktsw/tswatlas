
-- Create practitioners table
CREATE TABLE public.practitioners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  practitioner_type text,
  city text NOT NULL,
  country text NOT NULL,
  website text,
  contact_email text,
  contact_phone text,
  services text[] NOT NULL DEFAULT '{}',
  remote_available boolean NOT NULL DEFAULT false,
  about text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.practitioners ENABLE ROW LEVEL SECURITY;

-- Anyone can view active practitioners
CREATE POLICY "Anyone can view active practitioners"
ON public.practitioners
FOR SELECT
USING (is_active = true);

-- Admins can view all practitioners (including inactive)
CREATE POLICY "Admins can view all practitioners"
ON public.practitioners
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert practitioners
CREATE POLICY "Admins can insert practitioners"
ON public.practitioners
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update practitioners
CREATE POLICY "Admins can update practitioners"
ON public.practitioners
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete practitioners
CREATE POLICY "Admins can delete practitioners"
ON public.practitioners
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Reuse existing trigger for updated_at
CREATE TRIGGER update_practitioners_updated_at
BEFORE UPDATE ON public.practitioners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
