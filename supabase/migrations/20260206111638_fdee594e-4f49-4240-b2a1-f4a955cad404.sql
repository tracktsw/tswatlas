-- Add optional banner_text column to treatments table
ALTER TABLE public.treatments 
ADD COLUMN banner_text text DEFAULT NULL;