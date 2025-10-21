# İade Status Güncelleme Dokümantasyonu

## 📋 Genel Bakış

Bu dokümantasyon, purchase request (talep) statusunun "iade var" olarak ne zaman güncellendiğini açıklar.

## 🎯 Akıllı Kurallar

Talep statusu iki kurala göre otomatik güncellenir:

### Kural 1: İade Var
**Eğer bir talebe ait herhangi bir siparişte `returned_quantity > 0` ise, status = "iade var"**

### Kural 2: Yeniden Sipariş Verildi
**ANCAK tüm iade edilen miktarlar için yeniden sipariş verildiyse (`is_return_reorder = true`), status = "sipariş verildi"**

### Matematiksel İfade
```
total_returned = SUM(returned_quantity WHERE returned_quantity > 0)
total_reordered = SUM(quantity WHERE is_return_reorder = true)

IF total_returned > 0 AND total_reordered >= total_returned THEN
    status = "sipariş verildi"  -- Tüm iadeler yeniden sipariş edildi
ELSIF total_returned > 0 THEN
    status = "iade var"  -- Henüz tamamı yeniden sipariş verilmedi
END IF
```

## 🔧 Teknik Detaylar

### Database Trigger

Sistem, `orders` tablosunda her değişiklik olduğunda çalışan bir trigger kullanır:

- **Trigger Adı:** `smart_update_return_status_trigger`
- **Fonksiyon Adı:** `smart_update_return_status()`
- **Tetiklenme:** INSERT, UPDATE veya DELETE işlemleri sonrası
- **Amaç:** İlgili purchase request'in statusunu akıllıca kontrol edip güncellemek

### Fonksiyon Mantığı

```sql
-- 1. Toplam iade edilen miktar
SELECT SUM(returned_quantity)
INTO total_returned
FROM orders
WHERE purchase_request_id = request_id
AND returned_quantity > 0;

-- 2. Yeniden sipariş verilen miktar
SELECT SUM(quantity)
INTO total_reordered
FROM orders
WHERE purchase_request_id = request_id
AND is_return_reorder = true;

-- 3. Status belirleme
IF total_returned > 0 AND total_reordered >= total_returned THEN
    -- Tüm iadeler yeniden sipariş edildi
    UPDATE purchase_requests 
    SET status = 'sipariş verildi'
    WHERE id = request_id;
ELSIF total_returned > 0 THEN
    -- İade var ama henüz tamamı yeniden sipariş verilmedi
    UPDATE purchase_requests 
    SET status = 'iade var'
    WHERE id = request_id;
END IF;
```

## 📱 Kullanıcı Arayüzü

### ReturnModal.tsx - İade İşlemi

Kullanıcı iade yaparken:

1. ✅ İade miktarını girer
2. ✅ İade nedenini yazar (opsiyonel)
3. ✅ **"Yeniden sipariş verilsin mi?"** sorusunu yanıtlar (Evet/Hayır)
4. ✅ Fotoğraf ekleyebilir (maksimum 5 adet, opsiyonel)

```typescript
// Orders tablosu güncellenir
await supabase
  .from('orders')
  .update({ 
    returned_quantity: newReturnedQuantity,  // Önceki + Yeni iade
    reorder_requested: reorderRequested,     // true veya false
    updated_at: new Date().toISOString()
  })
  .eq('id', order.id)
```

Bu güncelleme yapıldığında, trigger otomatik olarak çalışır ve purchase request statusunu günceller.

## 🎨 UI'da Gösterim

### PurchaseRequestsTable.tsx

Purchasing officer için özel gösterim:

```typescript
if (userRole === 'purchasing_officer' && status === 'iade var') {
  return (
    <Badge className="bg-orange-100 text-orange-800">
      İade Var
    </Badge>
  )
}
```

## 📊 Örnek Senaryolar

### Senaryo 1: İlk İade
- **Durum:** Sipariş: 100 kg, Teslim: 50 kg
- **İşlem:** 20 kg iade edildi
- **Sonuç:** 
  - `returned_quantity = 20`
  - `is_return_reorder` siparişleri: yok
  - Status → **"iade var"** ✅

### Senaryo 2: Yeniden Sipariş (Kısmi)
- **Durum:** İade: 20 kg
- **İşlem:** 10 kg için yeniden sipariş verildi
- **Sonuç:**
  - `total_returned = 20`
  - `total_reordered = 10`
  - Status → **"iade var"** ✅ (henüz tamamı yeniden sipariş verilmedi)

### Senaryo 3: Yeniden Sipariş (Tam)
- **Durum:** İade: 20 kg
- **İşlem:** 20 kg için yeniden sipariş verildi
- **Sonuç:**
  - `total_returned = 20`
  - `total_reordered = 20`
  - Status → **"sipariş verildi"** ✅ (tüm iadeler yeniden sipariş edildi)

