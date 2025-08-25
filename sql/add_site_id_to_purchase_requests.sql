-- Purchase requests tablosuna site_id alanı ekleme migration
-- Şantiye bilgisini purchase requests ile ilişkilendirmek için

-- 1. site_id alanını ekle
ALTER TABLE public.purchase_requests 
ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id);

-- 2. site_name alanını da ekle (performans için denormalize)
ALTER TABLE public.purchase_requests 
ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);

-- 3. İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_site_id ON public.purchase_requests(site_id);

-- 4. Mevcut kayıtları güncelle (varsa)
-- Bu kısım opsiyonel, mevcut veriler için default değer atayabilir
-- UPDATE public.purchase_requests 
-- SET site_name = 'Varsayılan Şantiye' 
-- WHERE site_name IS NULL;

-- 5. RLS politikalarını güncelle (gerekirse)
-- Bu kısım şantiye bazlı erişim kontrolü için kullanılabilir

COMMENT ON COLUMN public.purchase_requests.site_id IS 'Sites tablosu ile ilişki - hangi şantiye için talep';
COMMENT ON COLUMN public.purchase_requests.site_name IS 'Şantiye adı (performans için denormalize edilmiş)';
