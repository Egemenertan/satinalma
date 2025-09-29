-- Order Deliveries (Kademeli Teslim Alma) Tablosu
-- Her siparişin kademeli teslim alınmasını takip eder

CREATE TABLE IF NOT EXISTS public.order_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    delivered_quantity DECIMAL(15,3) NOT NULL CHECK (delivered_quantity > 0),
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    received_by UUID NOT NULL REFERENCES profiles(id),
    delivery_notes TEXT,
    delivery_photos TEXT[] DEFAULT '{}',
    quality_check BOOLEAN DEFAULT true,
    damage_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_deliveries_order_id ON order_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_delivered_at ON order_deliveries(delivered_at);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_received_by ON order_deliveries(received_by);

-- RLS Policies
ALTER TABLE order_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order deliveries are viewable by authenticated users"
    ON order_deliveries FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Order deliveries are insertable by authenticated users"
    ON order_deliveries FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Order deliveries are updatable by authenticated users"
    ON order_deliveries FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE order_deliveries IS 'Her siparişin kademeli teslim alınmasını takip eder. Bir sipariş birden fazla teslimat ile tamamlanabilir.';
COMMENT ON COLUMN order_deliveries.order_id IS 'Hangi siparişin teslimatı (orders tablosuna referans)';
COMMENT ON COLUMN order_deliveries.delivered_quantity IS 'Bu teslimat ile teslim alınan miktar';
COMMENT ON COLUMN order_deliveries.delivered_at IS 'Teslimat tarihi ve saati';
COMMENT ON COLUMN order_deliveries.received_by IS 'Teslimatı alan kullanıcı (profiles tablosuna referans)';
COMMENT ON COLUMN order_deliveries.delivery_notes IS 'Teslimat ile ilgili notlar';
COMMENT ON COLUMN order_deliveries.delivery_photos IS 'Teslimat fotoğrafları URL array';
COMMENT ON COLUMN order_deliveries.quality_check IS 'Kalite kontrolü geçti mi?';
COMMENT ON COLUMN order_deliveries.damage_notes IS 'Hasar varsa açıklama';

-- Updated at trigger
CREATE TRIGGER handle_order_deliveries_updated_at 
    BEFORE UPDATE ON order_deliveries
    FOR EACH ROW 
    EXECUTE PROCEDURE moddatetime(updated_at);
