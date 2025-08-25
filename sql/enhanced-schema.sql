-- Gelişmiş Satın Alma Yönetim Sistemi Veritabanı Şeması
-- Şantiye bazlı talep yönetimi için kapsamlı şema

-- 1. Şantiyeler tablosu
CREATE TABLE IF NOT EXISTS public.construction_sites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- Şantiye kodu (örn: SH001)
    location TEXT,
    project_manager_id UUID REFERENCES auth.users(id),
    budget_total DECIMAL(15,2) DEFAULT 0,
    budget_used DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended')),
    start_date DATE,
    end_date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Kullanıcılar tablosunu genişlet
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'engineer' 
    CHECK (role IN ('engineer', 'site_supervisor', 'procurement_specialist', 'finance_manager', 'project_manager', 'general_manager', 'admin'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS approval_limit DECIMAL(15,2) DEFAULT 0; -- Onay limiti
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS construction_site_id UUID REFERENCES public.construction_sites(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Tedarikçiler tablosu
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    tax_number VARCHAR(50),
    payment_terms INTEGER DEFAULT 30, -- Ödeme vade günü
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5), -- 0-5 puan
    is_approved BOOLEAN DEFAULT false,
    contract_start_date DATE,
    contract_end_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Malzeme kategorileri
CREATE TABLE IF NOT EXISTS public.material_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    parent_id UUID REFERENCES public.material_categories(id),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Malzemeler/Stok tablosu
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    category_id UUID REFERENCES public.material_categories(id),
    unit VARCHAR(20) NOT NULL, -- kg, m3, adet, ton vb.
    current_stock DECIMAL(15,3) DEFAULT 0,
    min_stock_level DECIMAL(15,3) DEFAULT 0,
    max_stock_level DECIMAL(15,3) DEFAULT 0,
    average_price DECIMAL(15,2) DEFAULT 0,
    last_price DECIMAL(15,2) DEFAULT 0,
    specifications TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Gelişmiş satın alma talepleri tablosu
DROP TABLE IF EXISTS public.purchase_requests;
CREATE TABLE public.purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_number VARCHAR(50) UNIQUE NOT NULL, -- REQ-2024-001 formatında
    construction_site_id UUID NOT NULL REFERENCES public.construction_sites(id),
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    material_id UUID REFERENCES public.materials(id),
    material_name VARCHAR(255) NOT NULL, -- Materyal tablosunda yoksa elle girilebilir
    quantity DECIMAL(15,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    estimated_price DECIMAL(15,2),
    total_estimated_cost DECIMAL(15,2),
    urgency_level VARCHAR(20) DEFAULT 'routine' CHECK (urgency_level IN ('urgent', 'normal', 'routine')),
    required_date DATE,
    purpose TEXT,
    specifications TEXT,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN (
        'draft', 'submitted', 'pending_offers', 'offers_received', 
        'pending_approval', 'approved', 'rejected', 'ordered', 
        'partially_delivered', 'delivered', 'cancelled'
    )),
    rejection_reason TEXT,
    budget_allocated DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Gelişmiş teklifler tablosu
DROP TABLE IF EXISTS public.offers;
CREATE TABLE public.offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    offer_number VARCHAR(100),
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP' CHECK (currency IN ('GBP', 'EUR', 'USD', 'TRY')),
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    price_in_base_currency DECIMAL(15,2), -- GBP cinsinden
    delivery_time_days INTEGER,
    delivery_date DATE,
    payment_terms VARCHAR(100),
    validity_date DATE,
    technical_compliance BOOLEAN DEFAULT true,
    notes TEXT,
    document_url TEXT, -- Teklif belgesi URL
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_selected BOOLEAN DEFAULT false,
    evaluation_score DECIMAL(5,2) DEFAULT 0, -- Değerlendirme puanı
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Onay süreci tablosu
DROP TABLE IF EXISTS public.approvals;
CREATE TABLE public.approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    approval_level INTEGER NOT NULL, -- 1, 2, 3 (kademeli onay)
    approver_id UUID NOT NULL REFERENCES auth.users(id),
    required_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decision_date TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    approval_limit DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Siparişler tablosu
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL, -- PO-2024-001 formatında
    request_id UUID NOT NULL REFERENCES public.purchase_requests(id),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    selected_offer_id UUID REFERENCES public.offers(id),
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    vat_rate DECIMAL(5,2) DEFAULT 20,
    vat_amount DECIMAL(15,2) DEFAULT 0,
    total_with_vat DECIMAL(15,2) NOT NULL,
    delivery_address TEXT,
    expected_delivery_date DATE,
    terms_and_conditions TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'confirmed', 'partially_delivered', 
        'delivered', 'invoiced', 'paid', 'cancelled'
    )),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Teslimat takibi
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id),
    delivery_note_number VARCHAR(100),
    delivered_quantity DECIMAL(15,3) NOT NULL,
    delivery_date DATE NOT NULL,
    received_by UUID REFERENCES auth.users(id),
    quality_check_passed BOOLEAN DEFAULT true,
    damage_report TEXT,
    delivery_document_url TEXT, -- İrsaliye belgesi
    warehouse_location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Fatura takibi
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    vat_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'approved', 'paid', 'overdue', 'disputed'
    )),
    payment_date DATE,
    payment_reference VARCHAR(100),
    invoice_document_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Bütçe takibi
