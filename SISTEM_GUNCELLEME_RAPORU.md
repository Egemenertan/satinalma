# Sistem Güncelleme Raporu - Order ve Request Status Otomasyonu

**Tarih:** 20 Ekim 2025  
**Konu:** Order ve Purchase Request Status'larının Otomatik Güncellenmesi

---

## 🎯 Amaç

Sistemde iade işlemleri ve teslimat durumlarının otomatik olarak takip edilmesi ve ilgili status'ların (hem order hem de purchase request) otomatik güncellenmesi.

---

## ✅ Yapılan Değişiklikler

### 1. Veritabanı Güncellemeleri

#### A) `orders` Tablosu

**Yeni Sütun:**
- `delivered_quantity` (numeric, default: 0)
  - `order_deliveries` tablosundan otomatik hesaplanır
  - Trigger ile senkronize edilir

**Status Constraint Güncellendi:**
Yeni status değerleri eklendi:
- ✅ `'sipariş verildi'`
- ✅ `'kısmen teslim alındı'`
- ✅ `'teslim alındı'`
- ✅ `'iade var'`
- ✅ `'kısmen teslim alındı ve iade var'`

**Yeni Trigger'lar:**

1. **`trigger_sync_order_delivered_quantity`**
   - `order_deliveries` tablosunda INSERT/UPDATE/DELETE olduğunda çalışır
   - İlgili order'ın `delivered_quantity` değerini günceller

2. **`trigger_update_order_status_on_quantities`**
   - `returned_quantity`, `delivered_quantity` veya `quantity` değiştiğinde çalışır
   - Order status'unu otomatik hesaplar

**Status Hesaplama Mantığı:**
```
returned_quantity > 0 VE delivered_quantity > 0
  → "kısmen teslim alındı ve iade var"

returned_quantity > 0
  → "iade var"

delivered_quantity >= quantity
  → "teslim alındı"

delivered_quantity > 0
  → "kısmen teslim alındı"

Diğer
  → "sipariş verildi"
```

#### B) `purchase_requests` Tablosu

**Status Constraint Güncellendi:**
- ✅ `'iade var'` status değeri eklendi

**Yeni Trigger:**

3. **`trigger_update_request_status_on_order_return`**
   - `orders` tablosunda status değiştiğinde çalışır
   - İlgili purchase request'in status'unu günceller

**Status Güncelleme Mantığı (Öncelik Sırası):**
```
1. ÖNCELİK 1: is_return_reorder = true olan bir order var mı?
  → purchase_requests.status = "sipariş verildi"
  (İade için yeniden sipariş verilmiş, sorun çözülmüş demektir)

2. ÖNCELİK 2: Herhangi bir order'ın status'u "iade var" veya "kısmen teslim alındı ve iade var"
  → purchase_requests.status = "iade var"

3. ÖNCELİK 3: Hiçbir order'da iade yok:
  - Tüm order'lar teslim alınmış → "teslim alındı"
  - Bazı order'lar teslim alınmış → "kısmen teslim alındı"
  - Hiçbiri teslim alınmamış → "sipariş verildi"
```

---

### 2. Frontend Güncellemeleri

#### `MaterialCard.tsx`

