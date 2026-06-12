import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Destek | DLX',
  description: 'DLX Satın Alma uygulaması destek merkezi',
}

const SUPPORT_EMAIL = 'info@dlxflow.com'

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Destek Merkezi</h1>
        <p className="text-gray-500 mb-8">Size nasıl yardımcı olabiliriz?</p>

        <div className="space-y-6">
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">İletişim</h2>
            <p className="text-gray-600 mb-4">
              Sorularınız, önerileriniz veya teknik destek talepleriniz için bizimle iletişime geçebilirsiniz.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">E-posta</p>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 font-medium hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Sık Sorulan Sorular</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Hesabımı nasıl silebilirim?</h3>
                <p className="text-gray-600 text-sm">
                  Ayarlar menüsünden &quot;Profili tamamen kaldır&quot; seçeneğini kullanarak hesabınızı silebilirsiniz.
                  İşlem 30 gün içinde tamamlanır.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Bildirimleri nasıl kapatabilirim?</h3>
                <p className="text-gray-600 text-sm">
                  Cihaz ayarlarından uygulama bildirimlerini kapatabilirsiniz. Uygulama bildirim izni olmadan da
                  tam işlevsellikle çalışmaya devam eder.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Şifremi unuttum, ne yapmalıyım?</h3>
                <p className="text-gray-600 text-sm">
                  Giriş ekranındaki &quot;Şifremi Unuttum&quot; bağlantısını kullanarak şifrenizi sıfırlayabilirsiniz.
                  E-posta adresinize sıfırlama bağlantısı gönderilecektir.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Çalışma Saatleri</h2>
            <p className="text-gray-600">
              Destek ekibimiz hafta içi 09:00 - 18:00 saatleri arasında hizmet vermektedir.
              Acil durumlar için e-posta ile 7/24 ulaşabilirsiniz.
            </p>
          </section>
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
          <Link href="/terms" className="hover:text-gray-700">
            Kullanım Koşulları
          </Link>
        </div>
      </div>
    </div>
  )
}