CREATE TABLE IF NOT EXISTS public.budget_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    construction_site_id UUID NOT NULL REFERENCES public.construction_sites(id),
    category_id UUID REFERENCES public.material_categories(id),
    allocated_amount DECIMAL(15,2) NOT NULL,
    used_amount DECIMAL(15,2) DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Sistem logları
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'request', 'offer', 'approval' vb.
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Bildirimler tablosu
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'approval_needed', 'offer_received', 'budget_alert' vb.
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    is_email_sent BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Kur değişimleri tablosu
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(10,4) NOT NULL,
    date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, date)
);

-- İndeksler ve performans optimizasyonu
CREATE INDEX IF NOT EXISTS idx_purchase_requests_site ON public.purchase_requests(construction_site_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON public.purchase_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_offers_request ON public.offers(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_supplier ON public.offers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_approvals_request ON public.approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON public.approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id, created_at);

-- RLS (Row Level Security) politikaları
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Temel veriler ekleme
INSERT INTO public.material_categories (name, code, description) VALUES
('Yapı Malzemeleri', 'YM', 'Genel yapı malzemeleri'),
('Elektrik', 'EL', 'Elektrik malzemeleri'),
('Tesisat', 'TS', 'Su ve kanalizasyon malzemeleri'),
('Doğalgaz', 'DG', 'Doğalgaz tesisat malzemeleri'),
('Boyalar', 'BY', 'Boya ve kimyasal malzemeler'),
('İş Güvenliği', 'IG', 'İş güvenliği ekipmanları')
ON CONFLICT (code) DO NOTHING;

-- Örnek şantiye
INSERT INTO public.construction_sites (name, code, location, budget_total, status, description) VALUES
('Ataşehir Konut Projesi', 'ATK001', 'Ataşehir, İstanbul', 500000.00, 'active', 'Lüks konut projesi')
ON CONFLICT (code) DO NOTHING;

-- Trigger fonksiyonları
-- Updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger'ları ekle
DROP TRIGGER IF EXISTS update_construction_sites_updated_at ON public.construction_sites;
CREATE TRIGGER update_construction_sites_updated_at 
    BEFORE UPDATE ON public.construction_sites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON public.purchase_requests;
CREATE TRIGGER update_purchase_requests_updated_at 
    BEFORE UPDATE ON public.purchase_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Talep numarası otomatik oluşturma
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
        NEW.request_number := 'REQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                             LPAD(nextval('request_number_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence oluştur
CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1;

-- Trigger ekle
DROP TRIGGER IF EXISTS generate_request_number_trigger ON public.purchase_requests;
CREATE TRIGGER generate_request_number_trigger
    BEFORE INSERT ON public.purchase_requests
    FOR EACH ROW EXECUTE FUNCTION generate_request_number();


