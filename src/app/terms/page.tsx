import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Kullanım Koşulları | DLX',
  description: 'DLX Satın Alma uygulaması kullanım koşulları',
}

const sections = [
  {
    title: '1. Kabul ve Onay',
    body: `DLX Satın Alma mobil uygulamasını ("Uygulama") indirerek, kurarak veya kullanarak bu Kullanım Koşullarını ("Koşullar") kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız uygulamayı kullanmamalısınız.

Bu Koşullar, DLX ("Hizmet Sağlayıcı", "biz") ile uygulama kullanıcısı ("Kullanıcı", "siz") arasında yasal olarak bağlayıcı bir sözleşme oluşturur.`,
  },
  {
    title: '2. Hizmet Tanımı',
    body: `Bu uygulama, inşaat ve yapı sektöründe faaliyet gösteren şirketlerin satın alma süreçlerini yönetmek için tasarlanmış bir B2B platformudur. Uygulama aşağıdaki işlevleri sağlar:

• Satın alma taleplerinin oluşturulması
• Onay iş akışlarının yönetimi
• Talep durumlarının takibi
• Bildirim ve uyarı sistemi
• Zimmet ve envanter takibi`,
  },
  {
    title: '3. Erişim ve Hesap',
    body: `• Uygulama kayıtlı kullanıcılar tarafından kullanılabilir
• Hesap bilgileriniz (kullanıcı adı, şifre) gizli tutulmalıdır
• Hesabınız üzerinden gerçekleştirilen tüm işlemlerden siz sorumlusunuz
• Yetkisiz erişim şüphesi durumunda derhal destek ekibini bilgilendirmelisiniz
• DLX, herhangi bir zamanda herhangi bir nedenle hesap erişimini askıya alma veya sonlandırma hakkını saklı tutar`,
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
    body: `Uygulama ve tüm içeriği (yazılım, tasarım, logolar, metinler, grafikler) DLX'in mülkiyetindedir ve telif hakkı, marka hakkı ve diğer fikri mülkiyet yasaları ile korunmaktadır.

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
    body: `DLX tarafından sonlandırma:
• Koşulların ihlali durumunda hesap derhal askıya alınabilir
• Güvenlik ihlali şüphesinde hesap geçici olarak kilitlenebilir
• Uzun süreli kullanılmayan hesaplar devre dışı bırakılabilir

Kullanıcı tarafından sonlandırma:
• Ayarlar menüsünden "Profili tamamen kaldır" seçeneğiyle hesabınızı silebilirsiniz
• Hesap silme işlemi 30 gün içinde geri alınamaz şekilde tamamlanır
• Yasal gereklilikler gereği bazı veriler anonimleştirilerek saklanabilir`,
  },
  {
    title: '8. Sorumluluk Sınırlaması',
    body: `Uygulama "olduğu gibi" ve "mevcut haliyle" sunulmaktadır. DLX, yasaların izin verdiği azami ölçüde:

• Uygulamanın kesintisiz veya hatasız çalışacağını garanti etmez
• Teknik aksaklıklardan kaynaklanan zararlardan sorumlu tutulamaz
• Veri kaybından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz
• Üçüncü taraf hizmetlerinin kesintilerinden sorumlu tutulamaz`,
  },
  {
    title: '9. Tazminat',
    body: 'Kullanıcı, bu Koşulların ihlalinden veya uygulamanın kötüye kullanımından kaynaklanan tüm talep, zarar, kayıp ve masraflara karşı DLX\'i, yöneticilerini ve çalışanlarını tazmin etmeyi kabul eder.',
  },
  {
    title: '10. Değişiklikler',
    body: `DLX, bu Kullanım Koşullarını herhangi bir zamanda değiştirme hakkını saklı tutar. Önemli değişiklikler yapıldığında:

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

DLX Destek
https://www.dlxflow.com/support`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kullanım Koşulları</h1>
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
          <Link href="/privacy-policy" className="hover:text-gray-700">
            Gizlilik Politikası
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
