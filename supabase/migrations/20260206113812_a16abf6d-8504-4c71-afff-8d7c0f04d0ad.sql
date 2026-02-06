-- Create resources table for external educational content
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  custom_title TEXT,
  custom_summary TEXT,
  ai_summary TEXT,
  summary_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Public can view all resources
CREATE POLICY "Anyone can view resources"
ON public.resources
FOR SELECT
USING (true);

-- Only admins can insert resources
CREATE POLICY "Admins can insert resources"
ON public.resources
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can update resources
CREATE POLICY "Admins can update resources"
ON public.resources
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete resources
CREATE POLICY "Admins can delete resources"
ON public.resources
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();