# Yeniden Sipariş Akışı ve Supabase İşlemleri

## 📋 Genel Bakış

`ReturnedMaterialsCard` bileşeninde **"Yeniden Sipariş"** butonuna basıldığında sistemde gerçekleşen tüm Supabase işlemleri bu dokümanda açıklanmıştır.

---

## 🔄 İşlem Akışı

### 1️⃣ Kullanıcı "Yeniden Sipariş" Butonuna Basar

**Konum:** `ReturnedMaterialsCard.tsx` (satır 637-650)

```typescript
<Button
  onClick={() => onReorder(item, totalReturnedForSupplier - reorderedQuantity, {
    supplier_id: supplierGroup.orders[0]?.supplier_id,
    supplier_name: supplierGroup.supplierName,
    contact_person: supplierGroup.orders[0]?.supplier?.contact_person,
    phone: supplierGroup.orders[0]?.supplier?.phone,
    email: supplierGroup.orders[0]?.supplier?.email
  })}
>
  Yeniden Sipariş
</Button>
```

**Parametreler:**
- `item`: İade edilen malzeme bilgileri
- `totalReturnedForSupplier - reorderedQuantity`: Henüz yeniden sipariş verilmemiş miktar
- `supplierInfo`: Tedarikçi bilgileri

---

### 2️⃣ onReorder Fonksiyonu Çalışır

**Konum:** `ProcurementView.tsx` (satır 557-650)

#### A) Önce Kontroller Yapılır

```typescript
// 1. Bu tedarikçi için yeniden sipariş istenip istenmediği kontrol edilir
const reorderNotRequested = supplierOrders.some((order: any) => 
  order.reorder_requested === false
)

if (reorderNotRequested) {
  showToast('Bu tedarikçi için yeniden sipariş istenmediği belirtilmiş.', 'info')
  return // İşlem durur
}
```

#### B) Sipariş Modalı Açılır

```typescript
setCurrentMaterialForAssignment({
  id: item.id,
  name: item.item_name,
  unit: item.unit,
  isReturnReorder: true, // ⚠️ ÖNEMLİ: İade yeniden siparişi flag'i
  supplierSpecific: true,
  targetSupplierId: supplierInfo.supplier_id
})

setOrderDetails({
  deliveryDate: '',
  amount: '',
  currency: 'TRY',
  quantity: returnedQuantity.toString(), // İade miktarı otomatik doldurulur
  documents: [],
  documentPreviewUrls: []
})

setIsCreateOrderModalOpen(true) // Modal açılır
```

---

### 3️⃣ Kullanıcı Sipariş Detaylarını Doldurur

**Modal İçeriği:**
- ✅ Sipariş Miktarı (otomatik doldurulur, değiştirilebilir)
- ✅ Teslimat Tarihi
- ✅ Birim Fiyat (opsiyonel)
- ✅ Para Birimi (TRY/USD/EUR)
- ✅ Dökümanlar (opsiyonel)

**Maksimum Miktar Kontrolü:**
```typescript
// İade edilen toplam miktar - Zaten yeniden sipariş verilen miktar
const maxQuantity = totalReturnedForSupplier - alreadyReordered

if (orderQuantity > maxQuantity) {
  showToast(`Sipariş miktarı iade edilen miktarı (${maxQuantity}) aşamaz.`, 'error')
  return
}
```

---

### 4️⃣ "Sipariş Oluştur" Butonuna Basılır

**Konum:** `ProcurementView.tsx` (satır 2295-2350)

#### 🗄️ Supabase İşlemleri Başlar

##### A) **Orders Tablosuna Yeni Kayıt Eklenir**

```typescript
const orderData = {
  purchase_request_id: request.id,           // İlgili talep ID'si
  supplier_id: selectedSupplier.id,          // Tedarikçi ID'si
  delivery_date: orderDetails.deliveryDate,  // Teslimat tarihi
  amount: orderDetails.amount || 0,          // Tutar
  currency: orderDetails.currency,           // Para birimi
  document_urls: uploadedUrls,               // Dökümanlar
  user_id: session.user.id,                  // Sipariş veren kullanıcı
  material_item_id: currentMaterialForAssignment?.id, // Malzeme ID'si
  quantity: orderQuantity,                   // Sipariş miktarı
  is_return_reorder: true                    // ⚠️ ÖNEMLİ: İade yeniden siparişi FLAG
}

const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert(orderData)
  .select()
  .single()
```

