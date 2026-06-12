-- Fix RLS for purchase_requests
-- Authorization handled in application code for both INSERT and SELECT
-- This prevents auth.uid() issues in Next.js Server Actions

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON purchase_requests;
DROP POLICY IF EXISTS "Users can create purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Authenticated users can create purchase requests" ON purchase_requests;
DROP POLICY IF EXISTS "Allow authenticated inserts with valid requested_by" ON purchase_requests;
DROP POLICY IF EXISTS "authenticated_insert_requests" ON purchase_requests;

-- Drop all existing SELECT policies (old role-specific ones)
DROP POLICY IF EXISTS "authenticated_read_requests" ON purchase_requests;
DROP POLICY IF EXISTS "Warehouse manager can view requests" ON purchase_requests;
DROP POLICY IF EXISTS "Elevated roles can view all requests" ON purchase_requests;
DROP POLICY IF EXISTS "Purchasing officer can view relevant requests" ON purchase_requests;
DROP POLICY IF EXISTS "Site personnel can view own requests" ON purchase_requests;
DROP POLICY IF EXISTS "Site roles can view site requests" ON purchase_requests;

-- Enable RLS
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Simple INSERT policy: authenticated users can insert
CREATE POLICY "authenticated_insert_requests"
ON purchase_requests FOR INSERT
TO authenticated
WITH CHECK (true);

-- Simple SELECT policy: authenticated users can read
-- Application code (page.tsx) handles role-based filtering
CREATE POLICY "authenticated_read_requests"
ON purchase_requests FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "authenticated_insert_requests" ON purchase_requests IS 
'Authenticated users can insert. Authorization handled in application code via getAuthenticatedUser().';

COMMENT ON POLICY "authenticated_read_requests" ON purchase_requests IS 
'Authenticated users can read all requests. Role-based filtering handled in application code.';
