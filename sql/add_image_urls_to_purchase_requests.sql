-- Purchase requests tablosuna image_urls kolonu ekle
-- Bu kolon malzeme talepleri için upload edilen resimlerin URL'lerini saklar

ALTER TABLE purchase_requests 
ADD COLUMN image_urls text[];

-- Kolon açıklaması ekle
COMMENT ON COLUMN purchase_requests.image_urls IS 'Malzeme talebi ile ilgili upload edilen resimlerin Supabase Storage URL listesi';

-- Örnek kullanım:
-- image_urls = ['https://storage.supabase.co/...', 'https://storage.supabase.co/...']
