-- =============================================================================
-- Auth Handoff Tablosu
-- =============================================================================
-- Amaç: Teams/Outlook gömülü ortamda popup OAuth akışı için, popup ile parent
--       iframe arasında güvenli token transit kanalı.
--
-- Neden gerekli?
--   - Modern tarayıcılarda Cross-Origin-Opener-Policy ve storage partitioning
--     popup ↔ iframe doğrudan iletişimi engeller.
--   - Microsoft auth pencerelerinden geri dönüldüğünde window.opener referansı
--     severe edilir → notifySuccess çalışmaz.
--   - Çözüm: popup token'ları kısa süreliğine sunucuda saklar, parent iframe
--     handoff_id ile çeker.
--
-- Güvenlik:
--   - id: random UUID (popup ↔ parent arasında shared secret)
--   - tokens: jsonb (access_token + refresh_token)
--   - 5 dakika TTL — sonra otomatik silinir
--   - GET endpoint çağrıldığında satır anında silinir (one-shot)
--   - RLS: hiç kimse client'tan erişemez (sadece service_role)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.auth_handoffs (
  id          uuid        PRIMARY KEY,
  tokens      jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

-- Süresi dolmuşları index'le hızlı bul (cleanup için)
CREATE INDEX IF NOT EXISTS auth_handoffs_expires_at_idx
  ON public.auth_handoffs (expires_at);

-- RLS: hiçbir client erişemesin (yalnız service_role API'ler kullansın)
ALTER TABLE public.auth_handoffs ENABLE ROW LEVEL SECURITY;

-- Hiç policy yok = anon/authenticated rolü hiçbir şey göremez/yapamaz.

-- =============================================================================
-- Cleanup fonksiyonu
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_handoffs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.auth_handoffs WHERE expires_at < now();
$$;

COMMENT ON TABLE public.auth_handoffs IS
  'Teams/Outlook embedded auth için popup→iframe token transit. 5dk TTL, one-shot read.';
