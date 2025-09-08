-- Purchase requests tablosundaki status check constraint'ini güncelleme
-- 'şantiye şefi onayladı' değerini kabul edecek şekilde

DO $$
BEGIN
    -- Önce mevcut constraint'i kaldır (varsa)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'purchase_requests_status_check'
    ) THEN
        ALTER TABLE purchase_requests DROP CONSTRAINT purchase_requests_status_check;
    END IF;
    
    -- Yeni constraint'i tüm status değerlerini içerecek şekilde oluştur
    ALTER TABLE purchase_requests ADD CONSTRAINT purchase_requests_status_check 
    CHECK (status IN (
        'draft',
        'pending',
        'şantiye şefi onayladı',
        'awaiting_offers',
        'approved',
        'rejected',
        'cancelled',
        'sipariş verildi'
    ));
END $$;
