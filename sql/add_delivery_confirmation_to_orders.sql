-- Add delivery confirmation fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_receipt_photos text[] DEFAULT array[]::text[],
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS delivery_notes text;

-- Update orders status to include 'delivered'
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'delivered'));

-- Add comment to explain the new fields
COMMENT ON COLUMN orders.delivery_receipt_photos IS 'Array of photo URLs for delivery receipt documentation';
COMMENT ON COLUMN orders.delivered_at IS 'Timestamp when the order was marked as delivered';
COMMENT ON COLUMN orders.received_by IS 'User ID who confirmed the delivery receipt';
COMMENT ON COLUMN orders.delivery_notes IS 'Notes added during delivery confirmation';
