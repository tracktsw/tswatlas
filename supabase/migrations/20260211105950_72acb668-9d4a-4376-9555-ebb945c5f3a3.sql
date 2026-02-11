
-- Add avatar_url column to practitioners
ALTER TABLE public.practitioners ADD COLUMN avatar_url text DEFAULT NULL;

-- Create storage bucket for practitioner avatars (public so images can be displayed)
INSERT INTO storage.buckets (id, name, public) VALUES ('practitioner-avatars', 'practitioner-avatars', true);

-- Anyone can view avatars
CREATE POLICY "Anyone can view practitioner avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'practitioner-avatars');

-- Only admins can upload avatars
CREATE POLICY "Admins can upload practitioner avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'practitioner-avatars' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update avatars
CREATE POLICY "Admins can update practitioner avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'practitioner-avatars' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can delete avatars
CREATE POLICY "Admins can delete practitioner avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'practitioner-avatars' AND public.has_role(auth.uid(), 'admin'));
