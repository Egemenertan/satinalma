-- Purchase Requests Status Constraint Fix
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Önce mevcut constraint'i kontrol et
SELECT 
    conname as constraint_name,
    consrc as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'purchase_requests' AND contype = 'c'
ORDER BY conname;

-- 2. Mevcut status constraint'ini kaldır
DO $$
BEGIN
    -- purchase_requests_status_check constraint'ini kaldır (varsa)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_requests_status_check'
    ) THEN
        ALTER TABLE purchase_requests DROP CONSTRAINT purchase_requests_status_check;
        RAISE NOTICE 'Mevcut status constraint kaldırıldı';
    END IF;
    
    -- Diğer olası constraint isimlerini de kontrol et
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_requests_status_check1'
    ) THEN
        ALTER TABLE purchase_requests DROP CONSTRAINT purchase_requests_status_check1;
        RAISE NOTICE 'Alternative status constraint kaldırıldı';
    END IF;
END $$;

-- 3. Yeni kapsamlı constraint ekle
ALTER TABLE purchase_requests ADD CONSTRAINT purchase_requests_status_check 
CHECK (status IN (
    -- Temel durumlar
    'draft',
    'pending', 
    'submitted',
    
    -- Onay süreçleri
    'şantiye şefi onayladı',
    'onay bekliyor',
    'awaiting_offers',
    'teklif bekliyor',
    'approved',
    'onaylandı',
    
    -- Satın alma süreçleri
    'satın almaya gönderildi',
    'eksik malzemeler talep edildi',
    'sipariş verildi',
    'ordered',
    
    -- Teslimat süreçleri
    'gönderildi',
    'delivered',
    'kısmen gönderildi',
    'partially_delivered',
    'depoda mevcut değil',
    'teslim alındı',
    
    -- Alternatif onaylar
    'eksik onaylandı',
    'alternatif onaylandı',
    
    -- Son durumlar
    'rejected',
    'cancelled'
));

-- 4. Test: Status değerlerini kontrol et
SELECT DISTINCT status, COUNT(*) as count
FROM purchase_requests 
GROUP BY status 
ORDER BY status;

-- 5. Test: Yeni constraint'i test et (geçerli bir status ile)
-- UPDATE purchase_requests 
-- SET status = 'satın almaya gönderildi' 
-- WHERE id = 'test-id-here' AND status IN ('kısmen gönderildi', 'depoda mevcut değil')
-- RETURNING id, status;

-- 6. Constraint kontrolü
SELECT 
    conname as constraint_name,
    consrc as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'purchase_requests' AND contype = 'c' AND conname LIKE '%status%'
ORDER BY conname;

COMMENT ON CONSTRAINT purchase_requests_status_check ON purchase_requests IS 
'Geçerli status değerleri: draft, pending, submitted, şantiye şefi onayladı, onay bekliyor, awaiting_offers, teklif bekliyor, approved, onaylandı, satın almaya gönderildi, eksik malzemeler talep edildi, sipariş verildi, ordered, gönderildi, delivered, kısmen gönderildi, partially_delivered, depoda mevcut değil, teslim alındı, eksik onaylandı, alternatif onaylandı, rejected, cancelled';
