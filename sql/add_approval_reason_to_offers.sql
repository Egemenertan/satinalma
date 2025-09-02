-- Add approval_reason column to offers table
-- This column will store the reason why a specific offer was approved

ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS approval_reason TEXT;

-- Add comment to the column for documentation
COMMENT ON COLUMN public.offers.approval_reason IS 'Reason provided by the approver for selecting this offer';

-- Create index for better query performance on approval reasons
CREATE INDEX IF NOT EXISTS idx_offers_approval_reason ON public.offers(approval_reason) WHERE approval_reason IS NOT NULL;

-- Update the existing schema comments
COMMENT ON TABLE public.offers IS 'Store all offers submitted for purchase requests, including approval reasons';