**Değişiklik:**
- Tedarikçi kartındaki status badge'leri artık `order.status` sütununu kullanıyor
- Fallback mantığı eklendi (DB'de status NULL olsa bile hesaplanır)

**Yeni Badge Görünümleri:**
- 🟠 **"Kısmen Teslim Alındı ve İade Var"** → Turuncu arka plan, border ile vurgulu
- 🔴 **"İade Var"** → Kırmızı arka plan
- 🟢 **"Tamamı Teslim Alındı"** → Yeşil arka plan
- 🟠 **"Kısmen Teslim Alındı"** → Turuncu arka plan
- 🔵 **"Sipariş Verildi"** → Mavi arka plan

**Kod Örneği:**
```typescript
const orderStatuses = supplier.orders.map((order: any) => {
  // Önce DB'deki status'u kullan
  if (order.status) {
    return order.status
  }
  
  // Fallback: Status yoksa hesapla
  const returnedQty = order.returned_quantity || 0
  const deliveredQty = order.delivered_quantity || 0
  
  if (returnedQty > 0 && deliveredQty > 0) {
    return 'kısmen teslim alındı ve iade var'
  } else if (returnedQty > 0) {
    return 'iade var'
  } else if (deliveredQty >= order.quantity) {
    return 'teslim alındı'
  } else if (deliveredQty > 0) {
    return 'kısmen teslim alındı'
  }
  return 'sipariş verildi'
})
```

---

### 3. Dokümantasyon

**Yeni Dosyalar:**
- ✅ `docs/ORDER_STATUS_AUTO_UPDATE.md` - Detaylı sistem dokümantasyonu
- ✅ `SISTEM_GUNCELLEME_RAPORU.md` - Bu rapor

**İçerik:**
- Sistem mimarisi
- Trigger açıklamaları
- Kullanım senaryoları
- İzleme sorguları
- Tutarlılık kontrol sorguları

---

## 🔄 Akış Diyagramı

```
┌─────────────────────────────────────────────────────────────────┐
│                    İADE İŞLEMİ BAŞLATILIR                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │ UPDATE orders                │
                 │ SET returned_quantity = X    │
                 └──────────────┬───────────────┘
                                │
                                ▼
          ┌─────────────────────────────────────────┐
          │ trigger_update_order_status_on_quantities│
          │ (BEFORE UPDATE)                          │
          └─────────────────┬───────────────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │ orders.status güncellenir │
                │ → "iade var" veya         │
                │ → "kısmen teslim alındı   │
                │    ve iade var"           │
                └───────────┬───────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────────────┐
          │ trigger_update_request_status_on_order_return│
          │ (AFTER UPDATE)                               │
          └─────────────────┬───────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │ İlgili order'ları kontrol et│
              │ İade var mı?                │
              └─────────┬───────────────────┘
                        │
                        ├─── Evet ──┐
                        │            ▼
                        │   ┌────────────────────────────┐
                        │   │ purchase_requests.status   │
                        │   │ → "iade var"               │
                        │   └────────────────────────────┘
                        │
                        └─── Hayır ─┐
                                     ▼
                        ┌──────────────────────────────┐
                        │ Teslimat durumuna göre       │
                        │ status güncelle:             │
                        │ - teslim alındı              │
                        │ - kısmen teslim alındı       │
                        │ - sipariş verildi            │
                        └──────────────────────────────┘
```

---

## 📊 Kullanım Senaryoları

### Senaryo 1: Normal İade İşlemi

```sql
-- Başlangıç: Order teslim alınmış
-- orders.status = 'teslim alındı'
-- purchase_requests.status = 'teslim alındı'

-- İade işlemi başlatılır
UPDATE orders SET returned_quantity = 20 WHERE id = 'xxx';

-- Otomatik olarak:
-- 1. orders.status → 'kısmen teslim alındı ve iade var'
-- 2. purchase_requests.status → 'iade var'
```

### Senaryo 2: Birden Fazla Order, Bir Tanesinde İade

```sql
-- Purchase Request: PR-001
-- Order 1: status = 'teslim alındı' (iade yok)
-- Order 2: status = 'kısmen teslim alındı' (iade yok)
-- purchase_requests.status = 'kısmen teslim alındı'

-- Order 1'de iade işlemi
UPDATE orders SET returned_quantity = 10 WHERE id = order_1_id;

-- Otomatik olarak:
-- 1. orders[1].status → 'kısmen teslim alındı ve iade var'
-- 2. purchase_requests.status → 'iade var'
--    (çünkü EN AZ BİR order'da iade var)
```

### Senaryo 3: İade Sorunu Çözülür

```sql
-- İade var durumu
-- orders.status = 'iade var'
-- purchase_requests.status = 'iade var'

-- İade sorunu çözüldü, iade miktarı sıfırlandı
UPDATE orders SET returned_quantity = 0 WHERE id = 'xxx';

-- Otomatik olarak:
-- 1. orders.status → 'sipariş verildi' (veya teslim durumuna göre)
-- 2. purchase_requests.status → 'sipariş verildi' (veya teslim durumuna göre)
```

### Senaryo 4: İade Sonrası Yeniden Sipariş ⭐ YENİ

```sql
-- İade durumu var
-- Order 1: status = 'iade var', returned_quantity = 50
-- purchase_requests.status = 'iade var'

-- Purchasing officer yeniden sipariş oluşturur
INSERT INTO orders (
  purchase_request_id,
  supplier_id,
  quantity,
  is_return_reorder
) VALUES (
  'pr-001',
  'supplier-abc',
  50,
  true  -- ✅ YENİDEN SİPARİŞ İŞARETİ
);

-- Otomatik olarak:
-- 1. NEW order.status → 'sipariş verildi'
-- 2. purchase_requests.status → 'sipariş verildi'
--    (Artık 'iade var' değil! İade çözülmüş sayılır.)
--    (Purchasing officer tabloda bu talebi 'sipariş verildi' olarak görür)

-- Yeni sipariş teslim alındığında
INSERT INTO order_deliveries (order_id, delivered_quantity) 
VALUES (new_order_id, 50);

-- Otomatik olarak:
-- 1. NEW order.delivered_quantity → 50
-- 2. NEW order.status → 'teslim alındı'
-- 3. purchase_requests.status → 'teslim alındı' veya 'kısmen teslim alındı'
--    (diğer order'ların durumuna göre belirlenir)
```

---

## 🧪 Test ve Kontrol

### Tutarlılık Kontrolü

```sql
-- İade durumlarının senkronizasyonunu kontrol et
SELECT 
  pr.id as talep_id,
  pr.status as talep_status,
  COUNT(o.id) as toplam_order,
  COUNT(o.id) FILTER (WHERE o.status IN ('iade var', 'kısmen teslim alındı ve iade var')) as iade_order_sayısı,
  CASE 
    WHEN COUNT(o.id) FILTER (WHERE o.status IN ('iade var', 'kısmen teslim alındı ve iade var')) > 0 
         AND pr.status != 'iade var' 
    THEN '⚠️ Senkronizasyon Hatası'
    WHEN COUNT(o.id) FILTER (WHERE o.status IN ('iade var', 'kısmen teslim alındı ve iade var')) = 0 
         AND pr.status = 'iade var'
    THEN '⚠️ Gereksiz İade Var Status'
    ELSE '✅ Tutarlı'
  END as durum
FROM purchase_requests pr
LEFT JOIN orders o ON o.purchase_request_id = pr.id
WHERE pr.status IN ('sipariş verildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var')
GROUP BY pr.id, pr.status
ORDER BY durum DESC;
```

### Status Dağılımı

```sql
-- Order status dağılımı
SELECT status, COUNT(*) FROM orders GROUP BY status;

-- Purchase Request status dağılımı
SELECT status, COUNT(*) FROM purchase_requests GROUP BY status;
```

---

## 🎉 Sonuç

### Başarılar

✅ **Otomatik Status Güncellemesi**: Artık manuel müdahale gerekmez  
✅ **İade Takibi**: Order ve request seviyesinde iade durumu otomatik izlenir  
✅ **Tutarlılık**: Trigger'lar sayesinde data tutarlılığı garanti edilir  
✅ **Kullanıcı Deneyimi**: Frontend'de doğru badge'ler ve renkler gösterilir  
✅ **Şeffaflık**: Detaylı dokümantasyon ve izleme sorguları mevcut  

### Özellikler

- 🔄 **Gerçek Zamanlı**: Değişiklikler anında yansır
- 🎯 **Hassas**: Doğru status hesaplamaları
- 🛡️ **Güvenli**: SECURITY DEFINER ile korumalı function'lar
- 📊 **İzlenebilir**: Detaylı kontrol sorguları
- 🧪 **Test Edilebilir**: Tutarlılık kontrol mekanizması

### Bakım

- Trigger'lar otomatik çalışır, bakım gerekmez
- Tutarlılık kontrol sorguları düzenli çalıştırılmalı
- Status dağılımları izlenmelidir

---

## 📚 İlgili Dosyalar

- `docs/ORDER_STATUS_AUTO_UPDATE.md` - Detaylı teknik dokümantasyon
- `sql/update_order_status_constraint_with_iade.sql` - Status constraint migration
- `sql/add_delivered_quantity_and_auto_status_update.sql` - Trigger'lar
- `sql/update_request_status_based_on_order_returns.sql` - Request status senkronizasyonu
- `src/components/offers/MaterialCard.tsx` - Frontend entegrasyonu

---

**Hazırlayan:** AI Assistant  
**Tarih:** 20 Ekim 2025  
**Versiyon:** 1.0

