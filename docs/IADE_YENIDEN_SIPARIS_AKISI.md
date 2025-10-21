# İade ve Yeniden Sipariş Akışı

**Tarih:** 20 Ekim 2025  
**Konu:** İade durumlarının yönetimi ve yeniden sipariş süreçleri

---

## 🎯 Genel Bakış

Sistemde malzeme iade durumları ve yeniden sipariş süreçleri tamamen otomatik olarak yönetilir. İade işlemi yapıldığında sistem otomatik olarak statusları günceller ve purchasing officer'a bildirir.

---

## 📊 İade Akışı

### 1. İade İşlemi Başlatılır

**Adım 1: Santiye Depo İade Kaydı Oluşturur**
```
ReturnModal açılır
  ↓
Kullanıcı iade miktarını ve notlarını girer
  ↓
Yeniden sipariş istiyor mu? (checkbox)
  ↓
İade kaydedilir
```

**Veritabanı İşlemleri:**
```sql
-- Order'a iade kaydedilir
UPDATE orders
SET 
  returned_quantity = X,
  return_notes = 'İade nedeni...',
  reorder_requested = true/false  -- Checkbox'a göre
WHERE id = order_id;
```

### 2. Otomatik Status Güncellemeleri

**Trigger Chain:**
```
UPDATE orders.returned_quantity
  ↓
trigger_update_order_status_on_quantities tetiklenir
  ↓
orders.status güncellenir
  - returned_quantity > 0 AND delivered_quantity > 0 
    → 'kısmen teslim alındı ve iade var'
  - returned_quantity > 0 
    → 'iade var'
  ↓
trigger_update_request_status_on_order_return tetiklenir
  ↓
purchase_requests.status güncellenir
  → 'iade var'
```

### 3. Purchasing Officer Bildirimi

**Tablo Görünümü:**
- Purchasing officer `PurchaseRequestsTable` açar
- "iade var" statusündeki talepler listede görünür
- Kırmızı/turuncu badge ile işaretlenmiş
- Bildirimler sütununda "İade Var" badge'i

---

## 🔄 Yeniden Sipariş Akışı

### Senaryo 1: Manuel Yeniden Sipariş

**Purchasing Officer Tarafından:**

1. Talep detayına gider (`/dashboard/requests/:id/offers`)
2. İade durumunu görür
3. "Yeniden Sipariş Ver" butonuna tıklar
4. Yeni order oluşturulur:
   ```sql
   INSERT INTO orders (
     purchase_request_id,
     material_item_id,
     supplier_id,
     quantity,
     is_return_reorder  -- ✅ true olarak işaretlenir
   ) VALUES (...);
   ```

5. **Otomatik Status Değişimi:**
   ```
   NEW order.is_return_reorder = true
     ↓
   trigger_update_request_status_on_order_return
     ↓
   purchase_requests.status = 'sipariş verildi'
     (Artık 'iade var' değil!)
   ```

6. Talebin statusu "sipariş verildi" olur
7. İade sorunu çözülmüş kabul edilir

### Senaryo 2: Otomatik Yeniden Sipariş Talebi

**İade sırasında "Yeniden Sipariş İste" seçilirse:**

1. İade kaydedilir:
   ```sql
   UPDATE orders
   SET 
     returned_quantity = X,
     reorder_requested = true  -- ✅ Otomatik sipariş talebi
   WHERE id = order_id;
   ```

2. Sistem bildirim kaydı oluşturur:
   ```sql
   -- purchase_requests.notifications array'ine eklenir
   notifications = ['iade var', 'yeniden sipariş oluşturuldu']
   ```

3. Purchasing officer tabloda hem "İade Var" hem "Yeniden Sipariş" badge'lerini görür

4. Manuel olarak yeni sipariş oluşturduğunda süreç yukarıdaki gibi devam eder

---

## 🎨 UI/UX Akışı

### ReturnModal (İade Modal)

**Görünüm:**
```
┌─────────────────────────────────────────┐
│  İade İşlemi                            │
├─────────────────────────────────────────┤
│  Sipariş Bilgileri:                     │
│  • Malzeme: Demir Çubuk                 │
│  • Toplam: 100 adet                     │
│  • Teslim Alınan: 80 adet               │
│  • Kalan: 20 adet                       │
│                                         │
│  İade Miktarı: [____] adet              │
│  (Max: 20 adet)                         │
│                                         │
│  İade Nedeni:                           │
│  [___________________________]          │
│                                         │
│  ☐ Yeniden Sipariş İste                │
│                                         │
│  [İptal]  [İade Et]                     │
└─────────────────────────────────────────┘
```

### MaterialCard (İade Sonrası)

**Tedarikçi Kartı:**
```
┌─────────────────────────────────────────┐
│  ABC Tedarikçi          [İade Var]      │
├─────────────────────────────────────────┤
│  Sipariş Miktarı: 100 adet              │
│  Teslim Alınan: 80 adet                 │
│  İade Edilen: 20 adet    ⚠️             │
│  Kalan: 0 adet                          │
│                                         │
│  İade Notu: Hatalı ürün                 │
│                                         │
│  Siparişler:                            │
│  • 100 adet sipariş                     │
│    Teslim: 80 adet                      │
│    İade: 20 adet                        │
│    [Teslim Al] [İade]                   │
└─────────────────────────────────────────┘
```

