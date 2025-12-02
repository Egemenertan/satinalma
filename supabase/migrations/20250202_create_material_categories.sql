-- Material Categories Tablosu
-- Kategorileri merkezi bir yerden yönetmek için

CREATE TABLE IF NOT EXISTS material_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'Package',
  color VARCHAR(7) DEFAULT '#64748b',
  category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('insaat', 'ofis', 'both')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler
CREATE INDEX idx_material_categories_type ON material_categories(category_type);
CREATE INDEX idx_material_categories_active ON material_categories(is_active);
CREATE INDEX idx_material_categories_order ON material_categories(display_order);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_material_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER material_categories_updated_at
  BEFORE UPDATE ON material_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_material_categories_updated_at();

-- Mevcut kategorileri ekle
INSERT INTO material_categories (name, display_name, description, icon, color, category_type, display_order) VALUES
  -- İnşaat Kategorileri
  ('Diğer Malzemeler', 'Diğer Malzemeler', 'Diğer malzemeler ve genel ürünler', 'Package', '#64748b', 'insaat', 1),
  ('Elektrik Malzemeleri', 'Elektrik Malzemeleri', 'Elektrik tesisatı ve malzemeleri', 'Zap', '#f59e0b', 'insaat', 2),
  ('İnce İşler (Mimari) Malzemeleri', 'İnce İşler (Mimari) Malzemeleri', 'Mimari ve ince işçilik malzemeleri', 'Ruler', '#8b5cf6', 'insaat', 3),
  ('İş Araçları', 'İş Araçları', 'İş aletleri ve ekipmanları', 'Wrench', '#f59e0b', 'insaat', 4),
  ('İş Sağlığı ve Güvenliği', 'İş Sağlığı ve Güvenliği', 'İş güvenliği ekipmanları', 'Shield', '#6366f1', 'insaat', 5),
  ('Kaba İnşaat Malzemeleri', 'Kaba İnşaat Malzemeleri', 'Kaba inşaat malzemeleri', 'Truck', '#ef4444', 'insaat', 6),
  ('Mekanik Malzemeleri', 'Mekanik Malzemeleri', 'Mekanik tesisat ve malzemeleri', 'Settings', '#10b981', 'insaat', 7),
  ('Mobilizasyon & Demobilizasyon', 'Mobilizasyon & Demobilizasyon', 'Mobilizasyon malzemeleri', 'Package2', '#06b6d4', 'insaat', 8),
  ('Temizlik Malzemeleri', 'Temizlik Malzemeleri', 'Temizlik ürünleri', 'Sparkles', '#ec4899', 'insaat', 9),
  
  -- Ofis Kategorileri
  ('Kırtasiye Malzemeleri', 'Kırtasiye Malzemeleri', 'Ofis kırtasiye ürünleri', 'FileText', '#6366f1', 'ofis', 10),
  ('Reklam Ürünleri', 'Reklam Ürünleri', 'Reklam ve tanıtım ürünleri', 'Sparkles', '#ec4899', 'ofis', 11),
  ('Ofis Ekipmanları', 'Ofis Ekipmanları', 'Ofis ekipmanları ve mobilyaları', 'Settings', '#10b981', 'ofis', 12),
  ('Promosyon Ürünleri', 'Promosyon Ürünleri', 'Promosyon ve hediye ürünleri', 'Target', '#f59e0b', 'ofis', 13),
  ('Mutfak Malzemeleri', 'Mutfak Malzemeleri', 'Mutfak malzemeleri', 'Package2', '#06b6d4', 'ofis', 14),
  ('Hijyen ve Temizlik', 'Hijyen ve Temizlik', 'Hijyen ve temizlik ürünleri', 'Sparkles', '#ec4899', 'ofis', 15)
ON CONFLICT (name) DO NOTHING;

-- RLS (Row Level Security) Politikaları
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Herkes kategorileri görebilir"
  ON material_categories
  FOR SELECT
  USING (is_active = true);

-- Sadece admin güncelleyebilir (ileride eklenebilir)
CREATE POLICY "Admin kategorileri yönetebilir"
  ON material_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE material_categories IS 'Malzeme kategorilerini merkezi olarak yöneten tablo';
COMMENT ON COLUMN material_categories.category_type IS 'Kategori tipi: insaat (şantiye), ofis (genel merkez), both (her ikisi)';
COMMENT ON COLUMN material_categories.display_order IS 'Kategorilerin gösterim sırası';

