-- Basit Purchase Request Status Güncelleme
-- Tedarikçi alanında teslim alma işleminden sonra talep durumunu günceller

-- 1. Basit talep durumu güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION update_simple_request_status(request_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_orders INTEGER := 0;
    delivered_orders INTEGER := 0;
    partial_orders INTEGER := 0;
    new_status TEXT;
BEGIN
    -- Bu talebe ait toplam sipariş sayısını hesapla
    SELECT COUNT(*)
    INTO total_orders
    FROM orders o
    INNER JOIN purchase_request_items pri ON o.material_item_id = pri.id
    WHERE pri.purchase_request_id = request_id_param;
    
    -- Tamamen teslim alınan sipariş sayısını hesapla
    SELECT COUNT(*)
    INTO delivered_orders
    FROM orders o
    INNER JOIN purchase_request_items pri ON o.material_item_id = pri.id
    WHERE pri.purchase_request_id = request_id_param
    AND o.is_delivered = true;
    
    -- Kısmen teslim alınan sipariş sayısını hesapla (order_deliveries tablosunda kayıt var ama henüz tamamlanmamış)
    SELECT COUNT(DISTINCT o.id)
    INTO partial_orders
    FROM orders o
    INNER JOIN purchase_request_items pri ON o.material_item_id = pri.id
    INNER JOIN order_deliveries od ON o.id = od.order_id
    WHERE pri.purchase_request_id = request_id_param
    AND o.is_delivered = false;
    
    -- Mevcut durumu kontrol et - sadece "sipariş verildi" durumundaysa güncelle
    IF NOT EXISTS (
        SELECT 1 FROM purchase_requests 
        WHERE id = request_id_param 
        AND status = 'sipariş verildi'
    ) THEN
        RETURN FALSE; -- Sipariş verildi durumunda değilse güncelleme yapma
    END IF;
    
    -- Yeni durumu belirle
    IF total_orders > 0 AND delivered_orders = total_orders THEN
        -- Tüm siparişler tamamen teslim alındı
        new_status := 'teslim alındı';
    ELSIF delivered_orders > 0 OR partial_orders > 0 THEN
        -- En az bir sipariş kısmen veya tamamen teslim alındı
        new_status := 'kısmen teslim alındı';
    ELSE
        -- Hiçbir şey teslim alınmadı, mevcut durumu koru
        RETURN FALSE;
    END IF;
    
    -- Status'u güncelle
    UPDATE purchase_requests
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id_param;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Simple request status update error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 2. create_order_delivery fonksiyonunu güncelle - basit status güncellemesi ekle
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
    new_status TEXT;
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
    new_status := get_order_delivery_status(p_order_id);
    
    -- Orders tablosunu güncelle
    UPDATE orders SET
        status = CASE 
            WHEN new_status = 'completed' THEN 'delivered'
            WHEN new_status = 'partial' THEN 'partially_delivered'
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
        received_by = CASE 
            WHEN new_status = 'completed' THEN p_received_by
            ELSE received_by
        END,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- BASİT TALEP DURUMU GÜNCELLEMESİ
    PERFORM update_simple_request_status(request_id);
    
    -- Başarılı sonuç döndür
    RETURN json_build_object(
        'success', true,
        'delivery_id', new_delivery_id,
        'order_status', new_status,
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

-- 3. RPC fonksiyonu için yetki ver
GRANT EXECUTE ON FUNCTION update_simple_request_status(UUID) TO authenticated;
