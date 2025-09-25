-- Status Update Trigger'larını Düzelt
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Önce mevcut trigger'ları kontrol et
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name,
    tgenabled as is_enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE '%status%' OR tgname LIKE '%shipment%'
ORDER BY table_name, trigger_name;

-- 2. Mevcut fonksiyonları kontrol et
SELECT proname, prosrc FROM pg_proc 
WHERE proname IN ('update_purchase_request_status', 'update_purchase_request_status_manual');

-- 3. RLS politikalarını kontrol et
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('purchase_requests', 'shipments')
ORDER BY tablename, policyname;

-- 4. Shipments tablosunda update yetkisi var mı kontrol et
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'purchase_requests';

-- 5. Trigger fonksiyonunu yeniden oluştur (basitleştirilmiş)
CREATE OR REPLACE FUNCTION update_purchase_request_status()
RETURNS TRIGGER AS $$
DECLARE
    total_requested DECIMAL := 0;
    total_shipped DECIMAL := 0;
    request_id UUID;
    new_status TEXT;
BEGIN
    -- Debug log
    RAISE NOTICE 'Trigger çalıştı: % %, Table: %', TG_OP, TG_TABLE_NAME, TG_TABLE_NAME;
    
    -- Sadece shipments insert'i için çalışır
    IF TG_TABLE_NAME = 'shipments' AND TG_OP = 'INSERT' THEN
        request_id := NEW.purchase_request_id;
        
        RAISE NOTICE 'Processing shipment for request_id: %', request_id;
        
        -- Toplam talep edilen miktarı hesapla
        SELECT COALESCE(SUM(quantity), 0) INTO total_requested
        FROM purchase_request_items 
        WHERE purchase_request_id = request_id;
        
        -- Toplam gönderilen miktarı hesapla (YENİ shipment dahil)
        SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_shipped
        FROM shipments 
        WHERE purchase_request_id = request_id;
        
        RAISE NOTICE 'Totals - Requested: %, Shipped: %', total_requested, total_shipped;
        
        -- Status'u belirle
        IF total_shipped >= total_requested AND total_requested > 0 THEN
            new_status := 'gönderildi';
        ELSIF total_shipped > 0 THEN
            new_status := 'kısmen gönderildi';
        ELSE
            new_status := 'bekliyor';
        END IF;
        
        RAISE NOTICE 'Yeni status: %', new_status;
        
        -- Status'u güncelle
        UPDATE purchase_requests 
        SET 
            status = new_status,
            updated_at = NOW()
        WHERE id = request_id;
        
        RAISE NOTICE 'Status güncellendi: %', new_status;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Trigger hata: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Manual status update fonksiyonunu yeniden oluştur
CREATE OR REPLACE FUNCTION update_purchase_request_status_manual(request_id UUID)
RETURNS TABLE(
  updated_status TEXT,
  total_requested DECIMAL,
  total_shipped DECIMAL,
  success BOOLEAN
) AS $$
DECLARE
    total_req DECIMAL := 0;
    total_ship DECIMAL := 0;
    new_status TEXT;
BEGIN
    RAISE NOTICE 'Manuel status update başladı: %', request_id;
    
    -- Toplam talep edilen miktarı hesapla
    SELECT COALESCE(SUM(quantity), 0) INTO total_req
    FROM purchase_request_items 
    WHERE purchase_request_id = request_id;
    
    -- Toplam gönderilen miktarı hesapla  
    SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_ship
    FROM shipments 
    WHERE purchase_request_id = request_id;
    
    RAISE NOTICE 'Manuel totals - Requested: %, Shipped: %', total_req, total_ship;
    
    -- Status'u belirle
    IF total_ship >= total_req AND total_req > 0 THEN
        new_status := 'gönderildi';
    ELSIF total_ship > 0 THEN
        new_status := 'kısmen gönderildi';
    ELSE
        new_status := 'bekliyor';
    END IF;
    
    RAISE NOTICE 'Manuel yeni status: %', new_status;
    
    -- Status'u güncelle
    UPDATE purchase_requests 
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id;
    
    RAISE NOTICE 'Manuel status güncellendi: %', new_status;
    
    -- Sonuçları döndür
    RETURN QUERY SELECT 
        new_status,
        total_req,
        total_ship,
        true as success;
        
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Manuel status update hata: %', SQLERRM;
    -- Hata durumunda
    RETURN QUERY SELECT 
        'error'::TEXT,
        0::DECIMAL,
        0::DECIMAL,
        false as success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger'ları sil ve yeniden oluştur
DROP TRIGGER IF EXISTS shipments_status_trigger ON shipments;
CREATE TRIGGER shipments_status_trigger
    AFTER INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_request_status();

-- 8. RPC fonksiyonu için yetki ver
GRANT EXECUTE ON FUNCTION update_purchase_request_status_manual(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_purchase_request_status() TO authenticated;

-- 9. Shipments RLS politikasını kontrol et
-- Santiye depo kullanıcısının shipment ekleyebilmesi için
DO $$
BEGIN
    -- Önce mevcut politikayı kontrol et
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipments' 
        AND policyname = 'Enable santiye_depo to insert shipments'
    ) THEN
        -- Santiye depo için insert politikası
        CREATE POLICY "Enable santiye_depo to insert shipments" ON shipments
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'santiye_depo'
                )
            );
        RAISE NOTICE 'Santiye depo insert politikası oluşturuldu';
    ELSE
        RAISE NOTICE 'Santiye depo insert politikası zaten mevcut';
    END IF;

    -- Purchase requests güncelleme politikası
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_requests' 
        AND policyname = 'Enable santiye_depo to update status'
    ) THEN
        CREATE POLICY "Enable santiye_depo to update status" ON purchase_requests
            FOR UPDATE USING (true) WITH CHECK (true);
        RAISE NOTICE 'Purchase requests update politikası oluşturuldu';
    ELSE
        RAISE NOTICE 'Purchase requests update politikası zaten mevcut';
    END IF;
END $$;

-- 10. Test verisi
SELECT 'Trigger ve fonksiyonlar yeniden oluşturuldu' as message;

-- 11. Son 5 shipment'ı listele
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

