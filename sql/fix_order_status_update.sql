-- Order Status Güncelleme Düzeltmesi
-- Bir order'a ait tüm delivery kayıtları completed olduğunda order'ın status ve is_delivered değerlerini günceller

-- 1. Geliştirilmiş get_order_delivery_status fonksiyonu
CREATE OR REPLACE FUNCTION get_order_delivery_status(order_id_param UUID)
RETURNS TEXT AS $$
DECLARE
    order_quantity DECIMAL(15,3) := 0;
    total_delivered DECIMAL(15,3) := 0;
    remaining DECIMAL(15,3) := 0;
BEGIN
    -- Siparişin toplam miktarını al
    SELECT COALESCE(quantity, 0)
    INTO order_quantity
    FROM orders
    WHERE id = order_id_param;
    
    -- Toplam teslim alınan miktarı al
    SELECT get_order_total_delivered(order_id_param)
    INTO total_delivered;
    
    -- Kalan miktarı hesapla
    remaining := order_quantity - total_delivered;
    
    -- Durumu belirle - daha hassas kontrol
    IF order_quantity = 0 THEN
        RETURN 'pending'; -- Sipariş miktarı 0 ise pending
    ELSIF total_delivered = 0 THEN
        RETURN 'pending'; -- Henüz teslim alınmamış
    ELSIF remaining <= 0 THEN
        RETURN 'completed'; -- Tamamen teslim alınmış (kalan <= 0)
    ELSE
        RETURN 'partial'; -- Kısmen teslim alınmış
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Order status güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_order_status_from_deliveries(order_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    new_status TEXT;
    order_quantity DECIMAL(15,3) := 0;
    total_delivered DECIMAL(15,3) := 0;
BEGIN
    -- Siparişin mevcut durumunu kontrol et
    IF NOT EXISTS (SELECT 1 FROM orders WHERE id = order_id_param) THEN
        RETURN FALSE;
    END IF;
    
    -- Siparişin toplam miktarını al
    SELECT COALESCE(quantity, 0)
    INTO order_quantity
    FROM orders
    WHERE id = order_id_param;
    
    -- Toplam teslim alınan miktarı al
    SELECT get_order_total_delivered(order_id_param)
    INTO total_delivered;
    
    -- Yeni status'u hesapla
    new_status := get_order_delivery_status(order_id_param);
    
    -- Orders tablosunu güncelle
    UPDATE orders SET
        status = CASE 
            WHEN new_status = 'completed' THEN 'delivered'
            WHEN new_status = 'partial' THEN 'partially_delivered'
            WHEN new_status = 'pending' THEN 'pending'
            ELSE status
        END,
        is_delivered = CASE 
            WHEN new_status = 'completed' THEN true
            ELSE false
        END,
        delivered_at = CASE 
            WHEN new_status = 'completed' THEN NOW()
            ELSE delivered_at
        END,
        updated_at = NOW()
    WHERE id = order_id_param;
    
    RAISE NOTICE 'Order status güncellendi: % -> % (Quantity: %, Delivered: %)', 
                 order_id_param, new_status, order_quantity, total_delivered;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Order status update error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 3. Geliştirilmiş create_order_delivery fonksiyonu
CREATE OR REPLACE FUNCTION create_order_delivery(
    p_order_id UUID,
    p_delivered_quantity DECIMAL(15,3),
    p_received_by UUID,
    p_delivery_notes TEXT DEFAULT NULL,
    p_delivery_photos TEXT[] DEFAULT '{}',
    p_quality_check BOOLEAN DEFAULT true,
    p_damage_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    order_rec RECORD;
    remaining_quantity DECIMAL(15,3);
    new_delivery_id UUID;
    new_order_status TEXT;
    request_id UUID;
BEGIN
    -- Siparişi kontrol et
    SELECT o.id, o.quantity, o.material_item_id, o.purchase_request_id, o.supplier_id,
           pri.purchase_request_id as pr_id
    INTO order_rec
    FROM orders o
    INNER JOIN purchase_request_items pri ON o.material_item_id = pri.id
    WHERE o.id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Sipariş bulunamadı'
        );
    END IF;
    
    request_id := order_rec.pr_id;
    
    -- Kalan miktarı kontrol et
    remaining_quantity := get_order_remaining_quantity(p_order_id);
    
    IF p_delivered_quantity > remaining_quantity THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Maksimum %s birim teslim alabilirsiniz. Kalan: %s', 
                remaining_quantity, remaining_quantity)
        );
    END IF;
    
    IF p_delivered_quantity <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Teslim alınan miktar 0''dan büyük olmalıdır'
        );
    END IF;
    
    -- Teslim kaydı oluştur
    INSERT INTO order_deliveries (
        order_id,
        delivered_quantity,
        received_by,
        delivery_notes,
        delivery_photos,
        quality_check,
        damage_notes,
        delivered_at
    ) VALUES (
        p_order_id,
        p_delivered_quantity,
        p_received_by,
        p_delivery_notes,
        p_delivery_photos,
        p_quality_check,
        p_damage_notes,
        NOW()
    ) RETURNING id INTO new_delivery_id;
    
    -- Order status'u güncelle
    PERFORM update_order_status_from_deliveries(p_order_id);
    
    -- Yeni status'u al
    new_order_status := get_order_delivery_status(p_order_id);
    
    -- TALEP DURUMUNU GÜNCELLE (eğer basit sistem kullanılıyorsa)
    PERFORM update_simple_request_status(request_id);
    
    -- Başarılı sonuç döndür
    RETURN json_build_object(
        'success', true,
        'delivery_id', new_delivery_id,
        'order_status', new_order_status,
        'remaining_quantity', get_order_remaining_quantity(p_order_id),
        'total_delivered', get_order_total_delivered(p_order_id),
        'request_status_updated', true
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 4. Tüm order'ların status'larını güncelleyen fonksiyon (bakım için)
CREATE OR REPLACE FUNCTION fix_all_order_statuses()
RETURNS TABLE(
    order_id UUID,
    old_status TEXT,
    new_status TEXT,
    updated BOOLEAN
) AS $$
DECLARE
    order_rec RECORD;
    new_status TEXT;
    success BOOLEAN;
BEGIN
    -- Tüm order'ları kontrol et
    FOR order_rec IN 
        SELECT id, status, quantity
        FROM orders 
        WHERE status IN ('pending', 'partially_delivered')
    LOOP
        -- Yeni status'u hesapla
        new_status := get_order_delivery_status(order_rec.id);
        
        -- Status güncelle
        success := update_order_status_from_deliveries(order_rec.id);
        
        -- Sonucu döndür
        RETURN QUERY SELECT 
            order_rec.id,
            order_rec.status,
            new_status,
            success;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC fonksiyonları için yetki ver
GRANT EXECUTE ON FUNCTION get_order_delivery_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status_from_deliveries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_delivery(UUID, DECIMAL, UUID, TEXT, TEXT[], BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_all_order_statuses() TO authenticated;

-- 6. Test sorguları (isteğe bağlı)
-- Belirli bir order'ın durumunu kontrol et:
-- SELECT get_order_delivery_status('your-order-id-here'::UUID);

-- Tüm order'ların durumunu düzelt:
-- SELECT * FROM fix_all_order_statuses();
