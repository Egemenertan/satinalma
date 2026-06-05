import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ISLAND_BOTTOM_BAR_CONTENT_INSET } from '../../../src/components/island/islandTokens'
import { stats } from '../../../src/theme/statsDesignTokens'

const CONTACT_EMAIL = 'info@dovecconstruction.com'
const WEB_TERMS_URL = 'https://dovec.app/termsOfService'

const content = {
  tr: {
    title: 'Kullanım Koşulları',
    updated: 'Son güncelleme: 04.06.2026',
    sendEmail: 'E-posta Gönder',
    viewOnWeb: "Web'de Görüntüle",
    sections: [
      {
        title: '1. Kabul ve Onay',
        body: `DLX Satın Alma mobil uygulamasını ("Uygulama") indirerek, kurarak veya kullanarak bu Kullanım Koşullarını ("Koşullar") kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız uygulamayı kullanmamalısınız.

Bu Koşullar, Dovec Group ("Şirket", "biz") ile uygulama kullanıcısı ("Kullanıcı", "siz") arasında yasal olarak bağlayıcı bir sözleşme oluşturur.`,
      },
      {
        title: '2. Hizmet Tanımı',
        body: `Bu uygulama, Dovec Group ve bağlı şirketleri bünyesinde çalışan yetkili personelin kullanımına yönelik kurumsal bir satın alma yönetim sistemidir. Uygulama aşağıdaki işlevleri sağlar:

• Satın alma taleplerinin oluşturulması
• Onay iş akışlarının yönetimi
• Talep durumlarının takibi
• Bildirim ve uyarı sistemi
• Zimmet ve envanter takibi`,
      },
      {
        title: '3. Erişim ve Hesap',
        body: `• Uygulama yalnızca şirket tarafından yetkilendirilen çalışanlar tarafından kullanılabilir
• Hesap bilgileriniz (kullanıcı adı, şifre) gizli tutulmalıdır
• Hesabınız üzerinden gerçekleştirilen tüm işlemlerden siz sorumlusunuz
• Yetkisiz erişim şüphesi durumunda derhal IT departmanını bilgilendirmelisiniz
• Şirket, herhangi bir zamanda herhangi bir nedenle hesap erişimini askıya alma veya sonlandırma hakkını saklı tutar`,
      },
      {
        title: '4. Kullanıcı Yükümlülükleri',
        body: `Uygulamayı kullanırken aşağıdaki yükümlülükleri kabul edersiniz:

• Uygulamayı yalnızca yasal ve iş amaçlı kullanmak
• Doğru, güncel ve eksiksiz bilgiler sağlamak
• Şirket politikalarına ve prosedürlerine uygun davranmak
• Diğer kullanıcıların haklarına saygı göstermek
• Uygulamayı kötüye kullanmamak veya manipüle etmemek
• Güvenlik açıklarını istismar etmemek
• Yetkisiz erişim girişimlerinde bulunmamak`,
      },
      {
        title: '5. Fikri Mülkiyet Hakları',
        body: `Uygulama ve tüm içeriği (yazılım, tasarım, logolar, metinler, grafikler) Dovec Group'un mülkiyetindedir ve telif hakkı, marka hakkı ve diğer fikri mülkiyet yasaları ile korunmaktadır.

Kullanıcıya uygulamayı kullanmak için sınırlı, geri alınabilir, münhasır olmayan bir lisans verilmektedir. Bu lisans:

• Devredilemez
• Alt lisans verilemez
• Yalnızca iş amaçlı kullanım için geçerlidir`,
      },
      {
        title: '6. Yasaklanan Faaliyetler',
        body: `Aşağıdaki faaliyetler kesinlikle yasaktır:

• Uygulamayı tersine mühendislik, kaynak koda dönüştürme veya ayrıştırma
• Uygulamanın herhangi bir bölümünü kopyalama veya çoğaltma
• Otomatik veri toplama araçları (bot, spider vb.) kullanma
• Zararlı yazılım veya kod yükleme
• Diğer kullanıcıların verilerine yetkisiz erişim
• Sahte veya yanıltıcı bilgi girişi`,
      },
      {
        title: '7. Hesap Sonlandırma',
        body: `Şirket tarafından sonlandırma:
• İş akdinin sona ermesi durumunda hesap otomatik olarak devre dışı bırakılır
• Koşulların ihlali durumunda hesap derhal askıya alınabilir
• Güvenlik ihlali şüphesinde hesap geçici olarak kilitlenebilir

Kullanıcı tarafından sonlandırma:
• Ayarlar menüsünden "Profili tamamen kaldır" seçeneğiyle hesabınızı silebilirsiniz
• Hesap silme işlemi 30 gün içinde geri alınamaz şekilde tamamlanır
• Yasal gereklilikler gereği bazı veriler anonimleştirilerek saklanabilir`,
      },
      {
        title: '8. Sorumluluk Sınırlaması',
        body: `Uygulama "olduğu gibi" ve "mevcut haliyle" sunulmaktadır. Şirket, yasaların izin verdiği azami ölçüde:

• Uygulamanın kesintisiz veya hatasız çalışacağını garanti etmez
• Teknik aksaklıklardan kaynaklanan zararlardan sorumlu tutulamaz
• Veri kaybından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz
• Üçüncü taraf hizmetlerinin kesintilerinden sorumlu tutulamaz`,
      },
      {
        title: '9. Tazminat',
        body: 'Kullanıcı, bu Koşulların ihlalinden veya uygulamanın kötüye kullanımından kaynaklanan tüm talep, zarar, kayıp ve masraflara karşı şirketi, yöneticilerini ve çalışanlarını tazmin etmeyi kabul eder.',
      },
      {
        title: '10. Değişiklikler',
        body: `Şirket, bu Kullanım Koşullarını herhangi bir zamanda değiştirme hakkını saklı tutar. Önemli değişiklikler yapıldığında:

• Uygulama içi bildirim gönderilecektir
• Değişiklik tarihi bu sayfada güncellenecektir
• Değişikliklerden sonra uygulamayı kullanmaya devam etmeniz, yeni koşulları kabul ettiğiniz anlamına gelir`,
      },
      {
        title: '11. Uygulanacak Hukuk',
        body: 'Bu Koşullar, Kuzey Kıbrıs Türk Cumhuriyeti yasalarına tabidir. Uyuşmazlıkların çözümünde Lefkoşa Mahkemeleri yetkilidir.',
      },
      {
        title: '12. Bölünebilirlik',
        body: 'Bu Koşulların herhangi bir hükmünün geçersiz veya uygulanamaz bulunması, diğer hükümlerin geçerliliğini etkilemeyecektir.',
      },
      {
        title: '13. İletişim',
        body: `Kullanım koşulları hakkında sorularınız için bizimle iletişime geçebilirsiniz:

Dovec Group
E-posta: ${CONTACT_EMAIL}`,
        hasContact: true,
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: 04.06.2026',
    sendEmail: 'Send Email',
    viewOnWeb: 'View on Web',
    sections: [
      {
        title: '1. Acceptance and Consent',
        body: `By downloading, installing, or using the DLX Purchasing mobile application ("App"), you agree to these Terms of Service ("Terms"). If you do not accept these terms, you should not use the application.

These Terms constitute a legally binding agreement between Dovec Group ("Company", "we") and the application user ("User", "you").`,
      },
      {
        title: '2. Service Description',
        body: `This application is a corporate purchasing management system for authorized personnel working within Dovec Group and its affiliated companies. The application provides the following functions:

• Creation of purchase requests
• Management of approval workflows
• Tracking of request statuses
• Notification and alert system
• Asset and inventory tracking`,
      },
      {
        title: '3. Access and Account',
        body: `• The application can only be used by employees authorized by the company
• Your account information (username, password) must be kept confidential
• You are responsible for all actions performed through your account
• In case of suspected unauthorized access, you must immediately notify the IT department
• The company reserves the right to suspend or terminate account access at any time for any reason`,
      },
      {
        title: '4. User Obligations',
        body: `By using the application, you accept the following obligations:

• Use the application only for legal and business purposes
• Provide accurate, current, and complete information
• Comply with company policies and procedures
• Respect the rights of other users
• Not misuse or manipulate the application
• Not exploit security vulnerabilities
• Not attempt unauthorized access`,
      },
      {
        title: '5. Intellectual Property Rights',
        body: `The application and all its content (software, design, logos, text, graphics) are the property of Dovec Group and are protected by copyright, trademark, and other intellectual property laws.

The user is granted a limited, revocable, non-exclusive license to use the application. This license:

• Is non-transferable
• Cannot be sublicensed
• Is valid only for business use`,
      },
      {
        title: '6. Prohibited Activities',
        body: `The following activities are strictly prohibited:

• Reverse engineering, decompiling, or disassembling the application
• Copying or reproducing any part of the application
• Using automated data collection tools (bots, spiders, etc.)
• Uploading malicious software or code
• Unauthorized access to other users' data
• Entering false or misleading information`,
      },
      {
        title: '7. Account Termination',
        body: `Termination by the company:
• Account is automatically disabled upon termination of employment
• Account may be immediately suspended in case of violation of terms
• Account may be temporarily locked in case of suspected security breach

Termination by user:
• You can delete your account using Settings > "Remove profile completely"
• Account deletion is completed irreversibly within 30 days
• Some data may be retained in anonymized form due to legal requirements`,
      },
      {
        title: '8. Limitation of Liability',
        body: `The application is provided "as is" and "as available". The company, to the maximum extent permitted by law:

• Does not guarantee that the application will operate without interruption or error
• Cannot be held responsible for damages arising from technical malfunctions
• Cannot be held responsible for direct or indirect damages arising from data loss
• Cannot be held responsible for interruptions of third-party services`,
      },
      {
        title: '9. Indemnification',
        body: 'The user agrees to indemnify the company, its directors, and employees against all claims, damages, losses, and expenses arising from violation of these Terms or misuse of the application.',
      },
      {
        title: '10. Changes',
        body: `The company reserves the right to change these Terms of Service at any time. When significant changes are made:

• An in-app notification will be sent
• The change date will be updated on this page
• Continuing to use the application after changes means you accept the new terms`,
      },
      {
        title: '11. Applicable Law',
        body: 'These Terms are governed by the laws of the Turkish Republic of Northern Cyprus. Nicosia Courts have jurisdiction for dispute resolution.',
      },
      {
        title: '12. Severability',
        body: 'If any provision of these Terms is found to be invalid or unenforceable, it shall not affect the validity of the other provisions.',
      },
      {
        title: '13. Contact',
        body: `For questions about the terms of service, please contact us:

Dovec Group
Email: ${CONTACT_EMAIL}`,
        hasContact: true,
      },
    ],
  },
}

export default function TermsOfServiceScreen() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const c = content[lang]

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
