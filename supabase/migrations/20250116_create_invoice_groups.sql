-- Migration: Invoice Groups Tablosu
-- Toplu fatura ilişkilendirmesi için yeni tablo ve güncellemeler
-- Tarih: 2025-01-16

-- 1. invoice_groups tablosunu oluştur
CREATE TABLE IF NOT EXISTS invoice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  group_name TEXT,
  notes TEXT,
  subtotal NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2),
  tax NUMERIC(12, 2),
  grand_total NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  invoice_photos TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. invoices tablosuna invoice_group_id kolonu ekle
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_group_id UUID REFERENCES invoice_groups(id) ON DELETE SET NULL;

-- 3. invoice_groups için index'ler
CREATE INDEX IF NOT EXISTS idx_invoice_groups_created_at ON invoice_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_groups_created_by ON invoice_groups(created_by);

-- 4. invoices tablosuna invoice_group_id için index
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_group_id ON invoices(invoice_group_id);

-- 5. Row Level Security (RLS) politikaları
ALTER TABLE invoice_groups ENABLE ROW LEVEL SECURITY;

-- Tüm yetkili kullanıcılar (purchasing_officer, admin, manager) okuyabilir
CREATE POLICY "Yetkili kullanıcılar invoice_groups okuyabilir"
  ON invoice_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('purchasing_officer', 'admin', 'manager')
    )
  );

-- Tüm yetkili kullanıcılar ekleyebilir
CREATE POLICY "Yetkili kullanıcılar invoice_groups ekleyebilir"
  ON invoice_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('purchasing_officer', 'admin', 'manager')
    )
  );

-- Tüm yetkili kullanıcılar güncelleyebilir
CREATE POLICY "Yetkili kullanıcılar invoice_groups güncelleyebilir"
  ON invoice_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('purchasing_officer', 'admin', 'manager')
    )
  );

-- Tüm yetkili kullanıcılar silebilir
CREATE POLICY "Yetkili kullanıcılar invoice_groups silebilir"
  ON invoice_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('purchasing_officer', 'admin', 'manager')
    )
  );

-- 6. Kolay sorgulama için view oluştur
CREATE OR REPLACE VIEW invoice_groups_with_orders AS
SELECT 
  ig.id,
  ig.created_at,
  ig.created_by,
  ig.group_name,
  ig.notes,
  ig.subtotal,
  ig.discount,
  ig.tax,
  ig.grand_total,
  ig.currency,
  ig.invoice_photos,
  ig.updated_at,
  json_agg(
    json_build_object(
      'invoice_id', i.id,
      'order_id', i.order_id,
      'amount', i.amount,
      'currency', i.currency,
      'created_at', i.created_at
    ) ORDER BY i.created_at
  ) FILTER (WHERE i.id IS NOT NULL) as invoices,
  COUNT(i.id) as invoice_count
FROM invoice_groups ig
LEFT JOIN invoices i ON i.invoice_group_id = ig.id
GROUP BY ig.id, ig.created_at, ig.created_by, ig.group_name, ig.notes, 
         ig.subtotal, ig.discount, ig.tax, ig.grand_total, ig.currency, 
         ig.invoice_photos, ig.updated_at;

-- 7. View için RLS politikası
ALTER VIEW invoice_groups_with_orders SET (security_invoker = on);

-- 8. Updated_at trigger fonksiyonu (eğer yoksa)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. invoice_groups için updated_at trigger
CREATE TRIGGER update_invoice_groups_updated_at
  BEFORE UPDATE ON invoice_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Yorum ekle
COMMENT ON TABLE invoice_groups IS 'Toplu fatura grupları - hangi siparişlerin birlikte faturalandığını takip eder';
COMMENT ON COLUMN invoice_groups.group_name IS 'Fatura grubu için opsiyonel isim';
COMMENT ON COLUMN invoice_groups.subtotal IS 'Tüm sipariş tutarlarının toplamı';
COMMENT ON COLUMN invoice_groups.discount IS 'Toplam indirim tutarı';
COMMENT ON COLUMN invoice_groups.tax IS 'Toplam KDV tutarı';
COMMENT ON COLUMN invoice_groups.grand_total IS 'Genel toplam (subtotal - discount + tax)';
COMMENT ON COLUMN invoices.invoice_group_id IS 'Bu faturanın ait olduğu toplu fatura grubu';






