-- Sites tablosuna onaylanan harcama tutarı ekleme
-- Teklif onaylandığında bu alan güncellenecek

-- 1. Sites tablosuna onaylanan harcama alanını ekle
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS approved_expenses DECIMAL(15,2) DEFAULT 0;

-- 2. Sites tablosuna toplam bütçe alanını ekle (isteğe bağlı)
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS total_budget DECIMAL(15,2) DEFAULT 0;

-- 3. İndeks ekle (raporlama için performans)
CREATE INDEX IF NOT EXISTS idx_sites_approved_expenses ON public.sites(approved_expenses);

-- 4. Mevcut verileri güncelle - şu ana kadar onaylanan tekliflerin toplamını hesapla
UPDATE public.sites 
SET approved_expenses = (
    SELECT COALESCE(SUM(o.total_price), 0)
    FROM public.offers o
    INNER JOIN public.purchase_requests pr ON o.purchase_request_id = pr.id
    WHERE pr.site_id = sites.id 
    AND o.is_selected = true
    AND pr.status = 'approved'
);

-- 5. Yorum ekle
COMMENT ON COLUMN public.sites.approved_expenses IS 'Onaylanan tekliflerden toplam harcama tutarı';
COMMENT ON COLUMN public.sites.total_budget IS 'Şantiye için ayrılan toplam bütçe';
