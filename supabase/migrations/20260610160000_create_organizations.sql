-- Organizations tablosu - Şirketler için multi-tenant yapı
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_number TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- Profiles tablosuna organization_id ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Index for organization lookup
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- RLS Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Herkes kendi organizasyonunu görebilir
CREATE POLICY "Users can view their organization"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR created_by = auth.uid()
  );

-- Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Organization creator can update
CREATE POLICY "Organization creator can update"
  ON organizations
  FOR UPDATE
  USING (created_by = auth.uid());

COMMENT ON TABLE organizations IS 'Şirketler/Organizasyonlar tablosu - Multi-tenant yapı için';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly benzersiz tanımlayıcı';
COMMENT ON COLUMN profiles.organization_id IS 'Kullanıcının bağlı olduğu organizasyon';
COMMENT ON COLUMN profiles.company_name IS 'Kayıt sırasında girilen şirket adı (organizasyon oluşturulmadan önce)';
