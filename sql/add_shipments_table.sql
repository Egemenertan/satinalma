-- Gönderim kayıtları tablosu
CREATE TABLE IF NOT EXISTS shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  purchase_request_item_id UUID NOT NULL REFERENCES purchase_request_items(id) ON DELETE CASCADE,
  shipped_quantity DECIMAL(10,2) NOT NULL CHECK (shipped_quantity > 0),
  shipped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shipped_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX idx_shipments_purchase_request_id ON shipments(purchase_request_id);
CREATE INDEX idx_shipments_purchase_request_item_id ON shipments(purchase_request_item_id);
CREATE INDEX idx_shipments_shipped_by ON shipments(shipped_by);
CREATE INDEX idx_shipments_shipped_at ON shipments(shipped_at);

-- RLS politikaları
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Okuma: Herkes görebilir
CREATE POLICY "Anyone can view shipments" ON shipments
  FOR SELECT USING (true);

-- Ekleme: Sadece authenticated kullanıcılar
CREATE POLICY "Authenticated users can insert shipments" ON shipments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Güncelleme: Sadece kendi oluşturduğu kayıtları güncelleyebilir
CREATE POLICY "Users can update own shipments" ON shipments
  FOR UPDATE USING (shipped_by = auth.uid());

-- Silme: Sadece kendi oluşturduğu kayıtları silebilir  
CREATE POLICY "Users can delete own shipments" ON shipments
  FOR DELETE USING (shipped_by = auth.uid());

-- Trigger updated_at güncelleme için
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shipments_updated_at 
  BEFORE UPDATE ON shipments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Gönderilmiş toplam miktar view'ı
CREATE OR REPLACE VIEW shipment_totals AS
SELECT 
  purchase_request_item_id,
  SUM(shipped_quantity) as total_shipped_quantity,
  COUNT(*) as shipment_count,
  MAX(shipped_at) as last_shipment_date
FROM shipments 
GROUP BY purchase_request_item_id;
