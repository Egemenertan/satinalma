-- Tedarikçi malzemeleri tablosunu yeniden oluştur
-- all_materials tablosuna uygun şekilde

-- Eski tabloyu sil (varsa)
DROP TABLE IF EXISTS public.supplier_materials;

-- Yeni supplier_materials tablosunu oluştur
CREATE TABLE public.supplier_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    
    -- all_materials tablosundaki sütunlarla uyumlu
    material_class TEXT NOT NULL,
    material_group TEXT NOT NULL,
    material_item TEXT NOT NULL,
    
    -- Ek tedarikçi-spesifik bilgiler
    price_range_min DECIMAL(15,2),
    price_range_max DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'TRY',
    delivery_time_days INTEGER DEFAULT 30,
    minimum_order_quantity DECIMAL(15,3),
    is_preferred BOOLEAN DEFAULT false,
    notes TEXT,
    
    -- Zaman damgaları
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Aynı tedarikçi için aynı malzeme tekrar eklenmesin
    UNIQUE(supplier_id, material_class, material_group, material_item)
);

-- İndeksler
CREATE INDEX idx_supplier_materials_supplier_id ON public.supplier_materials(supplier_id);
CREATE INDEX idx_supplier_materials_class ON public.supplier_materials(material_class);
CREATE INDEX idx_supplier_materials_group ON public.supplier_materials(material_group);
CREATE INDEX idx_supplier_materials_item ON public.supplier_materials(material_item);

-- RLS politikaları
ALTER TABLE public.supplier_materials ENABLE ROW LEVEL SECURITY;

-- Herkesi okuma yetkisi
CREATE POLICY "Anyone can view supplier materials" ON public.supplier_materials
    FOR SELECT USING (true);

-- Sadece authenticated kullanıcılar ekleme yapabilir
CREATE POLICY "Authenticated users can insert supplier materials" ON public.supplier_materials
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Sadece authenticated kullanıcılar güncelleme yapabilir
CREATE POLICY "Authenticated users can update supplier materials" ON public.supplier_materials
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Sadece authenticated kullanıcılar silme yapabilir
CREATE POLICY "Authenticated users can delete supplier materials" ON public.supplier_materials
    FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supplier_materials_updated_at BEFORE UPDATE
    ON public.supplier_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Örnek veri ekleme (opsiyonel)
COMMENT ON TABLE public.supplier_materials IS 'Tedarikçilerin sağladığı malzemelerin listesi - all_materials tablosu ile uyumlu';
COMMENT ON COLUMN public.supplier_materials.material_class IS 'all_materials.class ile eşleşir';
COMMENT ON COLUMN public.supplier_materials.material_group IS 'all_materials.group ile eşleşir';
COMMENT ON COLUMN public.supplier_materials.material_item IS 'all_materials.item_name ile eşleşir';
