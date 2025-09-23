-- Orders tablosuna material_item_id kolonu ekle
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Önce orders tablosunun mevcut yapısını kontrol et
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. material_item_id kolonu var mı kontrol et
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'material_item_id'
    AND table_schema = 'public'
) as material_item_id_exists;

-- 3. material_item_id kolonu yoksa ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'material_item_id'
        AND table_schema = 'public'
    ) THEN
        -- Kolonu ekle
        ALTER TABLE orders ADD COLUMN material_item_id UUID;
        
        -- Foreign key constraint ekle (purchase_request_items tablosuna referans)
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_material_item_id 
        FOREIGN KEY (material_item_id) 
        REFERENCES purchase_request_items(id) 
        ON DELETE SET NULL;
        
        -- Index ekle (performans için)
        CREATE INDEX idx_orders_material_item_id ON orders(material_item_id);
        
        RAISE NOTICE 'material_item_id kolonu başarıyla eklendi';
    ELSE
        RAISE NOTICE 'material_item_id kolonu zaten mevcut';
    END IF;
END $$;

-- 4. Güncellenmiş tablo yapısını kontrol et
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Yabancı anahtar constraint'lerini kontrol et
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'orders'
ORDER BY tc.constraint_name;

COMMENT ON COLUMN orders.material_item_id IS 'Hangi malzeme kalemi için sipariş verildiğini belirtir. Çoklu malzeme taleplerinde her malzeme için ayrı sipariş kaydı tutulur.';
