-- Her malzeme için ayrı kullanım amacı ve teslim tarihi alanları ekleme
-- purchase_request_items tablosuna purpose ve delivery_date sütunları eklenir

-- 1. purpose (kullanım amacı) sütunu ekle
ALTER TABLE purchase_request_items 
ADD COLUMN IF NOT EXISTS purpose TEXT;

-- 2. delivery_date (gerekli teslimat tarihi) sütunu ekle
ALTER TABLE purchase_request_items 
ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- 3. Açıklamalar ekle
COMMENT ON COLUMN purchase_request_items.purpose IS 'Bu malzemenin kullanım amacı - her malzeme için ayrı';
COMMENT ON COLUMN purchase_request_items.delivery_date IS 'Bu malzemenin gerekli teslimat tarihi - her malzeme için ayrı';

-- 4. Performans için index'ler ekle
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_delivery_date 
ON purchase_request_items(delivery_date);

-- 5. Test - yeni sütunların başarıyla eklendiğini kontrol et
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_request_items' 
  AND column_name IN ('purpose', 'delivery_date')
ORDER BY column_name;
