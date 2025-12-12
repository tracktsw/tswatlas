-- Create treatments table (curated list of TSW treatments)
CREATE TABLE public.treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  suggested_by TEXT, -- anonymous identifier
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create treatment votes table (anonymous voting)
CREATE TABLE public.treatment_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL, -- anonymous device/session identifier
  helps BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(treatment_id, voter_id)
);

-- Create treatment suggestions table (for review)
CREATE TABLE public.treatment_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  suggested_by TEXT, -- anonymous identifier
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_suggestions ENABLE ROW LEVEL SECURITY;

-- Treatments are readable by everyone (approved ones only for public)
CREATE POLICY "Anyone can view approved treatments" 
ON public.treatments 
FOR SELECT 
USING (is_approved = true);

-- Anyone can vote (anonymous)
CREATE POLICY "Anyone can vote on treatments" 
ON public.treatment_votes 
FOR INSERT 
WITH CHECK (true);

-- Users can see their own votes
CREATE POLICY "Users can view their own votes" 
ON public.treatment_votes 
FOR SELECT 
USING (true);

-- Users can update their own votes
CREATE POLICY "Users can update their own votes" 
ON public.treatment_votes 
FOR UPDATE 
USING (true);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes" 
ON public.treatment_votes 
FOR DELETE 
USING (true);

-- Anyone can suggest treatments
CREATE POLICY "Anyone can suggest treatments" 
ON public.treatment_suggestions 
FOR INSERT 
WITH CHECK (true);

-- Anyone can view pending suggestions count (for transparency)
CREATE POLICY "Anyone can view suggestions" 
ON public.treatment_suggestions 
FOR SELECT 
USING (true);

-- Insert initial curated treatments
INSERT INTO public.treatments (name, description, category, is_approved) VALUES
('NMT (No Moisture Treatment)', 'Avoiding all moisturizers to allow skin to self-regulate', 'moisture', true),
('Moisturizer Withdrawal', 'Gradually reducing moisturizer use', 'moisture', true),
('Red Light Therapy (RLT)', 'Using red light devices to promote skin healing', 'therapy', true),
('Dead Sea Salt Baths', 'Bathing in water with Dead Sea salt', 'bathing', true),
('Cold Compress', 'Applying cold to reduce inflammation and itching', 'relief', true),
('Antihistamines', 'Taking antihistamines to reduce itching', 'medication', true),
('Diet Changes', 'Modifying diet to reduce inflammation', 'lifestyle', true),
('Exercise', 'Regular physical activity to support healing', 'lifestyle', true),
('Sleep Optimization', 'Improving sleep quality and duration', 'lifestyle', true),
('Stress Management', 'Meditation, breathing exercises, therapy', 'lifestyle', true),
('Ice Packs', 'Direct ice application for severe itch', 'relief', true),
('Oatmeal Baths', 'Colloidal oatmeal soaks for soothing', 'bathing', true),
('Cotton Gloves', 'Wearing cotton gloves to prevent scratching at night', 'protection', true),
('Wet Wrapping', 'Applying damp bandages over affected areas', 'therapy', true),
('Zinc Supplements', 'Taking zinc for skin repair', 'supplements', true);

-- Enable realtime for votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_votes;