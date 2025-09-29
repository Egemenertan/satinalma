-- Düzeltilmiş Basit Purchase Request Status Güncelleme
-- "kısmen teslim alındı" durumundan "teslim alındı" durumuna geçişi de sağlar

CREATE OR REPLACE FUNCTION update_simple_request_status(request_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_orders INTEGER := 0;
    delivered_orders INTEGER := 0;
    partial_orders INTEGER := 0;
    new_status TEXT;
    current_status TEXT;
BEGIN
    -- Mevcut durumu al
    SELECT status INTO current_status
    FROM purchase_requests
    WHERE id = request_id_param;
    
    -- Sadece "sipariş verildi" veya "kısmen teslim alındı" durumundaysa güncelle
    IF current_status NOT IN ('sipariş verildi', 'kısmen teslim alındı') THEN
        RETURN FALSE;
    END IF;
    
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
    
    -- Eğer status değişmiyorsa güncelleme yapma
    IF new_status = current_status THEN
        RETURN FALSE;
    END IF;
    
    -- Status'u güncelle
    UPDATE purchase_requests
    SET 
        status = new_status,
        updated_at = NOW()
    WHERE id = request_id_param;
    
    RAISE NOTICE 'Status güncellendi: % -> % (Total: %, Delivered: %, Partial: %)', 
                 current_status, new_status, total_orders, delivered_orders, partial_orders;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Simple request status update error: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- RPC fonksiyonu için yetki ver
GRANT EXECUTE ON FUNCTION update_simple_request_status(UUID) TO authenticated;
