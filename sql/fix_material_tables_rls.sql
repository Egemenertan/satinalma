-- Material tabloları için RLS politikalarını düzelt
-- Bu dosyayı Supabase SQL Editor'de çalıştırın

-- Material categories tablosu
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri sil (varsa)
DROP POLICY IF EXISTS "Material categories are viewable by all authenticated users" ON public.material_categories;
DROP POLICY IF EXISTS "Material categories are insertable by authenticated users" ON public.material_categories;

-- Yeni policy'ler oluştur
CREATE POLICY "Material categories are viewable by all authenticated users" 
ON public.material_categories 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Material categories are insertable by authenticated users" 
ON public.material_categories 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Material subcategories tablosu (eğer varsa)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_subcategories') THEN
        ALTER TABLE public.material_subcategories ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Material subcategories are viewable by all authenticated users" ON public.material_subcategories;
        DROP POLICY IF EXISTS "Material subcategories are insertable by authenticated users" ON public.material_subcategories;
        
        CREATE POLICY "Material subcategories are viewable by all authenticated users" 
        ON public.material_subcategories 
        FOR SELECT 
        TO authenticated 
        USING (true);
        
        CREATE POLICY "Material subcategories are insertable by authenticated users" 
        ON public.material_subcategories 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;
END
$$;

-- Material items tablosu (eğer varsa)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_items') THEN
        ALTER TABLE public.material_items ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Material items are viewable by all authenticated users" ON public.material_items;
        DROP POLICY IF EXISTS "Material items are insertable by authenticated users" ON public.material_items;
        DROP POLICY IF EXISTS "Material items are updatable by authenticated users" ON public.material_items;
        
        CREATE POLICY "Material items are viewable by all authenticated users" 
        ON public.material_items 
        FOR SELECT 
        TO authenticated 
        USING (true);
        
        CREATE POLICY "Material items are insertable by authenticated users" 
        ON public.material_items 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
        
        CREATE POLICY "Material items are updatable by authenticated users" 
        ON public.material_items 
        FOR UPDATE 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END
$$;

-- Kontrol sorguları
SELECT 'material_categories' as table_name, COUNT(*) as count FROM public.material_categories
UNION ALL
SELECT 'material_subcategories' as table_name, COUNT(*) as count FROM public.material_subcategories
UNION ALL  
SELECT 'material_items' as table_name, COUNT(*) as count FROM public.material_items;
