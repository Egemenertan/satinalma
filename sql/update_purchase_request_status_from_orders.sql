-- Purchase Request Status Management Based on Order Deliveries
-- Sipariş teslim alma işlemlerinden sonra talep durumunu otomatik günceller

-- 1. Talep için toplam sipariş edilen miktarı hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION get_request_total_ordered(request_id_param UUID)
RETURNS DECIMAL(15,3) AS $$
DECLARE
    total_ordered DECIMAL(15,3) := 0;
BEGIN
    SELECT COALESCE(SUM(o.quantity), 0)
    INTO total_ordered
    FROM orders o
    INNER JOIN purchase_request_items pri ON o.material_item_id = pri.id
    WHERE pri.purchase_request_id = request_id_param;
    
    RETURN total_ordered;
END;
$$ LANGUAGE plpgsql;

-- 2. Talep için toplam teslim alınan miktarı hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION get_request_total_delivered(request_id_param UUID)
RETURNS DECIMAL(15,3) AS $$
DECLARE
    total_delivered DECIMAL(15,3) := 0;
BEGIN
    SELECT COALESCE(SUM(od.delivered_quantity), 0)
    INTO total_delivered
    FROM order_deliveries od
    INNER JOIN orders o ON od.order_id = o.id
    INNER JOIN purchase_request_items pri ON o.material_item_id = pri.id
    WHERE pri.purchase_request_id = request_id_param;
    
    RETURN total_delivered;
END;
$$ LANGUAGE plpgsql;

-- 3. Talep için toplam orijinal miktarı hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION get_request_total_original(request_id_param UUID)
RETURNS DECIMAL(15,3) AS $$
DECLARE
    total_original DECIMAL(15,3) := 0;
BEGIN
    SELECT COALESCE(SUM(COALESCE(original_quantity, quantity)), 0)
    INTO total_original
    FROM purchase_request_items
    WHERE purchase_request_id = request_id_param;
    
    RETURN total_original;
END;
$$ LANGUAGE plpgsql;

-- 4. Talep durumunu hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION calculate_purchase_request_status(request_id_param UUID)
RETURNS TEXT AS $$
DECLARE
    total_original DECIMAL(15,3) := 0;
    total_ordered DECIMAL(15,3) := 0;
    total_delivered DECIMAL(15,3) := 0;
    current_status TEXT;
BEGIN
    -- Mevcut durumu al
    SELECT status INTO current_status
    FROM purchase_requests
    WHERE id = request_id_param;
    
    -- Eğer talep henüz "sipariş verildi" durumuna geçmemişse, mevcut durumu koru
    IF current_status != 'sipariş verildi' THEN
        RETURN current_status;
    END IF;
    
    -- Toplam miktarları hesapla
    total_original := get_request_total_original(request_id_param);
    total_ordered := get_request_total_ordered(request_id_param);
    total_delivered := get_request_total_delivered(request_id_param);
    
    -- Sipariş verilmemişse mevcut durumu koru
    IF total_ordered = 0 THEN
        RETURN current_status;
    END IF;
    
    -- Teslim alma durumuna göre status belirle
    IF total_delivered >= total_ordered THEN
        -- Tüm siparişler teslim alındı
        RETURN 'teslim alındı';
    ELSIF total_delivered > 0 THEN
        -- Kısmen teslim alındı
        RETURN 'kısmen teslim alındı';
    ELSE
        -- Henüz teslim alınmadı
        RETURN 'sipariş verildi';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Talep durumunu güncelleyen fonksiyon
CREATE OR REPLACE FUNCTION update_purchase_request_status_from_orders(request_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    new_status TEXT;
BEGIN
    -- Yeni durumu hesapla
    new_status := calculate_purchase_request_status(request_id_param);
    
    -- Durumu güncelle
    UPDATE purchase_requests
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id_param;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Purchase request status update error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. Geliştirilmiş create_order_delivery fonksiyonu - talep durumunu da günceller
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
    result JSON;
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
    
    -- Siparişin yeni durumunu hesapla
    new_order_status := get_order_delivery_status(p_order_id);
    
    -- Orders tablosunu güncelle
    UPDATE orders SET
        status = CASE 
            WHEN new_order_status = 'completed' THEN 'delivered'
            WHEN new_order_status = 'partial' THEN 'partially_delivered'
            ELSE status
        END,
        is_delivered = CASE 
            WHEN new_order_status = 'completed' THEN true
            ELSE false
        END,
        delivered_at = CASE 
            WHEN new_order_status = 'completed' THEN NOW()
            ELSE delivered_at
        END,
        received_by = CASE 
            WHEN new_order_status = 'completed' THEN p_received_by
            ELSE received_by
        END,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- TALEP DURUMUNU GÜNCELLE
    PERFORM update_purchase_request_status_from_orders(request_id);
    
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

-- 7. RPC fonksiyonları için yetki ver
GRANT EXECUTE ON FUNCTION get_request_total_ordered(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_request_total_delivered(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_request_total_original(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_purchase_request_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_purchase_request_status_from_orders(UUID) TO authenticated;
