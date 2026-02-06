-- Create resource_suggestions table for user-submitted article links
CREATE TABLE public.resource_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.resource_suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit suggestions
CREATE POLICY "Authenticated users can submit suggestions"
ON public.resource_suggestions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = submitted_by);

-- Users can view their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON public.resource_suggestions
FOR SELECT
TO authenticated
USING (auth.uid() = submitted_by);

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
ON public.resource_suggestions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update suggestions (mark as reviewed)
CREATE POLICY "Admins can update suggestions"
ON public.resource_suggestions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete suggestions
CREATE POLICY "Admins can delete suggestions"
ON public.resource_suggestions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster admin queries
CREATE INDEX idx_resource_suggestions_status ON public.resource_suggestions(status);
CREATE INDEX idx_resource_suggestions_submitted_at ON public.resource_suggestions(submitted_at DESC);