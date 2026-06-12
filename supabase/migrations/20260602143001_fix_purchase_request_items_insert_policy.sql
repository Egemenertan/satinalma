-- Fix RLS for purchase_request_items
-- Authorization handled in application code for both INSERT and SELECT

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON purchase_request_items;
DROP POLICY IF EXISTS "Users can create purchase request items" ON purchase_request_items;
DROP POLICY IF EXISTS "Users can create items for their purchase requests" ON purchase_request_items;
DROP POLICY IF EXISTS "Allow authenticated inserts for request items" ON purchase_request_items;
DROP POLICY IF EXISTS "authenticated_insert_items" ON purchase_request_items;

-- Drop all existing SELECT policies (old role-specific ones)
DROP POLICY IF EXISTS "authenticated_read_items" ON purchase_request_items;
DROP POLICY IF EXISTS "Users can read items from accessible requests" ON purchase_request_items;

-- Enable RLS
ALTER TABLE purchase_request_items ENABLE ROW LEVEL SECURITY;

-- Simple INSERT policy: authenticated users can insert items
CREATE POLICY "authenticated_insert_items"
ON purchase_request_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- Simple SELECT policy: authenticated users can read
CREATE POLICY "authenticated_read_items"
ON purchase_request_items FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "authenticated_insert_items" ON purchase_request_items IS 
'Authenticated users can insert items. Parent request authorization handled in application code.';

COMMENT ON POLICY "authenticated_read_items" ON purchase_request_items IS 
'Authenticated users can read all items. Filtering handled in application code.';
