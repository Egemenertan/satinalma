-- Orders tablosuna kademeli teslim alma için status güncellemeleri

-- 1. Orders status constraint'ini güncelle (partially_delivered ekle)
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'delivered', 'partially_delivered'));

-- 2. Quantity kolonu olmayanlar için ekle (eski siparişler için)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'quantity'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE orders ADD COLUMN quantity DECIMAL(15,3) DEFAULT 1;
        COMMENT ON COLUMN orders.quantity IS 'Sipariş edilen miktar (kademeli teslim alma için gerekli)';
    END IF;
END $$;

-- 3. Mevcut orders'ları kontrol et ve quantity set et
UPDATE orders 
SET quantity = 1 
WHERE quantity IS NULL OR quantity = 0;

-- 4. View: Siparişlerin detaylı teslim durumu
CREATE OR REPLACE VIEW order_delivery_summary AS
SELECT 
    o.id as order_id,
    o.purchase_request_id,
    o.material_item_id,
    o.supplier_id,
    o.quantity as order_quantity,
    o.status as order_status,
    o.is_delivered,
    o.delivered_at,
    o.received_by,
    
    -- Teslimat özeti
    COALESCE(SUM(od.delivered_quantity), 0) as total_delivered,
    o.quantity - COALESCE(SUM(od.delivered_quantity), 0) as remaining_quantity,
    COUNT(od.id) as delivery_count,
    MAX(od.delivered_at) as last_delivery_at,
    
    -- Durum bilgisi
    CASE 
        WHEN COALESCE(SUM(od.delivered_quantity), 0) = 0 THEN 'pending'
        WHEN o.quantity - COALESCE(SUM(od.delivered_quantity), 0) <= 0 THEN 'completed'
        ELSE 'partial'
    END as delivery_status,
    
    -- Yüzde hesaplama
    CASE 
        WHEN o.quantity > 0 THEN 
            ROUND((COALESCE(SUM(od.delivered_quantity), 0) / o.quantity) * 100, 2)
        ELSE 0
    END as delivery_percentage

FROM orders o
LEFT JOIN order_deliveries od ON o.id = od.order_id
GROUP BY 
    o.id, o.purchase_request_id, o.material_item_id, o.supplier_id,
    o.quantity, o.status, o.is_delivered, o.delivered_at, o.received_by;

-- 5. Comments
COMMENT ON VIEW order_delivery_summary IS 'Siparişlerin kademeli teslim alma durumunu özetleyen view';
COMMENT ON COLUMN orders.quantity IS 'Sipariş edilen toplam miktar (kademeli teslim alma için gerekli)';

-- 6. Test data için örnek insert (isteğe bağlı)
-- Bu kısmı production'da çalıştırmayın, sadece test amaçlı
/*
-- Örnek kademeli teslim kaydı
INSERT INTO order_deliveries (
    order_id, 
    delivered_quantity, 
    received_by, 
    delivery_notes
) VALUES (
    (SELECT id FROM orders LIMIT 1),
    5.0,
    (SELECT id FROM profiles WHERE role = 'santiye_depo' LIMIT 1),
    'İlk kısmi teslimat - 5 adet teslim alındı'
);
*/