**Yeni Sipariş Kaydının Özellikleri:**
- ✅ `is_return_reorder = true` → Bu siparişin bir iade yeniden siparişi olduğunu belirtir
- ✅ `quantity` → Yeniden sipariş verilen miktar
- ✅ `supplier_id` → Aynı tedarikçiden sipariş
- ✅ `material_item_id` → İade edilen malzeme
- ✅ `status = 'pending'` (default)
- ✅ `returned_quantity = 0` (yeni sipariş henüz iade edilmedi)
- ✅ `delivered_quantity = 0` (henüz teslim alınmadı)

---

### 5️⃣ Audit Log Kaydı Oluşturulur

```typescript
await supabase
  .from('audit_log')
  .insert({
    purchase_request_id: request.id,
    action_type: 'order_created',
    performed_by: session.user.id,
    user_role: 'purchasing_officer',
    description: `${currentMaterialForAssignment.name} malzemesi için ${selectedSupplier.name} tedarikçisinden ${orderQuantity} ${currentMaterialForAssignment.unit} yeniden sipariş verildi (İade Yeniden Siparişi)`,
    metadata: {
      order_id: order.id,
      supplier_id: selectedSupplier.id,
      supplier_name: selectedSupplier.name,
      material_name: currentMaterialForAssignment.name,
      quantity: orderQuantity,
      is_return_reorder: true // ⚠️ Metadata'da da belirtilir
    }
  })
```

---

### 6️⃣ Purchase Request Status Otomatik Güncellenir! 🎉

**YENİ:** Yeni sipariş oluşturulduğunda `purchase_requests` tablosunun statusu **OTOMATIK OLARAK GÜNCELLENİR**.

Status güncellemesi şu durumlarda olur:
- ✅ `orders` tablosunda `returned_quantity` değiştiğinde
- ✅ `orders` tablosunda `is_return_reorder = true` sipariş eklendiğinde
- ✅ `smart_update_return_status` trigger'ı çalışır

**Yeniden sipariş verildikten sonra status:**
- ✅ Eğer **tüm iade miktarı** için yeniden sipariş verildiyse → Status = **"sipariş verildi"** 🎯
- ✅ Eğer **kısmi** yeniden sipariş verildiyse → Status = **"iade var"** (kalır)
- ✅ Trigger otomatik olarak `total_returned` ve `total_reordered` miktarlarını karşılaştırır

---

## 📊 Veritabanı Değişiklikleri Özeti

### ➕ Yeni Kayıt (INSERT)

#### `orders` Tablosu
```sql
INSERT INTO orders (
  purchase_request_id,
  supplier_id,
  material_item_id,
  quantity,
  delivery_date,
  amount,
  currency,
  user_id,
  is_return_reorder,  -- ⚠️ true
  status,             -- 'pending'
  returned_quantity,  -- 0
  delivered_quantity, -- 0
  created_at,
  updated_at
) VALUES (...)
```

#### `audit_log` Tablosu
```sql
INSERT INTO audit_log (
  purchase_request_id,
  action_type,        -- 'order_created'
  performed_by,
  user_role,          -- 'purchasing_officer'
  description,
  metadata            -- {is_return_reorder: true, ...}
) VALUES (...)
```

### 🔄 Otomatik Güncellenen Tablolar

- ✅ `purchase_requests` → Status **OTOMATİK güncellenir!**
  - Tüm iadeler yeniden sipariş edildiyse: "sipariş verildi"
  - Kısmi yeniden sipariş: "iade var" kalır

### ⚠️ Değişiklik OLMAYAN Tablolar

- ❌ `purchase_request_items` → Miktar değişmez
- ❌ Eski `orders` kayıtları → Hiçbir şey değişmez

---

## 🔍 Örnek Senaryo

### Başlangıç Durumu

**purchase_requests** (id: 123)
```
status: "iade var"
```

