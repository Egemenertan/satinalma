import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'DLX Satın Alma | Modern Satın Alma Yönetimi',
  description: 'İnşaat ve yapı sektörü için profesyonel satın alma yönetim sistemi',
}

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">DLX Satın Alma</h1>
          <p className="text-xl text-gray-600">
            İnşaat ve yapı sektörü için modern satın alma yönetim sistemi
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Talep Yönetimi</h3>
            <p className="text-gray-600">
              Şantiyeden merkeze kadar tüm satın alma taleplerini tek platformda yönetin.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Onay İş Akışları</h3>
            <p className="text-gray-600">
              Çok seviyeli onay süreçleri ile harcamalarınızı kontrol altında tutun.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Anlık Bildirimler</h3>
            <p className="text-gray-600">
              Talep durumları ve onay bildirimleriyle hiçbir şeyi kaçırmayın.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Raporlama</h3>
            <p className="text-gray-600">
              Detaylı raporlar ile satın alma süreçlerinizi analiz edin.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Hemen Başlayın</h2>
          <p className="text-gray-600 mb-6">
            DLX Satın Alma ile satın alma süreçlerinizi dijitalleştirin.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/auth/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Giriş Yap
            </Link>
            <Link
              href="/support"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              İletişime Geç
            </Link>
          </div>
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
          <span className="mx-2">•</span>
          <Link href="/support" className="hover:text-gray-700">
            Destek
          </Link>
        </div>
      </div>
    </div>
  )
}
