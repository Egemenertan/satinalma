import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island/islandTokens'
import { stats } from '../../../src/theme/statsDesignTokens'

const CONTACT_EMAIL = 'info@dovecconstruction.com'
const WEB_TERMS_URL = 'https://dovec.app/termsOfService'

export default function TermsOfServiceScreen() {
  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`)
  }

  const openWebVersion = () => {
    Linking.openURL(WEB_TERMS_URL)
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: ISLAND_BOTTOM_BAR_CONTENT_INSET + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Kullanım Koşulları</Text>
      <Text style={styles.updated}>Son güncelleme: 04.06.2026</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>1. Kabul ve Onay</Text>
        <Text style={styles.body}>
          DLX Satın Alma mobil uygulamasını ("Uygulama") indirerek, kurarak veya kullanarak bu Kullanım Koşullarını ("Koşullar") kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız uygulamayı kullanmamalısınız.{'\n\n'}
          Bu Koşullar, Dovec Group ("Şirket", "biz") ile uygulama kullanıcısı ("Kullanıcı", "siz") arasında yasal olarak bağlayıcı bir sözleşme oluşturur.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>2. Hizmet Tanımı</Text>
        <Text style={styles.body}>
          Bu uygulama, Dovec Group ve bağlı şirketleri bünyesinde çalışan yetkili personelin kullanımına yönelik kurumsal bir satın alma yönetim sistemidir. Uygulama aşağıdaki işlevleri sağlar:{'\n\n'}
          • Satın alma taleplerinin oluşturulması{'\n'}
          • Onay iş akışlarının yönetimi{'\n'}
          • Talep durumlarının takibi{'\n'}
          • Bildirim ve uyarı sistemi{'\n'}
          • Zimmet ve envanter takibi
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>3. Erişim ve Hesap</Text>
        <Text style={styles.body}>
          • Uygulama yalnızca şirket tarafından yetkilendirilen çalışanlar tarafından kullanılabilir{'\n'}
          • Hesap bilgileriniz (kullanıcı adı, şifre) gizli tutulmalıdır{'\n'}
          • Hesabınız üzerinden gerçekleştirilen tüm işlemlerden siz sorumlusunuz{'\n'}
          • Yetkisiz erişim şüphesi durumunda derhal IT departmanını bilgilendirmelisiniz{'\n'}
          • Şirket, herhangi bir zamanda herhangi bir nedenle hesap erişimini askıya alma veya sonlandırma hakkını saklı tutar
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>4. Kullanıcı Yükümlülükleri</Text>
        <Text style={styles.body}>
          Uygulamayı kullanırken aşağıdaki yükümlülükleri kabul edersiniz:{'\n\n'}
          • Uygulamayı yalnızca yasal ve iş amaçlı kullanmak{'\n'}
          • Doğru, güncel ve eksiksiz bilgiler sağlamak{'\n'}
          • Şirket politikalarına ve prosedürlerine uygun davranmak{'\n'}
          • Diğer kullanıcıların haklarına saygı göstermek{'\n'}
          • Uygulamayı kötüye kullanmamak veya manipüle etmemek{'\n'}
          • Güvenlik açıklarını istismar etmemek{'\n'}
          • Yetkisiz erişim girişimlerinde bulunmamak
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>5. Fikri Mülkiyet Hakları</Text>
        <Text style={styles.body}>
          Uygulama ve tüm içeriği (yazılım, tasarım, logolar, metinler, grafikler) Dovec Group'un mülkiyetindedir ve telif hakkı, marka hakkı ve diğer fikri mülkiyet yasaları ile korunmaktadır.{'\n\n'}
          Kullanıcıya uygulamayı kullanmak için sınırlı, geri alınabilir, münhasır olmayan bir lisans verilmektedir. Bu lisans:{'\n\n'}
          • Devredilemez{'\n'}
          • Alt lisans verilemez{'\n'}
          • Yalnızca iş amaçlı kullanım için geçerlidir
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>6. Yasaklanan Faaliyetler</Text>
        <Text style={styles.body}>
          Aşağıdaki faaliyetler kesinlikle yasaktır:{'\n\n'}
          • Uygulamayı tersine mühendislik, kaynak koda dönüştürme veya ayrıştırma{'\n'}
          • Uygulamanın herhangi bir bölümünü kopyalama veya çoğaltma{'\n'}
          • Otomatik veri toplama araçları (bot, spider vb.) kullanma{'\n'}
          • Zararlı yazılım veya kod yükleme{'\n'}
          • Diğer kullanıcıların verilerine yetkisiz erişim{'\n'}
          • Sahte veya yanıltıcı bilgi girişi
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>7. Hesap Sonlandırma</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>Şirket tarafından sonlandırma:</Text>{'\n'}
          • İş akdinin sona ermesi durumunda hesap otomatik olarak devre dışı bırakılır{'\n'}
          • Koşulların ihlali durumunda hesap derhal askıya alınabilir{'\n'}
          • Güvenlik ihlali şüphesinde hesap geçici olarak kilitlenebilir{'\n\n'}
          <Text style={styles.bold}>Kullanıcı tarafından sonlandırma:</Text>{'\n'}
          • Ayarlar menüsünden "Profili tamamen kaldır" seçeneğiyle hesabınızı silebilirsiniz{'\n'}
          • Hesap silme işlemi 30 gün içinde geri alınamaz şekilde tamamlanır{'\n'}
          • Yasal gereklilikler gereği bazı veriler anonimleştirilerek saklanabilir
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>8. Sorumluluk Sınırlaması</Text>
        <Text style={styles.body}>
          Uygulama "olduğu gibi" ve "mevcut haliyle" sunulmaktadır. Şirket, yasaların izin verdiği azami ölçüde:{'\n\n'}
          • Uygulamanın kesintisiz veya hatasız çalışacağını garanti etmez{'\n'}
          • Teknik aksaklıklardan kaynaklanan zararlardan sorumlu tutulamaz{'\n'}
          • Veri kaybından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz{'\n'}
          • Üçüncü taraf hizmetlerinin kesintilerinden sorumlu tutulamaz{'\n\n'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>9. Tazminat</Text>
        <Text style={styles.body}>
          Kullanıcı, bu Koşulların ihlalinden veya uygulamanın kötüye kullanımından kaynaklanan tüm talep, zarar, kayıp ve masraflara karşı şirketi, yöneticilerini ve çalışanlarını tazmin etmeyi kabul eder.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>10. Değişiklikler</Text>
        <Text style={styles.body}>
          Şirket, bu Kullanım Koşullarını herhangi bir zamanda değiştirme hakkını saklı tutar. Önemli değişiklikler yapıldığında:{'\n\n'}
          • Uygulama içi bildirim gönderilecektir{'\n'}
          • Değişiklik tarihi bu sayfada güncellenecektir{'\n'}
          • Değişikliklerden sonra uygulamayı kullanmaya devam etmeniz, yeni koşulları kabul ettiğiniz anlamına gelir
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>11. Uygulanacak Hukuk</Text>
        <Text style={styles.body}>
          Bu Koşullar, Kuzey Kıbrıs Türk Cumhuriyeti yasalarına tabidir. Uyuşmazlıkların çözümünde Lefkoşa Mahkemeleri yetkilidir.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>12. Bölünebilirlik</Text>
        <Text style={styles.body}>
          Bu Koşulların herhangi bir hükmünün geçersiz veya uygulanamaz bulunması, diğer hükümlerin geçerliliğini etkilemeyecektir.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>13. İletişim</Text>
        <Text style={styles.body}>
          Kullanım koşulları hakkında sorularınız için bizimle iletişime geçebilirsiniz:{'\n\n'}
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