**orders** (İlk sipariş)
```
id: 456
purchase_request_id: 123
material_item_id: 789
supplier_id: 111
quantity: 100 kg
returned_quantity: 20 kg  ← İade edildi
reorder_requested: true
is_return_reorder: false
```

### Yeniden Sipariş Verildikten Sonra

**orders** (Yeni sipariş)
```
id: 457 (YENİ)
purchase_request_id: 123
material_item_id: 789
supplier_id: 111
quantity: 20 kg          ← İade miktarı kadar
returned_quantity: 0     ← Henüz iade yok
is_return_reorder: true  ← ⚠️ İade yeniden siparişi
status: 'pending'
```

**purchase_requests**
```
status: "sipariş verildi"  ← ✅ OTOMATİK GÜNCELLENDİ!
(Çünkü total_reordered (20) >= total_returned (20))
```

---

## 📈 Status Geçiş Akışı

```
1. Normal Sipariş
   └─> quantity: 100 kg
   └─> status: 'pending'

2. Malzeme İade Edildi
   └─> returned_quantity: 20 kg
   └─> purchase_request.status → "iade var" (trigger)

3. Yeniden Sipariş Verildi (Tam Miktar)
   └─> YENİ order oluşturulur
   └─> is_return_reorder: true
   └─> quantity: 20 kg
   └─> Trigger otomatik çalışır
   └─> total_reordered (20) >= total_returned (20)
   └─> purchase_request.status → ✅ "sipariş verildi" (OTOMATİK)

4. Yeni Sipariş Teslim Alındı
   └─> YENİ order.delivered_quantity: 20 kg
   └─> YENİ order.status: 'delivered'
   └─> purchase_request.status → "sipariş verildi" (değişmez)

5. Alternatif: Kısmi Yeniden Sipariş (örn. 10 kg)
   └─> total_reordered (10) < total_returned (20)
   └─> purchase_request.status → "iade var" (kalır)
```

---

## 🔐 Güvenlik ve İzinler

### Gerekli RLS Politikaları

1. **orders tablosu:**
   - ✅ `purchasing_officer` rolü INSERT yapabilmeli
   - ✅ `is_return_reorder` field'ını set edebilmeli

2. **audit_log tablosu:**
   - ✅ Tüm roller INSERT yapabilmeli

3. **purchase_requests tablosu:**
   - ✅ SELECT izni (status kontrolü için)

---

## 🎯 Önemli Noktalar

1. **`is_return_reorder` Field'ı**
   - ✅ Yeniden sipariş olan kayıtları ayırt etmek için kullanılır
   - ✅ Raporlama ve filtreleme için kritiktir
   - ✅ UI'da farklı gösterim yapılabilir

2. **Status Güncellemesi**
   - ✅ Yeniden sipariş vermek status'u değiştirmez
   - ✅ Status güncellemesi sadece `returned_quantity` değiştiğinde olur
   - ✅ Trigger otomatik çalışır

3. **Miktar Kontrolü**
   - ✅ Maksimum sipariş miktarı = iade miktarı - zaten yeniden sipariş verilen
   - ✅ Frontend'de kontrol edilir
   - ✅ Backend validasyon önerilir

4. **Tedarikçi Kontrolü**
   - ✅ `reorder_requested = false` ise yeniden sipariş verilmez
   - ✅ Kullanıcıya bilgi mesajı gösterilir

---

## 🗂️ İlgili Dosyalar

### Frontend
- `/src/components/offers/ReturnedMaterialsCard.tsx` - Yeniden sipariş butonu
- `/src/components/offers/ProcurementView.tsx` - onReorder implementasyonu
- `/src/components/ReturnModal.tsx` - İade işlemi

### Backend (Database)
- `/sql/add_is_return_reorder_to_orders.sql` - Field ekleme migration
- `/sql/simple_return_status_update.sql` - Status trigger

### Dokümantasyon
- `/docs/IADE_STATUS_DOKUMANTATYONU.md` - Status kuralları
- `/docs/YENIDEN_SIPARIS_AKISI.md` - Bu dokümantasyon

---

**Son Güncelleme:** 2025-10-19  
**Versiyon:** 1.0

