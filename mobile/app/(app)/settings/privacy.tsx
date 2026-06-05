import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island/islandTokens'
import { stats } from '../../../src/theme/statsDesignTokens'

const CONTACT_EMAIL = 'info@dovecconstruction.com'
const WEB_PRIVACY_URL = 'https://dovec.app/privacy-policy'

const content = {
  tr: {
    title: 'Gizlilik Politikası',
    updated: 'Son güncelleme: 04.06.2026',
    sendEmail: 'E-posta Gönder',
    viewOnWeb: "Web'de Görüntüle",
    sections: [
      {
        title: '1. Giriş',
        body: 'Dovec Group ("Şirket", "biz") olarak, DLX Satın Alma mobil uygulaması ("Uygulama") üzerinden kişisel verilerinizin gizliliğine büyük önem veriyoruz. Bu Gizlilik Politikası, hangi verileri topladığımızı, nasıl kullandığımızı, sakladığımızı ve koruduğumuzu açıklamaktadır.',
      },
      {
        title: '2. Toplanan Veriler',
        body: `Uygulamamız aşağıdaki kişisel verileri toplamaktadır:

Hesap Bilgileri:
• Ad ve soyad
• Kurumsal e-posta adresi
• Departman ve rol bilgileri
• Şirket içi site/lokasyon atamaları

Kullanım Verileri:
• Satın alma talepleri ve onay geçmişi
• Uygulama içi aktiviteler
• Cihaz bilgileri (model, işletim sistemi)
• IP adresi ve oturum bilgileri

Medya:
• Taleplere eklenen fotoğraflar
• İrsaliye ve belge görüntüleri`,
      },
      {
        title: '3. Verilerin Kullanım Amaçları',
        body: `Toplanan veriler yalnızca aşağıdaki amaçlarla kullanılmaktadır:

• Satın alma taleplerinin oluşturulması, işlenmesi ve takibi
• Onay iş akışlarının yönetimi
• Push bildirimleri ve uygulama içi bildirimler gönderimi
• Kullanıcı kimlik doğrulama ve yetkilendirme
• Uygulama performansının izlenmesi ve iyileştirilmesi
• Yasal yükümlülüklerin yerine getirilmesi`,
      },
      {
        title: '4. Veri Saklama Süresi',
        body: `• Hesap verileri: Hesabınız aktif olduğu sürece saklanır
• Satın alma talepleri: Yasal gereklilikler gereği 10 yıl saklanır
• Oturum logları: 1 yıl saklanır
• Silinen hesaplar: Hesap silme talebinden sonra 30 gün içinde tüm kişisel veriler kalıcı olarak silinir`,
      },
      {
        title: '5. Veri Güvenliği',
        body: `Verilerinizi korumak için endüstri standardı güvenlik önlemleri uygulanmaktadır:

• TLS 1.3 şifreleme ile veri iletimi
• AES-256 şifreleme ile veri depolama
• ISO 27001 sertifikalı veri merkezleri
• Düzenli güvenlik denetimleri ve penetrasyon testleri
• Rol tabanlı erişim kontrolleri
• Detaylı aktivite loglaması`,
      },
      {
        title: '6. Kullanıcı Hakları',
        body: `6698 sayılı KVKK ve GDPR kapsamında aşağıdaki haklara sahipsiniz:

• Erişim hakkı: Verilerinizin bir kopyasını talep edebilirsiniz
• Düzeltme hakkı: Yanlış veya eksik verilerin düzeltilmesini isteyebilirsiniz
• Silme hakkı: Hesabınızı silebilirsiniz (yasal saklama yükümlülükleri saklıdır)
• İtiraz hakkı: Veri işlemeye itiraz edebilirsiniz
• Taşınabilirlik hakkı: Verilerinizi yapılandırılmış formatta alabilirsiniz

Hesap silme işlemi için Ayarlar > "Profili tamamen kaldır" seçeneğini kullanabilirsiniz.`,
      },
      {
        title: '7. Bildirim İzinleri',
        body: 'Uygulama, talep durumu güncellemeleri ve onay bildirimleri için push notification izni talep etmektedir. Bu izni istediğiniz zaman cihaz ayarlarından iptal edebilirsiniz. Bildirim izni verilmese de uygulama tam işlevsellikle çalışmaya devam eder.',
      },
      {
        title: '8. Çocukların Gizliliği',
        body: 'Bu uygulama kurumsal kullanım için tasarlanmıştır ve 18 yaşın altındaki bireylere yönelik değildir. 18 yaşın altındaki kullanıcılardan bilerek veri toplamıyoruz. Böyle bir durum tespit edilirse, ilgili veriler derhal silinecektir.',
      },
      {
        title: '9. Politika Değişiklikleri',
        body: 'Bu gizlilik politikası zaman zaman güncellenebilir. Önemli değişiklikler yapıldığında uygulama içi bildirim ile kullanıcılar bilgilendirilecektir. Güncel politika her zaman uygulama içinden erişilebilir durumdadır.',
      },
      {
        title: '10. İletişim',
        body: `Gizlilik politikası veya kişisel verileriniz hakkında sorularınız için bizimle iletişime geçebilirsiniz:

Dovec Group
E-posta: ${CONTACT_EMAIL}`,
        hasContact: true,
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 04.06.2026',
    sendEmail: 'Send Email',
    viewOnWeb: 'View on Web',
    sections: [
      {
        title: '1. Introduction',
        body: 'At Dovec Group ("Company", "we"), we place great importance on the privacy of your personal data through the DLX Purchasing mobile application ("App"). This Privacy Policy explains what data we collect, how we use it, store it, and protect it.',
      },
      {
        title: '2. Data Collected',
        body: `Our application collects the following personal data:

Account Information:
• First and last name
• Corporate email address
• Department and role information
• Company site/location assignments

Usage Data:
• Purchase requests and approval history
• In-app activities
• Device information (model, operating system)
• IP address and session information

Media:
• Photos attached to requests
• Delivery notes and document images`,
      },
      {
        title: '3. Purpose of Data Use',
        body: `Collected data is used only for the following purposes:

• Creation, processing, and tracking of purchase requests
• Management of approval workflows
• Sending push notifications and in-app notifications
• User authentication and authorization
• Monitoring and improving application performance
• Fulfilling legal obligations`,
      },
      {
        title: '4. Data Retention Period',
        body: `• Account data: Retained as long as your account is active
• Purchase requests: Retained for 10 years due to legal requirements
• Session logs: Retained for 1 year
• Deleted accounts: All personal data is permanently deleted within 30 days after account deletion request`,
      },
      {
        title: '5. Data Security',
        body: `Industry-standard security measures are implemented to protect your data:

• Data transmission with TLS 1.3 encryption
• Data storage with AES-256 encryption
• ISO 27001 certified data centers
• Regular security audits and penetration testing
• Role-based access controls
• Detailed activity logging`,
      },
      {
        title: '6. User Rights',
        body: `Under KVKK Law No. 6698 and GDPR, you have the following rights:

• Right of access: You can request a copy of your data
• Right to rectification: You can request correction of inaccurate or incomplete data
• Right to erasure: You can delete your account (subject to legal retention obligations)
• Right to object: You can object to data processing
• Right to portability: You can receive your data in a structured format

To delete your account, use Settings > "Remove profile completely".`,
      },
      {
        title: '7. Notification Permissions',
        body: 'The app requests push notification permission for request status updates and approval notifications. You can revoke this permission at any time from your device settings. The app continues to function fully even without notification permission.',
      },
      {
        title: '8. Children\'s Privacy',
        body: 'This app is designed for corporate use and is not intended for individuals under 18 years of age. We do not knowingly collect data from users under 18. If such a case is detected, the relevant data will be deleted immediately.',
      },
      {
        title: '9. Policy Changes',
        body: 'This privacy policy may be updated from time to time. Users will be notified via in-app notification when significant changes are made. The current policy is always accessible from within the app.',
      },
      {
        title: '10. Contact',
        body: `For questions about the privacy policy or your personal data, please contact us:

Dovec Group
Email: ${CONTACT_EMAIL}`,
        hasContact: true,
      },
    ],
  },
}

export default function PrivacyPolicyScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const c = content[lang]

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
      <Text style={styles.title}>{c.title}</Text>
      <Text style={styles.updated}>{c.updated}</Text>

      {c.sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
          {section.hasContact && (
            <>
              <Pressable style={styles.emailBtn} onPress={openEmail}>
                <Text style={styles.emailBtnText}>{c.sendEmail}</Text>
              </Pressable>
              <Pressable style={styles.webBtn} onPress={openWebVersion}>
                <Text style={styles.webBtnText}>{c.viewOnWeb}</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
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
