-- Supplier Materials tablosundaki NOT NULL constraint'lerini kaldır
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Önce mevcut tablo yapısını kontrol et
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'supplier_materials' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Material_class ve material_group kolonlarını nullable yap
ALTER TABLE supplier_materials 
ALTER COLUMN material_class DROP NOT NULL;

ALTER TABLE supplier_materials 
ALTER COLUMN material_group DROP NOT NULL;

-- 3. Değişiklikleri kontrol et
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'supplier_materials' 
AND table_schema = 'public'
AND column_name IN ('material_class', 'material_group')
ORDER BY column_name;

-- 4. Başarı mesajı
SELECT 'Material_class ve material_group kolonları artık nullable' as message;
