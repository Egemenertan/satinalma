'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Package, User } from 'lucide-react'

// Office.js tipi tanımlamaları
declare global {
  interface Window {
    Office?: any
  }
}

export default function OutlookPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isOfficeReady, setIsOfficeReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentItem, setCurrentItem] = useState<any>(null)

  useEffect(() => {
    // Office.js yüklendiğinde
    const initializeOffice = () => {
      if (window.Office) {
        window.Office.onReady((info: any) => {
          if (info.host === window.Office.HostType.Outlook) {
            setIsOfficeReady(true)
            loadMailboxItem()
          }
        })
      }
    }

    // Auth durumunu kontrol et
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setIsAuthenticated(true)
          setUserEmail(user.email || '')
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeOffice()
    checkAuth()
  }, [])

  const loadMailboxItem = () => {
    if (window.Office && window.Office.context && window.Office.context.mailbox) {
      const item = window.Office.context.mailbox.item
      if (item) {
        setCurrentItem({
          subject: item.subject,
          from: item.from?.displayName || item.from?.emailAddress,
          body: item.body
        })
      }
    }
  }

  const handleLogin = () => {
    // Outlook içinden login sayfasına yönlendir
    window.open('/auth/login?redirect=/outlook', '_blank')
  }

  const handleCreateRequest = () => {
    router.push('/dashboard/requests/create')
  }

  const handleViewRequests = () => {
    router.push('/dashboard/requests')
  }

  const extractRequestFromEmail = async () => {
    if (!currentItem) return

    try {
      // E-posta içeriğini al
      currentItem.body.getAsync(
        window.Office.CoercionType.Text,
        async (result: any) => {
          if (result.status === window.Office.AsyncResultStatus.Succeeded) {
            const emailBody = result.value
            
            // AI ile e-postadan talep bilgilerini çıkar
            // Bu kısmı daha sonra AI entegrasyonu ile geliştirebiliriz
            console.log('Email body:', emailBody)
            
            // Şimdilik basit bir modal göster
            alert(`E-posta başlığı: ${currentItem.subject}\n\nBu özellik yakında geliştirilecek!`)
          }
        }
      )
    } catch (error) {
      console.error('Error extracting request:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hoş Geldiniz</h1>
          <p className="text-gray-600 mb-8">
            Satın alma taleplerinizi yönetmek için lütfen giriş yapın
          </p>
          <Button 
            onClick={handleLogin}
            className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white h-12"
          >
            Giriş Yap
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Satın Alma Talepleri</h1>
              <p className="text-sm text-gray-600">{userEmail}</p>
            </div>
          </div>

          {isOfficeReady && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-green-800">
                <Mail className="w-5 h-5" />
                <span className="text-sm font-medium">Outlook ile entegre edildi</span>
              </div>
            </div>
          )}
        </div>

        {/* Ana İşlemler */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Hızlı İşlemler</h2>
          
          <div className="space-y-3">
            <Button
              onClick={handleCreateRequest}
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white h-14 justify-start text-left"
            >
              <Package className="w-5 h-5 mr-3" />
              <div>
                <div className="font-semibold">Yeni Talep Oluştur</div>
                <div className="text-xs text-blue-100">Satın alma talebi oluşturun</div>
              </div>
            </Button>

            <Button
              onClick={handleViewRequests}
              variant="outline"
              className="w-full rounded-2xl border-gray-200 hover:bg-gray-50 h-14 justify-start text-left"
            >
              <Mail className="w-5 h-5 mr-3 text-gray-600" />
              <div>
                <div className="font-semibold text-gray-900">Taleplerim</div>
                <div className="text-xs text-gray-500">Mevcut taleplerinizi görüntüleyin</div>
              </div>
            </Button>
          </div>
        </div>

        {/* E-posta Bilgisi */}
        {currentItem && (
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Mevcut E-posta</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Konu</label>
                <p className="text-gray-900 font-medium">{currentItem.subject}</p>
              </div>
              {currentItem.from && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Gönderen</label>
                  <p className="text-gray-900">{currentItem.from}</p>
                </div>
              )}
              
              <Button
                onClick={extractRequestFromEmail}
                variant="outline"
                className="w-full rounded-2xl border-gray-200 hover:bg-gray-50 mt-4"
              >
                E-postadan Talep Oluştur (Yakında)
              </Button>
            </div>
          </div>
        )}

        {/* Bilgilendirme */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm text-blue-800">
            <strong>İpucu:</strong> Bu pencereyi açık tutarak Outlook'tan satın alma taleplerinizi 
            kolayca yönetebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  )
}
