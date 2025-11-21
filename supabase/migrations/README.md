# Invoice Groups Migration

## Migration Dosyası
`20250116_create_invoice_groups.sql`

## Ne Yapıyor?
Bu migration, toplu fatura ilişkilendirmesi için yeni bir yapı oluşturuyor:

1. **invoice_groups** tablosu oluşturuluyor
2. **invoices** tablosuna `invoice_group_id` kolonu ekleniyor
3. **invoice_groups_with_orders** view'i oluşturuluyor (kolay sorgulama için)
4. RLS (Row Level Security) politikaları ekleniyor

## Manuel Uygulama (Supabase Dashboard)

### Adım 1: Supabase Dashboard'a Git
1. https://supabase.com/dashboard adresine git
2. Projenizi seçin
3. Sol menüden **SQL Editor**'e tıklayın

### Adım 2: Migration'ı Çalıştır
1. "New query" butonuna tıklayın
2. `20250116_create_invoice_groups.sql` dosyasının içeriğini kopyalayıp yapıştırın
3. "Run" butonuna basın

### Adım 3: Doğrulama
Aşağıdaki sorguları çalıştırarak migration'ın başarılı olduğunu doğrulayın:

```sql
-- invoice_groups tablosunu kontrol et
SELECT * FROM invoice_groups LIMIT 1;

-- invoices tablosunda invoice_group_id kolonunu kontrol et
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name = 'invoice_group_id';

-- View'i kontrol et
SELECT * FROM invoice_groups_with_orders LIMIT 1;
```

## Supabase CLI ile Uygulama (Alternatif)

Eğer Supabase CLI kuruluysa:

```bash
# CLI'yi kur (eğer yoksa)
npm install -g supabase

# Login ol
supabase login

# Projeye bağlan
supabase link --project-ref YOUR_PROJECT_REF

# Migration'ı uygula
supabase db push
```

## Rollback (Geri Alma)

Eğer migration'ı geri almak isterseniz:

```sql
-- View'i sil
DROP VIEW IF EXISTS invoice_groups_with_orders;

-- invoices tablosundan invoice_group_id kolonunu kaldır
ALTER TABLE invoices DROP COLUMN IF EXISTS invoice_group_id;

-- invoice_groups tablosunu sil
DROP TABLE IF EXISTS invoice_groups CASCADE;
```

## Notlar

- Migration geriye uyumludur - mevcut faturalar çalışmaya devam eder
- `is_master` ve `parent_invoice_id` kolonları deprecated oldu ama hala mevcut
- Yeni toplu faturalar `invoice_groups` tablosunu kullanacak





