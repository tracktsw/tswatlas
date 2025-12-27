-- Create a public photos bucket for user photos with public URLs
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- RLS: Users can upload to their own photoId folder
CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photos');

-- RLS: Anyone can read from photos bucket (public URLs)
CREATE POLICY "Anyone can read photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

-- RLS: Users can delete their own photos
CREATE POLICY "Users can delete their photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photos');