-- Orders tablosuna user_id kolonu ekle
-- Sipariş veren kullanıcıyı takip etmek için

-- 1. user_id kolonu var mı kontrol et
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'user_id'
    AND table_schema = 'public'
) as user_id_exists;

-- 2. user_id kolonu yoksa ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Kolonu ekle (profiles tablosuna referans)
        ALTER TABLE orders ADD COLUMN user_id UUID;
        
        -- Foreign key constraint ekle (profiles tablosuna referans)
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES profiles(id) 
        ON DELETE SET NULL;
        
        -- Index ekle (performans için)
        CREATE INDEX idx_orders_user_id ON orders(user_id);
        
        RAISE NOTICE 'user_id kolonu başarıyla eklendi';
    ELSE
        RAISE NOTICE 'user_id kolonu zaten mevcut';
    END IF;
END $$;

-- 3. Güncellenmiş tablo yapısını kontrol et
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'orders' AND table_schema = 'public'
ORDER BY ordinal_position;

COMMENT ON COLUMN orders.user_id IS 'Siparişi veren purchasing officer kullanıcısı. Hangi kullanıcının hangi tedarikçiden sipariş verdiğini takip eder.';

