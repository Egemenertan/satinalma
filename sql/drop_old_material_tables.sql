-- Eski material tablolarını sil
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- ⚠️ DİKKAT: Bu işlem geri alınamaz!

-- Önce bağımlılıkları kontrol et
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (ccu.table_name IN ('material_categories', 'material_subcategories', 'material_items')
       OR tc.table_name IN ('material_categories', 'material_subcategories', 'material_items'));

-- supplier_materials tablosundaki eski foreign key'leri sil (varsa)
DO $$
BEGIN
    -- material_category_id foreign key'i sil
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplier_materials_material_category_id_fkey'
    ) THEN
        ALTER TABLE supplier_materials DROP CONSTRAINT supplier_materials_material_category_id_fkey;
        RAISE NOTICE 'material_category_id foreign key silindi';
    END IF;
    
    -- material_subcategory_id foreign key'i sil
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplier_materials_material_subcategory_id_fkey'
    ) THEN
        ALTER TABLE supplier_materials DROP CONSTRAINT supplier_materials_material_subcategory_id_fkey;
        RAISE NOTICE 'material_subcategory_id foreign key silindi';
    END IF;
    
    -- material_item_id foreign key'i sil
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplier_materials_material_item_id_fkey'
    ) THEN
        ALTER TABLE supplier_materials DROP CONSTRAINT supplier_materials_material_item_id_fkey;
        RAISE NOTICE 'material_item_id foreign key silindi';
    END IF;
END $$;

-- supplier_materials tablosundaki eski kolonları sil (varsa)
DO $$
BEGIN
    -- material_category_id kolonunu sil
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_materials' 
        AND column_name = 'material_category_id'
    ) THEN
        ALTER TABLE supplier_materials DROP COLUMN material_category_id;
        RAISE NOTICE 'material_category_id kolonu silindi';
    END IF;
    
    -- material_subcategory_id kolonunu sil
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_materials' 
        AND column_name = 'material_subcategory_id'
    ) THEN
        ALTER TABLE supplier_materials DROP COLUMN material_subcategory_id;
        RAISE NOTICE 'material_subcategory_id kolonu silindi';
    END IF;
    
    -- material_item_id kolonunu sil
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_materials' 
        AND column_name = 'material_item_id'
    ) THEN
        ALTER TABLE supplier_materials DROP COLUMN material_item_id;
        RAISE NOTICE 'material_item_id kolonu silindi';
    END IF;
END $$;

-- Eski material tablolarını sil
DROP TABLE IF EXISTS public.material_items CASCADE;
DROP TABLE IF EXISTS public.material_subcategories CASCADE;
DROP TABLE IF EXISTS public.material_categories CASCADE;

-- purchase_request_items tablosundaki material_items foreign key'i sil (varsa)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%material_items%'
        AND table_name = 'purchase_request_items'
    ) THEN
        -- Foreign key constraint'i bul ve sil
        DECLARE 
            constraint_name text;
        BEGIN
            SELECT tc.constraint_name INTO constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu 
              ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'purchase_request_items' 
              AND tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = 'material_items';
            
            IF constraint_name IS NOT NULL THEN
                EXECUTE 'ALTER TABLE purchase_request_items DROP CONSTRAINT ' || constraint_name;
                RAISE NOTICE 'purchase_request_items material_items foreign key silindi: %', constraint_name;
            END IF;
        END;
    END IF;
END $$;

-- Kontrol: Hangi tablolar kaldı?
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%material%'
ORDER BY tablename;

-- Başarı mesajı
SELECT 'Eski material tabloları başarıyla silindi! Artık sadece all_materials tablosu kullanılıyor.' as sonuc;
