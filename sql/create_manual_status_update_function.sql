-- Manuel Status Güncelleme Fonksiyonu
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Manuel trigger fonksiyonu oluştur
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
    -- Toplam talep edilen miktarı hesapla
    SELECT COALESCE(SUM(quantity), 0) INTO total_req
    FROM purchase_request_items 
    WHERE purchase_request_id = request_id;
    
    -- Toplam gönderilen miktarı hesapla  
    SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_ship
    FROM shipments 
    WHERE purchase_request_id = request_id;
    
    -- Status'u belirle
    IF total_ship >= total_req AND total_req > 0 THEN
        -- Tüm malzemeler gönderildi
        new_status := 'gönderildi';
    ELSIF total_ship > 0 THEN
        -- Kısmen gönderildi
        new_status := 'kısmen gönderildi';
    ELSE
        -- Hiç gönderilmedi
        new_status := 'depoda mevcut değil';
    END IF;
    
    -- Status'u güncelle
    UPDATE purchase_requests 
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id;
    
    -- Sonuçları döndür
    RETURN QUERY SELECT 
        new_status,
        total_req,
        total_ship,
        true as success;
        
EXCEPTION WHEN OTHERS THEN
    -- Hata durumunda
    RETURN QUERY SELECT 
        'error'::TEXT,
        0::DECIMAL,
        0::DECIMAL,
        false as success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC fonksiyonu için yetki ver
GRANT EXECUTE ON FUNCTION update_purchase_request_status_manual(UUID) TO authenticated;

-- 3. Test et (isteğe bağlı)
-- SELECT * FROM update_purchase_request_status_manual('your-request-id-here'::UUID);

-- 4. Otomatik trigger'ı da yeniden oluştur (güvence için)
CREATE OR REPLACE FUNCTION update_purchase_request_status()
RETURNS TRIGGER AS $$
DECLARE
    total_requested DECIMAL;
    total_shipped DECIMAL;
    request_id UUID;
BEGIN
    -- Sadece shipments insert'i için çalışır
    IF TG_TABLE_NAME = 'shipments' AND TG_OP = 'INSERT' THEN
        request_id := NEW.purchase_request_id;
        
        -- Toplam talep edilen miktarı hesapla
        SELECT COALESCE(SUM(quantity), 0) INTO total_requested
        FROM purchase_request_items 
        WHERE purchase_request_id = request_id;
        
        -- Toplam gönderilen miktarı hesapla
        SELECT COALESCE(SUM(shipped_quantity), 0) INTO total_shipped
        FROM shipments 
        WHERE purchase_request_id = request_id;
        
        -- Status'u güncelle
        IF total_shipped >= total_requested AND total_requested > 0 THEN
            -- Tüm malzemeler gönderildi
            UPDATE purchase_requests 
            SET 
                status = 'gönderildi',
                updated_at = NOW()
            WHERE id = request_id;
        ELSIF total_shipped > 0 THEN
            -- Kısmen gönderildi
            UPDATE purchase_requests 
            SET 
                status = 'kısmen gönderildi',
                updated_at = NOW()
            WHERE id = request_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS shipments_status_trigger ON shipments;
CREATE TRIGGER shipments_status_trigger
    AFTER INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_request_status();

-- 6. Başarı mesajı
SELECT 'Manual status update function created successfully' as message;
