-- Satın alma talep ürünleri tablosuna orijinal miktar sütunu ekleme
-- Bu sütun, ilk talep edilen miktarı saklar ve hiç değişmez

-- 1. Yeni sütunu ekle
ALTER TABLE purchase_request_items 
ADD COLUMN original_quantity DECIMAL(10,2);

-- 2. Mevcut verileri güncelle - quantity değerini original_quantity'ye kopyala
UPDATE purchase_request_items 
SET original_quantity = quantity 
WHERE original_quantity IS NULL;

-- 3. Sütunu zorunlu hale getir
ALTER TABLE purchase_request_items 
ALTER COLUMN original_quantity SET NOT NULL;

-- 4. Açıklama ekle
COMMENT ON COLUMN purchase_request_items.original_quantity IS 'İlk talep edilen miktar - hiç değişmez';
COMMENT ON COLUMN purchase_request_items.quantity IS 'Kalan miktar - gönderimler yapıldıkça azalır';

-- 5. Index ekle performans için
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_original_quantity 
ON purchase_request_items(original_quantity);