**Yeniden Sipariş Sonrası:**
```
┌─────────────────────────────────────────┐
│  ABC Tedarikçi      [Sipariş Verildi]  │
├─────────────────────────────────────────┤
│  Sipariş Miktarı: 120 adet              │
│  Teslim Alınan: 80 adet                 │
│  Kalan: 40 adet                         │
│                                         │
│  Siparişler:                            │
│  • 100 adet sipariş (tamamlandı)        │
│    ✅ Tamamlandı                        │
│                                         │
│  • 20 adet sipariş (yeniden) 🔄         │
│    [İade nedeniyle yeniden sipariş]     │
│    [Teslim Al]                          │
└─────────────────────────────────────────┘
```

---

## 🔍 Status Takibi

### Order Status Değerleri

| Status | Açıklama | Renk |
|--------|----------|------|
| `sipariş verildi` | Yeni sipariş | 🔵 Mavi |
| `kısmen teslim alındı` | Kısmi teslimat | 🟠 Turuncu |
| `teslim alındı` | Tam teslimat | 🟢 Yeşil |
| `iade var` | İade edilmiş | 🔴 Kırmızı |
| `kısmen teslim alındı ve iade var` | Hem teslimat hem iade | 🟠 Turuncu (border) |

### Purchase Request Status Değerleri

| Status | Ne Zaman? | Görünüm |
|--------|-----------|---------|
| `iade var` | Herhangi bir order'da iade var | 🔴 İade Var |
| `sipariş verildi` | is_return_reorder=true order var | 🔵 Sipariş Verildi |
| `kısmen teslim alındı` | Bazı order'lar teslim alındı | 🟠 Kısmen |
| `teslim alındı` | Tüm order'lar teslim alındı | 🟢 Tamamlandı |

---

## 📝 Örnek Senaryo (Tam Akış)

### Durum 1: Normal Teslimat
```
1. Order oluşturulur (100 adet)
   → orders.status = 'sipariş verildi'
   → purchase_requests.status = 'sipariş verildi'

2. Teslimat yapılır (100 adet)
   → orders.delivered_quantity = 100
   → orders.status = 'teslim alındı'
   → purchase_requests.status = 'teslim alındı'
```

### Durum 2: İade Durumu
```
3. Sorun tespit edilir, iade yapılır (20 adet)
   → orders.returned_quantity = 20
   → orders.status = 'kısmen teslim alındı ve iade var'
   → purchase_requests.status = 'iade var'
   
4. Purchasing officer bildirim görür
   - Tabloda "İade Var" badge'i
   - Talep detayında iade bilgisi
```

### Durum 3: Yeniden Sipariş
```
5. Purchasing officer yeni sipariş oluşturur (20 adet)
   → NEW order.is_return_reorder = true
   → NEW order.status = 'sipariş verildi'
   → purchase_requests.status = 'sipariş verildi' (iade çözüldü!)

6. Yeni sipariş teslim alınır (20 adet)
   → NEW order.delivered_quantity = 20
   → NEW order.status = 'teslim alındı'
   → purchase_requests.status = 'teslim alındı'
   
7. Süreç tamamlanır
   - Eski order: 80 adet teslim alındı (20 iade)
   - Yeni order: 20 adet teslim alındı
   - Toplam: 100 adet başarılı teslimat
```

---

## 🛠️ Teknik Detaylar

### Database Trigger'lar

1. **`trigger_update_order_status_on_quantities`**
   - `orders.returned_quantity` değiştiğinde çalışır
   - Order status'unu hesaplar

2. **`trigger_update_request_status_on_order_return`**
   - `orders.status` veya `orders.is_return_reorder` değiştiğinde çalışır
   - Purchase request status'unu günceller
   - **ÖNEMLİ:** `is_return_reorder=true` varsa, status'u 'sipariş verildi' yapar

### Önemli Sütunlar

**orders tablosu:**
- `returned_quantity`: İade edilen miktar
- `return_notes`: İade nedeni/notları
- `reorder_requested`: Yeniden sipariş talep edildi mi?
- `is_return_reorder`: Bu order bir yeniden sipariş mi?
- `delivered_quantity`: Teslim alınan toplam miktar (otomatik hesaplanır)

**purchase_requests tablosu:**
- `notifications`: Bildirim array'i (`['iade var', 'yeniden sipariş oluşturuldu']`)

---

## ✅ Kontrol Listeleri

### İade İşlemi Kontrolü
- [ ] İade miktarı doğru mu?
- [ ] İade nedeni girilmiş mi?
- [ ] Yeniden sipariş gerekli mi?
- [ ] Order status'u 'iade var' oldu mu?
- [ ] Request status'u 'iade var' oldu mu?
- [ ] Purchasing officer bildirim gördü mü?

### Yeniden Sipariş Kontrolü
- [ ] is_return_reorder = true olarak işaretlendi mi?
- [ ] Request status'u 'sipariş verildi' oldu mu?
- [ ] MaterialCard'da mor badge görünüyor mu?
- [ ] Yeni sipariş bilgileri doğru mu?

---

## 📚 İlgili Dosyalar

- `src/components/ReturnModal.tsx` - İade modal'ı
- `src/components/offers/MaterialCard.tsx` - Malzeme kartı ve sipariş görünümü
- `src/components/offers/ReturnedMaterialsCard.tsx` - İade edilmiş malzemeler
- `src/components/PurchaseRequestsTable.tsx` - Talep listesi
- `docs/ORDER_STATUS_AUTO_UPDATE.md` - Teknik dokümantasyon
- `docs/IADE_STATUS_DOKUMANTATYONU.md` - İade status dokümantasyonu

---

**Güncelleme:** 20 Ekim 2025  
**Versiyon:** 2.0 - Yeniden sipariş akışı eklendi

