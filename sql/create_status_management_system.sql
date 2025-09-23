-- Status Management System için SQL
-- Tüm status güncellemelerini otomatik hale getirir

-- 1. Status güncellemeleri için trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_purchase_request_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Sipariş verildiğinde status güncelle
    IF TG_TABLE_NAME = 'orders' AND TG_OP = 'INSERT' THEN
        UPDATE purchase_requests 
        SET 
            status = 'sipariş verildi',
            updated_at = NOW()
        WHERE id = NEW.purchase_request_id;
        RETURN NEW;
    END IF;

    -- Sipariş teslim alındığında status güncelle
    IF TG_TABLE_NAME = 'orders' AND TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE purchase_requests 
        SET 
            status = 'teslim alındı',
            updated_at = NOW()
        WHERE id = NEW.purchase_request_id;
        RETURN NEW;
    END IF;

    -- Shipment (gönderim) yapıldığında status güncelle
    IF TG_TABLE_NAME = 'shipments' AND TG_OP = 'INSERT' THEN
        -- Bu gönderimle beraber tüm malzemeler karşılandı mı kontrol et
        DECLARE
            total_requested DECIMAL;
            total_shipped DECIMAL;
            request_id UUID;
        BEGIN
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
            IF total_shipped >= total_requested THEN
                -- Tüm malzemeler gönderildi
                UPDATE purchase_requests 
                SET 
                    status = 'gönderildi',
                    updated_at = NOW()
                WHERE id = request_id;
            ELSE
                -- Kısmen gönderildi
                UPDATE purchase_requests 
                SET 
                    status = 'kısmen gönderildi',
                    updated_at = NOW()
                WHERE id = request_id;
            END IF;
        END;
        RETURN NEW;
    END IF;

    -- Teklif onaylandığında status güncelle
    IF TG_TABLE_NAME = 'offers' AND TG_OP = 'UPDATE' AND NEW.is_selected = true AND OLD.is_selected != true THEN
        UPDATE purchase_requests 
        SET 
            status = 'onaylandı',
            updated_at = NOW()
        WHERE id = NEW.purchase_request_id;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger'ları oluştur
DROP TRIGGER IF EXISTS orders_status_trigger ON orders;
CREATE TRIGGER orders_status_trigger
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_request_status();

DROP TRIGGER IF EXISTS shipments_status_trigger ON shipments;
CREATE TRIGGER shipments_status_trigger
    AFTER INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_request_status();

DROP TRIGGER IF EXISTS offers_status_trigger ON offers;
CREATE TRIGGER offers_status_trigger
    AFTER UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_request_status();

-- 3. Mevcut status değerlerini standardize et
UPDATE purchase_requests 
SET status = CASE 
    WHEN status = 'şantiye şefi onayladı' THEN 'onay bekliyor'
    WHEN status = 'awaiting_offers' THEN 'teklif bekliyor'
    WHEN status = 'approved' THEN 'onaylandı'
    WHEN status = 'eksik malzemeler talep edildi' THEN 'satın almaya gönderildi'
    ELSE status
END;

-- 4. Purchase requests için updated_at trigger'ı ekle
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS purchase_requests_updated_at ON purchase_requests;
CREATE TRIGGER purchase_requests_updated_at
    BEFORE UPDATE ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- 5. Status enum'unu güncelle (eğer kullanılıyorsa)
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'teklif bekliyor';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'onay bekliyor';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'onaylandı';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'sipariş verildi';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'gönderildi';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'kısmen gönderildi';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'depoda mevcut değil';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'satın almaya gönderildi';
-- ALTER TYPE purchase_request_status ADD VALUE IF NOT EXISTS 'teslim alındı';

COMMENT ON FUNCTION update_purchase_request_status() IS 'Otomatik status güncellemeleri için trigger fonksiyonu';
