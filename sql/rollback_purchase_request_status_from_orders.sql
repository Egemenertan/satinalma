-- Rollback Purchase Request Status Management Functions
-- Bu SQL, update_purchase_request_status_from_orders.sql migration'ını geri alır

-- 1. Eklenen yeni fonksiyonları sil
DROP FUNCTION IF EXISTS get_request_total_ordered(UUID);
DROP FUNCTION IF EXISTS get_request_total_delivered(UUID);
DROP FUNCTION IF EXISTS get_request_total_original(UUID);
DROP FUNCTION IF EXISTS calculate_purchase_request_status(UUID);
DROP FUNCTION IF EXISTS update_purchase_request_status_from_orders(UUID);

-- 2. create_order_delivery fonksiyonunu orijinal haline döndür (talep status güncellemesi olmadan)
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
    result JSON;
BEGIN
    -- Siparişi kontrol et
    SELECT id, quantity, material_item_id, purchase_request_id, supplier_id
    INTO order_rec
    FROM orders
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Sipariş bulunamadı'
        );
    END IF;
    
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
    
    -- Başarılı sonuç döndür (talep status güncellemesi YOK)
    RETURN json_build_object(
        'success', true,
        'delivery_id', new_delivery_id,
        'order_status', new_status,
        'remaining_quantity', get_order_remaining_quantity(p_order_id),
        'total_delivered', get_order_total_delivered(p_order_id)
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;
