-- Fix purchase_request_items quantity column to support decimal values
-- Change from INTEGER to DECIMAL(15,3) to allow decimal quantities like 22.98

ALTER TABLE public.purchase_request_items 
ALTER COLUMN quantity TYPE DECIMAL(15,3);

-- Also update unit_price and total_price if they need decimal support
ALTER TABLE public.purchase_request_items 
ALTER COLUMN unit_price TYPE DECIMAL(15,2);

ALTER TABLE public.purchase_request_items 
ALTER COLUMN total_price TYPE DECIMAL(15,2);

-- Add comment for clarity
COMMENT ON COLUMN public.purchase_request_items.quantity IS 'Quantity with decimal support (e.g., 22.98 kg)';
