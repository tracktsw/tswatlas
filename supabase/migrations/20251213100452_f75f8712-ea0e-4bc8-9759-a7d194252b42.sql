-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles - users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Add UPDATE policy for treatment_suggestions (admins only)
CREATE POLICY "Admins can update suggestions"
ON public.treatment_suggestions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add DELETE policy for treatment_suggestions (admins only)
CREATE POLICY "Admins can delete suggestions"
ON public.treatment_suggestions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add INSERT policy for treatments table (admins only)
CREATE POLICY "Admins can insert treatments"
ON public.treatments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add UPDATE policy for treatments table (admins only)
CREATE POLICY "Admins can update treatments"
ON public.treatments
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));