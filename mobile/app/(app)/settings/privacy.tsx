import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island/islandTokens'
import { stats } from '../../../src/theme/statsDesignTokens'

const CONTACT_EMAIL = 'info@dovecconstruction.com'
const WEB_PRIVACY_URL = 'https://dovec.app/privacy-policy'

export default function PrivacyPolicyScreen() {
  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`)
  }

  const openWebVersion = () => {
    Linking.openURL(WEB_PRIVACY_URL)
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: ISLAND_BOTTOM_BAR_CONTENT_INSET + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Gizlilik Politikası</Text>
      <Text style={styles.updated}>Son güncelleme: 04.06.2026</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>1. Giriş</Text>
        <Text style={styles.body}>
          Dovec Group ("Şirket", "biz") olarak, DLX Satın Alma mobil uygulaması ("Uygulama") üzerinden kişisel verilerinizin gizliliğine büyük önem veriyoruz. Bu Gizlilik Politikası, hangi verileri topladığımızı, nasıl kullandığımızı, sakladığımızı ve koruduğumuzu açıklamaktadır.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>2. Toplanan Veriler</Text>
        <Text style={styles.body}>
          Uygulamamız aşağıdaki kişisel verileri toplamaktadır:{'\n\n'}
          <Text style={styles.bold}>Hesap Bilgileri:</Text>{'\n'}
          • Ad ve soyad{'\n'}
          • Kurumsal e-posta adresi{'\n'}
          • Departman ve rol bilgileri{'\n'}
          • Şirket içi site/lokasyon atamaları{'\n\n'}
          <Text style={styles.bold}>Kullanım Verileri:</Text>{'\n'}
          • Satın alma talepleri ve onay geçmişi{'\n'}
          • Uygulama içi aktiviteler{'\n'}
          • Cihaz bilgileri (model, işletim sistemi){'\n'}
          • IP adresi ve oturum bilgileri{'\n\n'}
          <Text style={styles.bold}>Medya:</Text>{'\n'}
          • Taleplere eklenen fotoğraflar{'\n'}
          • İrsaliye ve belge görüntüleri
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>3. Verilerin Kullanım Amaçları</Text>
        <Text style={styles.body}>
          Toplanan veriler yalnızca aşağıdaki amaçlarla kullanılmaktadır:{'\n\n'}
          • Satın alma taleplerinin oluşturulması, işlenmesi ve takibi{'\n'}
          • Onay iş akışlarının yönetimi{'\n'}
          • Push bildirimleri ve uygulama içi bildirimler gönderimi{'\n'}
          • Kullanıcı kimlik doğrulama ve yetkilendirme{'\n'}
          • Uygulama performansının izlenmesi ve iyileştirilmesi{'\n'}
          • Yasal yükümlülüklerin yerine getirilmesi
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>4. Veri Saklama Süresi</Text>
        <Text style={styles.body}>
          • Hesap verileri: Hesabınız aktif olduğu sürece saklanır{'\n'}
          • Satın alma talepleri: Yasal gereklilikler gereği 10 yıl saklanır{'\n'}
          • Oturum logları: 1 yıl saklanır{'\n'}
          • Silinen hesaplar: Hesap silme talebinden sonra 30 gün içinde tüm kişisel veriler kalıcı olarak silinir
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>5. Veri Güvenliği</Text>
        <Text style={styles.body}>
          Verilerinizi korumak için endüstri standardı güvenlik önlemleri uygulanmaktadır:{'\n\n'}
          • TLS 1.3 şifreleme ile veri iletimi{'\n'}
          • AES-256 şifreleme ile veri depolama{'\n'}
          • ISO 27001 sertifikalı veri merkezleri{'\n'}
          • Düzenli güvenlik denetimleri ve penetrasyon testleri{'\n'}
          • Rol tabanlı erişim kontrolleri{'\n'}
          • Detaylı aktivite loglaması
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>6. Kullanıcı Hakları</Text>
        <Text style={styles.body}>
          6698 sayılı KVKK ve GDPR kapsamında aşağıdaki haklara sahipsiniz:{'\n\n'}
          • <Text style={styles.bold}>Erişim hakkı:</Text> Verilerinizin bir kopyasını talep edebilirsiniz{'\n'}
          • <Text style={styles.bold}>Düzeltme hakkı:</Text> Yanlış veya eksik verilerin düzeltilmesini isteyebilirsiniz{'\n'}
          • <Text style={styles.bold}>Silme hakkı:</Text> Hesabınızı silebilirsiniz (yasal saklama yükümlülükleri saklıdır){'\n'}
          • <Text style={styles.bold}>İtiraz hakkı:</Text> Veri işlemeye itiraz edebilirsiniz{'\n'}
          • <Text style={styles.bold}>Taşınabilirlik hakkı:</Text> Verilerinizi yapılandırılmış formatta alabilirsiniz{'\n\n'}
          Hesap silme işlemi için Ayarlar {'>'} "Profili tamamen kaldır" seçeneğini kullanabilirsiniz.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>7. Bildirim İzinleri</Text>
        <Text style={styles.body}>
          Uygulama, talep durumu güncellemeleri ve onay bildirimleri için push notification izni talep etmektedir. Bu izni istediğiniz zaman cihaz ayarlarından iptal edebilirsiniz. Bildirim izni verilmese de uygulama tam işlevsellikle çalışmaya devam eder.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>8. Çocukların Gizliliği</Text>
        <Text style={styles.body}>
          Bu uygulama kurumsal kullanım için tasarlanmıştır ve 18 yaşın altındaki bireylere yönelik değildir. 18 yaşın altındaki kullanıcılardan bilerek veri toplamıyoruz. Böyle bir durum tespit edilirse, ilgili veriler derhal silinecektir.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>9. Politika Değişiklikleri</Text>
        <Text style={styles.body}>
          Bu gizlilik politikası zaman zaman güncellenebilir. Önemli değişiklikler yapıldığında uygulama içi bildirim ile kullanıcılar bilgilendirilecektir. Güncel politika her zaman uygulama içinden erişilebilir durumdadır.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>10. İletişim</Text>
        <Text style={styles.body}>
          Gizlilik politikası veya kişisel verileriniz hakkında sorularınız için bizimle iletişime geçebilirsiniz:{'\n\n'}
          <Text style={styles.bold}>Dovec Group</Text>{'\n'}
          E-posta: {CONTACT_EMAIL}
        </Text>
        <Pressable style={styles.emailBtn} onPress={openEmail}>
          <Text style={styles.emailBtnText}>E-posta Gönder</Text>
        </Pressable>
        <Pressable style={styles.webBtn} onPress={openWebVersion}>
          <Text style={styles.webBtnText}>Web'de Görüntüle</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: stats.background },
  content: { paddingHorizontal: stats.gutter, paddingTop: 16 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: stats.onSurface,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  updated: {
    fontSize: 13,
    color: stats.onSurfaceVariant,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: stats.onSurface,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: stats.onSurfaceVariant,
  },
  bold: {
    fontWeight: '600',
    color: stats.onSurface,
  },
  emailBtn: {
    marginTop: 16,
    backgroundColor: stats.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emailBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  webBtn: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: stats.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  webBtnText: {
    color: stats.primary,
    fontSize: 15,
    fontWeight: '600',
  },
})
