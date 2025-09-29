-- Add missing columns to purchase_request_items table
-- These columns are needed for the edit functionality

-- Add material classification columns
ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS material_class VARCHAR(255);

ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS material_group VARCHAR(255);

ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS material_item_name VARCHAR(255);

-- Add brand column
ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS brand VARCHAR(255);

-- Add purpose column (usage purpose for each material)
ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS purpose TEXT;

-- Add delivery_date column (when each material is needed)
ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Add image_urls column (JSON array of image URLs for each material)
ALTER TABLE public.purchase_request_items 
ADD COLUMN IF NOT EXISTS image_urls JSONB;

-- Add comments for clarity
COMMENT ON COLUMN public.purchase_request_items.material_class IS 'Material classification (e.g., Elektrik, Mekanik)';
COMMENT ON COLUMN public.purchase_request_items.material_group IS 'Material group within class';
COMMENT ON COLUMN public.purchase_request_items.material_item_name IS 'Specific material item name from catalog';
COMMENT ON COLUMN public.purchase_request_items.brand IS 'Preferred or specified brand';
COMMENT ON COLUMN public.purchase_request_items.purpose IS 'Usage purpose for this specific material';
COMMENT ON COLUMN public.purchase_request_items.delivery_date IS 'When this specific material is needed';
COMMENT ON COLUMN public.purchase_request_items.image_urls IS 'Array of image URLs for this material';

-- Update table description
COMMENT ON TABLE public.purchase_request_items IS 'Individual items in purchase requests with detailed material information';
