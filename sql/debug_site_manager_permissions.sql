-- Site Manager Permission Debug
-- Bu sorguları Supabase SQL Editor'da çalıştırın

-- 1. Mevcut RLS politikalarını kontrol et
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'purchase_requests'
ORDER BY policyname;

-- 2. Site manager rolüne sahip kullanıcıları listele
SELECT id, email, role, full_name 
FROM profiles 
WHERE role = 'site_manager'
LIMIT 10;

-- 3. Belirli bir purchase request'in detaylarını kontrol et
-- (requestId'yi gerçek ID ile değiştirin)
SELECT 
    id, 
    status, 
    created_at, 
    updated_at, 
    requested_by,
    site_id
FROM purchase_requests 
WHERE id = 'YOUR_REQUEST_ID_HERE';

-- 4. Site manager için UPDATE permission test
-- (Gerçek kullanıcı ID'si ile test edin)
BEGIN;
    SET LOCAL row_security = on;
    SET LOCAL role = 'authenticated';
    -- Test update (rollback edilecek)
    UPDATE purchase_requests 
    SET status = 'satın almaya gönderildi', updated_at = NOW() 
    WHERE id = 'YOUR_REQUEST_ID_HERE';
ROLLBACK;

-- 5. RLS politikası eksikse ekle
-- Site manager'ların purchase_requests'i güncelleyebilmesi için

DO $$ 
BEGIN
    -- Önce mevcut politikayı kontrol et
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND policyname = 'site_managers_can_update_requests'
    ) THEN
        -- Site manager'lar kendi site'lerindeki talepleri güncelleyebilir
        CREATE POLICY site_managers_can_update_requests ON purchase_requests
        FOR UPDATE 
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role = 'site_manager'
                AND (
                    profiles.site_id = purchase_requests.site_id 
                    OR profiles.site_id IS NULL  -- Admin site manager
                )
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role = 'site_manager'
                AND (
                    profiles.site_id = purchase_requests.site_id 
                    OR profiles.site_id IS NULL  -- Admin site manager
                )
            )
        );
        
        RAISE NOTICE 'Site manager UPDATE policy created';
    ELSE
        RAISE NOTICE 'Site manager UPDATE policy already exists';
    END IF;
END $$;
