-- Add client_request_id for idempotent check-in submissions
ALTER TABLE public.user_check_ins 
ADD COLUMN client_request_id UUID;

-- Create unique constraint to prevent duplicate submissions from same request
CREATE UNIQUE INDEX idx_user_check_ins_client_request 
ON public.user_check_ins (user_id, client_request_id) 
WHERE client_request_id IS NOT NULL;

-- Add index to efficiently query check-ins by date for daily limit checks
CREATE INDEX idx_user_check_ins_user_date 
ON public.user_check_ins (user_id, created_at);