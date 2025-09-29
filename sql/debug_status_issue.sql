-- Debug: Kısmen Teslim Alındı Status Sorunu
-- Bu SQL'i Supabase SQL Editor'da çalıştırarak sorunu analiz edin

-- 1. Son güncellenen purchase_requests'leri kontrol et
SELECT 
    id,
    title,
    status,
    updated_at,
    created_at
FROM purchase_requests 
WHERE status = 'kısmen teslim alındı'
ORDER BY updated_at DESC
LIMIT 10;

-- 2. Orders ve order_deliveries tablosunu kontrol et
SELECT 
    pr.id as request_id,
    pr.title,
    pr.status as request_status,
    o.id as order_id,
    o.quantity as order_quantity,
    o.is_delivered,
    od.delivered_quantity,
    od.delivered_at
FROM purchase_requests pr
INNER JOIN purchase_request_items pri ON pr.id = pri.purchase_request_id
INNER JOIN orders o ON pri.id = o.material_item_id
LEFT JOIN order_deliveries od ON o.id = od.order_id
WHERE pr.status = 'kısmen teslim alındı'
ORDER BY pr.updated_at DESC;

-- 3. update_simple_request_status fonksiyonunu test et
-- (Bir request ID'si ile test edin)
SELECT update_simple_request_status('YOUR_REQUEST_ID_HERE'::UUID);

-- 4. Mevcut status'ları kontrol et
SELECT DISTINCT status, COUNT(*) as count
FROM purchase_requests 
GROUP BY status
ORDER BY count DESC;

-- 5. Son 24 saatte güncellenen talepleri kontrol et
SELECT 
    id,
    title,
    status,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_ago
FROM purchase_requests 
WHERE updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;
