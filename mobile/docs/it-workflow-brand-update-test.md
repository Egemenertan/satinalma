# IT Workflow Marka Güncelleme Test Senaryosu

## 🎯 Test Amacı
IT Yönetim tab'ındaki düzenle butonu ile marka güncellemesi yaptıktan sonra, detay sayfasında güncel marka bilgisinin görüntülenmesi.

## 🔧 Uygulanan Çözüm
- **Optimistic Update**: UI hemen güncellenir
- **Cache Invalidation**: React Query cache'i force invalidate edilir
- **Error Handling**: Hata durumunda cache geri alınır

## 📱 Test Adımları

### ✅ Hazırlık
1. Mobile uygulamayı aç
2. IT yönetim yetkisi olan kullanıcı ile giriş yap (department_head + pazarlama)
3. Satın alma talepleri sayfasına git
4. IT Yönetim tab'ına geç

### 🧪 Test Senaryosu 1: Marka Ekleme
1. `it_workflow_applies: true` olan bir talebi seç
2. Talep detayına gir
3. Mevcut marka bilgisini kontrol et (boş olabilir)
4. **Düzenle** butonuna bas
5. Marka alanına test değeri gir (örn: "Siemens Test")
6. **Kaydet** butonuna bas
7. ✅ **Beklenen**: Modal kapanır, "Kalemler güncellendi" mesajı gösterilir
8. ✅ **Kontrol**: Detay sayfasında marka bilgisi hemen güncellenir

### 🧪 Test Senaryosu 2: Marka Güncelleme
1. Zaten marka bilgisi olan bir kalem seç
2. **Düzenle** butonuna bas
3. Marka alanını değiştir (örn: "Schneider Update")
4. **Kaydet** butonuna bas
5. ✅ **Kontrol**: Detay sayfasında yeni marka bilgisi görüntülenir

### 🧪 Test Senaryosu 3: Marka Silme
1. Marka bilgisi olan bir kalem seç
2. **Düzenle** butonuna bas
3. Marka alanını temizle (boş bırak)
4. **Kaydet** butonuna bas
5. ✅ **Kontrol**: Detay sayfasında "Belirtilmemiş" gösterilir

### 🧪 Test Senaryosu 4: Hata Durumu
1. Network bağlantısını kes
2. **Düzenle** → marka değiştir → **Kaydet**
3. ✅ **Beklenen**: Hata mesajı gösterilir, cache geri alınır

## 🔍 Kontrol Noktaları

### UI Seviyesi
- [ ] Düzenleme modalında marka preview'ı güncellenir
- [ ] Detay sayfasında "Marka" satırı doğru değeri gösterir
- [ ] Loading durumları çalışır
- [ ] Hata mesajları gösterilir

### Backend Seviyesi
```sql
-- Supabase'de kontrol
SELECT id, item_name, brand, updated_at 
FROM purchase_request_items 
WHERE id = 'TEST_ITEM_ID';
```

### Cache Seviyesi
- [ ] Optimistic update hemen çalışır
- [ ] Network başarılı olduğunda cache invalidate olur
- [ ] Hata durumunda cache geri alınır

## 🐛 Bilinen Sorunlar (Çözülmüş)
- ✅ **Cache Timing**: React Query cache'i hemen invalidate olmuyordu
- ✅ **Optimistic Update Eksikti**: UI anında güncellenmiyordu
- ✅ **Error Handling**: Hata durumunda cache geri alınmıyordu

## 📊 Kod Değişiklikleri
`mobile/src/components/requestDetail/itWorkflow/useItWorkflowActionsRn.ts`:
- ✅ `useQueryClient` import edildi
- ✅ `handleSaveEdits` optimistic update eklendi
- ✅ Force cache invalidation eklendi
- ✅ Error handling geliştirildi

---

**Test Tarihi**: 2026-05-16
**Test Eden**: AI Assistant
**Durum**: ✅ Hazır