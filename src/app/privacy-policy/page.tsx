import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Gizlilik Politikası | DLX',
  description: 'DLX Satın Alma uygulaması gizlilik politikası',
}

const sections = [
  {
    title: '1. Giriş',
    body: 'DLX ("Hizmet Sağlayıcı", "biz") olarak, DLX Satın Alma mobil uygulaması ("Uygulama") üzerinden kişisel verilerinizin gizliliğine büyük önem veriyoruz. Bu Gizlilik Politikası, hangi verileri topladığımızı, nasıl kullandığımızı, sakladığımızı ve koruduğumuzu açıklamaktadır.',
  },
  {
    title: '2. Toplanan Veriler',
    body: `Uygulamamız aşağıdaki kişisel verileri toplamaktadır:

Hesap Bilgileri:
• Ad ve soyad
• E-posta adresi
• Şirket adı ve departman bilgileri
• Rol ve lokasyon atamaları

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

DLX Destek
https://www.dlxflow.com/support`,
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gizlilik Politikası</h1>
        <p className="text-sm text-gray-500 mb-8">Son güncelleme: 04.06.2026</p>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <section key={index} className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h2>
              <p className="text-gray-600 whitespace-pre-line leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">
            Ana Sayfa
          </Link>
          <span className="mx-2">•</span>
          <Link href="/terms" className="hover:text-gray-700">
            Kullanım Koşulları
          </Link>
          <span className="mx-2">•</span>
          <Link href="/support" className="hover:text-gray-700">
            Destek
          </Link>
        </div>
      </div>
    </div>
  )
}
