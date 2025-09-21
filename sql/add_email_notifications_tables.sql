-- E-posta bildirimleri için gerekli tablolar ve kolonlar

-- Profiles tablosuna e-posta tercihleri ekleme
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_digest BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS weekly_report BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS urgent_only BOOLEAN DEFAULT false;

-- E-posta logları tablosu
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) kuralları
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- E-posta logları için RLS politikaları
-- Admin ve manager'lar e-posta loglarını görebilir
CREATE POLICY "Admins and managers can view email logs" ON email_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Admin ve manager'lar e-posta gönderebilir
CREATE POLICY "Admins and managers can send emails" ON email_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- System role (for automated emails)
CREATE POLICY "System can send emails" ON email_logs
    FOR INSERT WITH CHECK (
        sent_by IS NULL OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'system'
        )
    );

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON email_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_profiles_email_notifications ON profiles(email_notifications) WHERE email_notifications = true;

-- Profiles tablosundaki e-posta tercihleri için yorum
COMMENT ON COLUMN profiles.email_notifications IS 'Kullanıcının e-posta bildirimi almak isteyip istemediği';
COMMENT ON COLUMN profiles.daily_digest IS 'Günlük özet e-posta tercihi';
COMMENT ON COLUMN profiles.weekly_report IS 'Haftalık rapor e-posta tercihi';
COMMENT ON COLUMN profiles.urgent_only IS 'Sadece acil durumlar için e-posta alma tercihi';

-- E-posta logları tablosu için yorum
COMMENT ON TABLE email_logs IS 'Gönderilen e-posta bildirimi kayıtları';
COMMENT ON COLUMN email_logs.email_type IS 'E-posta türü (new_request, status_change, new_offer, custom)';
COMMENT ON COLUMN email_logs.metadata IS 'E-posta ile birlikte gönderilen ek veriler';

-- Test verileri ekle (opsiyonel)
-- Mevcut kullanıcıları e-posta bildirimlerine opt-in yap
UPDATE profiles 
SET email_notifications = true
WHERE email_notifications IS NULL;
