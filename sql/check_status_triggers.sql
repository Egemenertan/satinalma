-- Status Trigger'larının Kontrolü
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Mevcut trigger'ları kontrol et
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name,
    tgenabled as is_enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE '%status%' OR tgname LIKE '%shipment%'
ORDER BY table_name, trigger_name;

-- 2. update_purchase_request_status fonksiyonu var mı kontrol et
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'update_purchase_request_status';

-- 3. Shipments tablosundaki trigger'ları kontrol et
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name,
    tgenabled as is_enabled,
    tgtype as trigger_type
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'shipments'::regclass
ORDER BY trigger_name;

-- 4. Purchase_requests tablosundaki trigger'ları kontrol et
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name,
    tgenabled as is_enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'purchase_requests'::regclass
ORDER BY trigger_name;

-- 5. Son 5 shipment kaydını kontrol et
SELECT 
    s.id,
    s.purchase_request_id,
    s.shipped_quantity,
    s.shipped_at,
    pr.status as current_status,
    pr.updated_at as status_updated_at
FROM shipments s
JOIN purchase_requests pr ON s.purchase_request_id = pr.id
ORDER BY s.shipped_at DESC
LIMIT 5;

-- 6. Trigger'ları yeniden oluştur (eğer eksikse)
DO $$
BEGIN
    -- Shipments trigger'ını kontrol et ve oluştur
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'shipments_status_trigger' 
        AND tgrelid = 'shipments'::regclass
    ) THEN
        DROP TRIGGER IF EXISTS shipments_status_trigger ON shipments;
        CREATE TRIGGER shipments_status_trigger
            AFTER INSERT ON shipments
            FOR EACH ROW
            EXECUTE FUNCTION update_purchase_request_status();
        RAISE NOTICE 'Shipments trigger yeniden oluşturuldu';
    ELSE
        RAISE NOTICE 'Shipments trigger zaten mevcut';
    END IF;
END $$;

-- 7. Trigger test et (eğer test verisi varsa)
-- Bu kısım sadece test amaçlı - gerçek veriler üzerinde çalıştırmayın
/*
-- Test için örnek shipment kaydı (dikkatli kullanın!)
INSERT INTO shipments (
    purchase_request_id, 
    purchase_request_item_id, 
    shipped_quantity, 
    shipped_by
) VALUES (
    'your-test-request-id',
    'your-test-item-id', 
    1.0,
    auth.uid()
);
*/

-- 8. Sonuç özeti
SELECT 
    'Trigger Kontrolü Tamamlandı' as message,
    COUNT(*) as total_triggers
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE '%status%' OR proname = 'update_purchase_request_status';