### Senaryo 4: Yeniden Sipariş (Fazla)
- **Durum:** İade: 20 kg
- **İşlem:** 25 kg için yeniden sipariş verildi
- **Sonuç:**
  - `total_returned = 20`
  - `total_reordered = 25`
  - Status → **"sipariş verildi"** ✅ (tüm iadeler karşılandı)

### Senaryo 5: İade Yok
- **Durum:** Sipariş: 100 kg, Teslim: 100 kg
- **İşlem:** Hiç iade yok
- **Sonuç:** 
  - `returned_quantity = 0`
  - Status → "iade var" değil

## 🗂️ İlgili Dosyalar

### Backend (Database)
- `/sql/update_return_status_with_reorder_check.sql` - Migration dosyası (Aktif)
- `/sql/simple_return_status_update.sql` - Eski basit versiyon
- Trigger: `smart_update_return_status_trigger`
- Function: `smart_update_return_status()`

### Frontend (React/TypeScript)
- `/src/components/ReturnModal.tsx` - İade modal'ı
- `/src/components/PurchaseRequestsTable.tsx` - Talep listesi
- `/src/components/offers/MaterialCard.tsx` - Malzeme kartı
- `/src/components/offers/ProcurementView.tsx` - Satın alma görünümü
- `/src/components/offers/SantiyeDepoView.tsx` - Şantiye depo görünümü

## 🔍 Debugging

### Trigger'ın Çalışıp Çalışmadığını Kontrol

```sql
-- Trigger listesi
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'simple_update_return_status_trigger';

-- İade var statusundaki talepler
SELECT 
    pr.id,
    pr.title,
    pr.status,
    COUNT(o.id) as toplam_siparis,
    SUM(CASE WHEN o.returned_quantity > 0 THEN 1 ELSE 0 END) as iade_olan_siparis,
    SUM(o.returned_quantity) as toplam_iade_miktari
FROM purchase_requests pr
INNER JOIN orders o ON o.purchase_request_id = pr.id
WHERE pr.status = 'iade var'
GROUP BY pr.id, pr.title, pr.status;
```

## 📈 Status Geçiş Diyagramı

```
Normal Akış → İade Yapıldı → "iade var" 
                              ↓
                    Yeniden Sipariş Verildi?
                    ↓                      ↓
          Tamamı için verildi        Kısmi veya yok
                    ↓                      ↓
            "sipariş verildi"        "iade var" (devam)
```

### Status Belirleme Kuralları

1. **"iade var"** için:
   - ✅ En az bir siparişte `returned_quantity > 0` olmalı
   - ✅ Henüz tamamı için yeniden sipariş verilmemiş olmalı
   - ✅ `total_reordered < total_returned`

2. **"sipariş verildi"** için:
   - ✅ İade var ama tamamı yeniden sipariş verilmiş olmalı
   - ✅ `total_reordered >= total_returned`

3. **Otomatik Güncelleme:**
   - ✅ Bu kontrol `orders` tablosunda her değişiklikte otomatik yapılır
   - ✅ Trigger hem `returned_quantity` hem `is_return_reorder` değişikliklerinde çalışır

## ⚠️ Önemli Notlar

1. **Otomatik Güncelleme:** Status güncellemesi tamamen otomatiktir, manuel müdahale gerekmez
2. **Yeniden Sipariş Kontrolü:** `is_return_reorder = true` olan siparişler yeniden sipariş olarak sayılır
3. **Miktar Karşılaştırması:** Toplam iade >= Toplam yeniden sipariş ise status "sipariş verildi" olur
4. **Audit Log:** Her iade işlemi `audit_log` tablosuna kaydedilir
5. **Fotoğraf:** İade fotoğrafları Supabase Storage'a yüklenir (`satinalma` bucket, `return_photos/` klasörü)
6. **Performans:** Trigger sadece gerekli durumlarda çalışır (orders tablosunda değişiklik olduğunda)

## 🔄 Migration Geçmişi

### Eski Dosyalar (Artık Kullanılmıyor)
- ❌ `update_request_status_with_reorder_logic.sql` - Karmaşık reorder logic'i
- ❌ `update_request_status_on_return.sql` - Eski versiyon
- ❌ `update_request_status_on_return_fixed.sql` - Fix denemesi
- ❌ `fix_return_reorder_status_update.sql` - Reorder kontrollü
- ❌ `update_request_status_on_reorder_completion.sql` - Reorder completion

### Aktif Dosya
- ✅ `update_return_status_with_reorder_check.sql` - Akıllı yeniden sipariş kontrolü
- ❌ `simple_return_status_update.sql` - Eski basit versiyon (sadece iade kontrolü)

---

**Son Güncelleme:** 2025-10-19  
**Versiyon:** 3.0 (Akıllı Yeniden Sipariş Kontrolü)

