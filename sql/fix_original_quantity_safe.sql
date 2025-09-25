-- Güvenli original_quantity field düzeltmesi
-- Bu script mevcut veriyi bozmadan original_quantity field'ını düzgün şekilde ayarlar

-- 1. ÖNCE kontrol et: original_quantity column'u var mı?
DO $$
BEGIN
    -- Column varsa sadece null değerleri güncelle
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'purchase_request_items' 
        AND column_name = 'original_quantity'
    ) THEN
        -- original_quantity var ama null olanları quantity ile doldur
        UPDATE purchase_request_items 
        SET original_quantity = quantity 
        WHERE original_quantity IS NULL;
        
        RAISE NOTICE 'original_quantity field zaten var, null değerler güncellendi';
    ELSE
        -- Column yoksa ekle ve doldur
        ALTER TABLE purchase_request_items 
        ADD COLUMN original_quantity DECIMAL(15,3);
        
        UPDATE purchase_request_items 
        SET original_quantity = quantity;
        
        ALTER TABLE purchase_request_items 
        ALTER COLUMN original_quantity SET NOT NULL;
        
        RAISE NOTICE 'original_quantity field eklendi ve dolduruldu';
    END IF;
END
$$;

-- 2. Index ekle (varsa duplicate etmez)
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_original_quantity 
ON purchase_request_items(original_quantity);

-- 3. Comment ekle
COMMENT ON COLUMN purchase_request_items.original_quantity IS 'İlk talep edilen miktar - hiç değişmez';
COMMENT ON COLUMN purchase_request_items.quantity IS 'Kalan miktar - gönderimler yapıldıkça azalır';

-- 4. Kontrol sorgusu
SELECT 
  'original_quantity_check' as check_name,
  COUNT(*) as total_items,
  COUNT(original_quantity) as items_with_original_quantity,
  COUNT(*) - COUNT(original_quantity) as items_with_null_original_quantity
FROM purchase_request_items;
