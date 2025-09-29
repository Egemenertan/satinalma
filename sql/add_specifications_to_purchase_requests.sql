-- Add specifications column to purchase_requests table
-- This column will store general specifications/notes for the entire purchase request

-- Add specifications column if it doesn't exist
ALTER TABLE public.purchase_requests 
ADD COLUMN IF NOT EXISTS specifications TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.purchase_requests.specifications IS 'General specifications and notes for the entire purchase request';

-- Update description
COMMENT ON TABLE public.purchase_requests IS 'Purchase requests with general specifications support';
