-- Order Status Güncelleme Testi
-- Bu SQL'i Supabase SQL Editor'da çalıştırarak order status güncellemesini test edin

-- 1. Mevcut order durumlarını kontrol et
SELECT 
    o.id as order_id,
    o.quantity as order_quantity,
    o.status as current_status,
    o.is_delivered,
    o.delivered_at,
    COALESCE(SUM(od.delivered_quantity), 0) as total_delivered,
    o.quantity - COALESCE(SUM(od.delivered_quantity), 0) as remaining_quantity,
    get_order_delivery_status(o.id) as calculated_status
FROM orders o
LEFT JOIN order_deliveries od ON o.id = od.order_id
GROUP BY o.id, o.quantity, o.status, o.is_delivered, o.delivered_at
ORDER BY o.updated_at DESC
LIMIT 10;

-- 2. Problemli order'ları bul (status pending ama delivered quantity >= order quantity)
SELECT 
    o.id as order_id,
    o.quantity as order_quantity,
    o.status as current_status,
    o.is_delivered,
    COALESCE(SUM(od.delivered_quantity), 0) as total_delivered,
    get_order_delivery_status(o.id) as should_be_status
FROM orders o
LEFT JOIN order_deliveries od ON o.id = od.order_id
WHERE o.status = 'pending' 
   OR (o.status != 'delivered' AND o.is_delivered = false)
GROUP BY o.id, o.quantity, o.status, o.is_delivered
HAVING COALESCE(SUM(od.delivered_quantity), 0) >= o.quantity
   AND o.quantity > 0;

-- 3. Belirli bir order'ın durumunu test et (order ID'sini değiştirin)
-- SELECT 
--     o.id as order_id,
--     o.quantity as order_quantity,
--     o.status as current_status,
--     o.is_delivered,
--     COALESCE(SUM(od.delivered_quantity), 0) as total_delivered,
--     get_order_delivery_status(o.id) as calculated_status
-- FROM orders o
-- LEFT JOIN order_deliveries od ON o.id = od.order_id
-- WHERE o.id = 'YOUR_ORDER_ID_HERE'::UUID
-- GROUP BY o.id, o.quantity, o.status, o.is_delivered;

-- 4. Tüm problemli order'ları düzelt
SELECT * FROM fix_all_order_statuses();

-- 5. Düzeltme sonrası durumu kontrol et
SELECT 
    o.id as order_id,
    o.quantity as order_quantity,
    o.status as current_status,
    o.is_delivered,
    COALESCE(SUM(od.delivered_quantity), 0) as total_delivered,
    get_order_delivery_status(o.id) as calculated_status
FROM orders o
LEFT JOIN order_deliveries od ON o.id = od.order_id
GROUP BY o.id, o.quantity, o.status, o.is_delivered
HAVING COALESCE(SUM(od.delivered_quantity), 0) >= o.quantity
   AND o.quantity > 0
   AND o.status != 'delivered';
