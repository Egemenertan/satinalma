-- Status Hesaplama Mantığı Düzeltmesi
-- Problem: RPC function'lar quantity field'ını kullanıyor (azalan miktar)
-- Çözüm: original_quantity field'ını kullanmalı (sabit ilk talep miktarı)

-- 1. Düzeltilmiş manuel status update fonksiyonu
CREATE OR REPLACE FUNCTION update_purchase_request_status_manual(request_id UUID)
RETURNS TABLE(
  updated_status TEXT,
  total_requested DECIMAL,
  total_shipped DECIMAL,
  total_remaining DECIMAL,
  success BOOLEAN
) AS $$
DECLARE
    total_req DECIMAL := 0;
    total_ship DECIMAL := 0;
    total_rem DECIMAL := 0;
    new_status TEXT;
BEGIN
    RAISE NOTICE 'Manuel status update başladı: %', request_id;
    
    -- DOĞRU: Toplam talep edilen miktarı hesapla (original_quantity kullan)
    SELECT COALESCE(SUM(original_quantity), 0) INTO total_req
    FROM purchase_request_items 
    WHERE purchase_request_id = request_id;
    
    -- Toplam gönderilen miktarı hesapla  
    SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_ship
    FROM shipments 
    WHERE purchase_request_id = request_id;
    
    -- Kalan miktarı hesapla
    total_rem := total_req - total_ship;
    
    RAISE NOTICE 'Düzeltilmiş totals - Original Requested: %, Shipped: %, Remaining: %', 
                 total_req, total_ship, total_rem;
    
    -- DOĞRU Status belirleme mantığı
    IF total_rem <= 0 AND total_req > 0 THEN
        -- Kalan miktar 0 veya negatif = tamamen gönderildi
        new_status := 'gönderildi';
    ELSIF total_ship > 0 AND total_rem > 0 THEN
        -- Bir miktar gönderildi ama hala kalan var = kısmen gönderildi
        new_status := 'kısmen gönderildi';
    ELSIF total_ship = 0 THEN
        -- Hiç gönderilmedi
        new_status := 'bekliyor';
    ELSE
        -- Fallback
        new_status := 'bekliyor';
    END IF;
    
    RAISE NOTICE 'Düzeltilmiş yeni status: %', new_status;
    
    -- Status'u güncelle
    UPDATE purchase_requests 
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id;
    
    RAISE NOTICE 'Manuel status güncellendi: %', new_status;
    
    -- Sonuçları döndür (kalan miktarı da ekle)
    RETURN QUERY SELECT 
        new_status,
        total_req,
        total_ship,
        total_rem,
        true as success;
        
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Manuel status update hata: %', SQLERRM;
    -- Hata durumunda
    RETURN QUERY SELECT 
        'error'::TEXT,
        0::DECIMAL,
        0::DECIMAL,
        0::DECIMAL,
        false as success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Otomatik trigger'ı da düzelt
CREATE OR REPLACE FUNCTION update_purchase_request_status()
RETURNS TRIGGER AS $$
DECLARE
    total_requested DECIMAL := 0;
    total_shipped DECIMAL := 0;
    total_remaining DECIMAL := 0;
    request_id UUID;
    new_status TEXT;
BEGIN
    RAISE NOTICE 'Trigger çalıştı: % %, Table: %', TG_OP, TG_TABLE_NAME, TG_TABLE_NAME;
    
    -- Sadece shipments insert'i için çalışır
    IF TG_TABLE_NAME = 'shipments' AND TG_OP = 'INSERT' THEN
        request_id := NEW.purchase_request_id;
        
        RAISE NOTICE 'Processing shipment for request_id: %', request_id;
        
        -- DOĞRU: Toplam talep edilen miktarı hesapla (original_quantity)
        SELECT COALESCE(SUM(original_quantity), 0) INTO total_requested
        FROM purchase_request_items 
        WHERE purchase_request_id = request_id;
        
        -- Toplam gönderilen miktarı hesapla (YENİ shipment dahil)
        SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_shipped
        FROM shipments 
        WHERE purchase_request_id = request_id;
        
        -- Kalan miktarı hesapla
        total_remaining := total_requested - total_shipped;
        
        RAISE NOTICE 'Düzeltilmiş Totals - Original Requested: %, Shipped: %, Remaining: %', 
                     total_requested, total_shipped, total_remaining;
        
        -- DOĞRU Status belirleme
        IF total_remaining <= 0 AND total_requested > 0 THEN
            new_status := 'gönderildi';
        ELSIF total_shipped > 0 AND total_remaining > 0 THEN
            new_status := 'kısmen gönderildi';
        ELSE
            new_status := 'bekliyor';
        END IF;
        
        RAISE NOTICE 'Düzeltilmiş yeni status: %', new_status;
        
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

-- 3. Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS shipments_status_trigger ON shipments;
CREATE TRIGGER shipments_status_trigger
    AFTER INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_request_status();

-- 4. Yetkileri ver
GRANT EXECUTE ON FUNCTION update_purchase_request_status_manual(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_purchase_request_status() TO authenticated;

-- 5. Test sorgusu (debug için)
-- Bu sorguyu çalıştırarak herhangi bir request'in doğru hesaplandığını görebilirsiniz:
/*
SELECT 
    pr.id,
    pr.status as current_status,
    -- Original talep miktarları
    SUM(pri.original_quantity) as total_original_requested,
    -- Gönderilen toplam
    COALESCE(SUM(s.shipped_quantity), 0) as total_shipped,
    -- Kalan miktar
    SUM(pri.original_quantity) - COALESCE(SUM(s.shipped_quantity), 0) as remaining_quantity,
    -- Doğru status ne olmalı
    CASE 
        WHEN SUM(pri.original_quantity) - COALESCE(SUM(s.shipped_quantity), 0) <= 0 
             AND SUM(pri.original_quantity) > 0 THEN 'gönderildi'
        WHEN COALESCE(SUM(s.shipped_quantity), 0) > 0 
             AND SUM(pri.original_quantity) - COALESCE(SUM(s.shipped_quantity), 0) > 0 THEN 'kısmen gönderildi'
        ELSE 'bekliyor'
    END as correct_status
FROM purchase_requests pr
LEFT JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id
LEFT JOIN shipments s ON pr.id = s.purchase_request_id
WHERE pr.id = 'YOUR_REQUEST_ID_HERE'
GROUP BY pr.id, pr.status;
*/

SELECT 'Status hesaplama mantığı düzeltildi - original_quantity kullanılıyor' as message;
