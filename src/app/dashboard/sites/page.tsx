'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { invalidateSitesCache } from '@/lib/cache'
import { 
  Building2, 
  Plus, 
  User, 
  Calendar,
  DollarSign,
  TrendingUp,
  Search,
  FileText,
  Package,
  Users,
  Clock,
  ChevronRight,
  Truck
} from 'lucide-react'

interface Site {
  id: string
  name: string
  created_at: string
  updated_at: string
  approved_expenses?: number // Onaylanan harcama tutarı
  total_budget?: number // Toplam bütçe
  // İstatistikler
  total_requests: number
  total_amount: number
  pending_requests: number
  approved_requests: number
  recent_requesters: string[]
  last_request_date?: string
}

// Sites with stats fetcher fonksiyonu
const fetchSitesWithStats = async () => {
  const supabase = createClient()
  
  console.log('🔍 Fetching sites...')
  
  // Auth durumunu kontrol et
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log('👤 Auth user:', user)
  console.log('🔐 Auth error:', authError)
  
  if (!user) throw new Error('Kullanıcı oturumu bulunamadı')
    
  // Sites tablosundan veri çek (onaylanan harcama tutarı dahil)
  const sitesResult = await supabase
    .from('sites')
    .select('id, name, created_at, updated_at, approved_expenses, total_budget')
    .order('name')

  console.log('📊 Sites result:', sitesResult)
  console.log('📊 Sites error details:', sitesResult.error)

  if (sitesResult.error) {
    console.error('Sites fetch error:', sitesResult.error)
    throw new Error(sitesResult.error.message)
  }

  const allSitesData = sitesResult.data || []
  console.log('📋 All sites data:', allSitesData)

  if (allSitesData.length === 0) {
    console.log('⚠️ No sites found')
    return []
  }

  // Her site için istatistikleri hesapla
  const sitesWithStats = await Promise.all(
    allSitesData.map(async (site) => {
      try {
        // Purchase requests'leri çek (site_id için)
        const requestsResult = await supabase
          .from('purchase_requests')
          .select(`
            id,
            status,
            created_at,
            total_amount,
            purchase_request_items(
              quantity,
              unit,
              total_price
            ),
            profiles!purchase_requests_requested_by_fkey(
              full_name
            )
          `)
          .eq('site_id', site.id)

        const allRequests = requestsResult.data || []
        
        console.log(`📋 Requests for site ${site.name}:`, allRequests.length)
        
        // İstatistikleri hesapla
        const totalRequests = allRequests.length
        const pendingRequests = allRequests.filter(r => r.status === 'pending').length
        const approvedRequests = allRequests.filter(r => r.status === 'approved').length
        
        // Toplam miktar hesaplama (gerçek total_amount değerlerini kullan)
        const totalAmount = allRequests.reduce((sum, req) => {
          return sum + (parseFloat(req.total_amount) || 0)
        }, 0)

        // Son talep edenler
        const requesterNames: string[] = []
        allRequests.slice(0, 5).forEach(req => {
          const profile = req.profiles as any
          if (profile?.full_name) {
            requesterNames.push(profile.full_name)
          }
        })
        
        const uniqueRequesters = Array.from(new Set(requesterNames))
        const recentRequesters = uniqueRequesters.slice(0, 3)

        // Son talep tarihi
        const lastRequestDate = allRequests.length > 0 
          ? allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : undefined

        return {
          ...site,
          total_requests: totalRequests,
          total_amount: totalAmount,
          pending_requests: pendingRequests,
          approved_requests: approvedRequests,
          recent_requesters: recentRequesters,
          last_request_date: lastRequestDate,
        }
      } catch (error) {
        console.error('Error processing site', site.id, error)
        return {
          ...site,
          total_requests: 0,
          total_amount: 0,
          pending_requests: 0,
          approved_requests: 0,
          recent_requesters: [],
          last_request_date: undefined,
        }
      }
    })
  )

  return sitesWithStats
}

export default function SitesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  // SWR ile cache'li sites verisi
  const { data: sites, error: sitesError, isLoading: loading } = useSWR(
    'sites_with_stats',
    fetchSitesWithStats,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 120000, // 2 dakika cache
      errorRetryCount: 3,
      fallbackData: []
    }
  )

  // Real-time updates için subscription
  useEffect(() => {
    const supabase = createClient()
    
    const subscription = supabase
      .channel('sites_updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sites' 
        }, 
        () => {
          console.log('📡 Sites update triggered')
          invalidateSitesCache()
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'purchase_requests' 
        }, 
        () => {
          console.log('📡 Purchase requests update for sites triggered')
          invalidateSitesCache()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const filteredSites = (sites || []).filter(site =>
    site.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total: (sites || []).length,
    totalRequests: (sites || []).reduce((sum, s) => sum + s.total_requests, 0),
    totalAmount: (sites || []).reduce((sum, s) => sum + s.total_amount, 0),
    activeSites: (sites || []).filter(s => s.total_requests > 0).length
  }

  const formatCurrency = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const createSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleSiteClick = (site: Site) => {
    // Şantiye detay sayfasına yönlendir
    const slug = site.name
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    router.push(`/dashboard/sites/${slug}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-medium">Şantiye verileri yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 pb-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="space-y-4">
        {/* Desktop: Header with button on right */}
        <div className="hidden sm:flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">Şantiyeler</h1>
            <p className="text-gray-600 mt-4 text-base">
              Şantiye listesi — detaylı istatistikler ve teklifler için bir şantiyeye tıklayın
            </p>
          </div>
        </div>

        {/* Mobile: Header */}
        <div className="sm:hidden space-y-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 pb-2 border-b-2 border-[#00E676] inline-block">Şantiyeler</h1>
            <p className="text-gray-600 mt-4 text-sm">Detaylar için şantiye kartına dokunun veya tıklayın</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Şantiye</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
                  <div className="flex items-center text-blue-600 text-sm">
                    <Building2 className="h-3 w-3 mr-1" />
                    <span>Aktif</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Kayıtlı şantiye sayısı</p>
                <p className="text-xs text-gray-400">Sistemde tanımlı lokasyonlar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Aktif Şantiye</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.activeSites}</span>
                  <div className="flex items-center text-green-600 text-sm">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>Faaliyet</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Talep olan şantiyeler</p>
                <p className="text-xs text-gray-400">Aktif satın alma süreci</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Talep</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{stats.totalRequests}</span>
                  <div className="flex items-center text-purple-600 text-sm">
                    <FileText className="h-3 w-3 mr-1" />
                    <span>Kayıt</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Oluşturulan talepler</p>
                <p className="text-xs text-gray-400">Tüm şantiyelerdeki toplam</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Toplam Tutar</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {stats.totalAmount > 999999 ? `${(stats.totalAmount / 1000000).toFixed(1)}M` : 
                     stats.totalAmount > 999 ? `${(stats.totalAmount / 1000).toFixed(0)}K` : stats.totalAmount}
                  </span>
                  <div className="flex items-center text-green-600 text-sm">
                    <DollarSign className="h-3 w-3 mr-1" />
                    <span>TL</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Tahmini toplam değer</p>
                <p className="text-xs text-gray-400">Tüm taleplerin bütçesi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Şantiye ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 rounded-xl border-gray-200 focus:border-black focus:ring-black/20"
        />
      </div>

      {/* Sites Grid */}
      {filteredSites.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Şantiye bulunamadı</h3>
          <p className="text-gray-600">Arama kriterlerinizi değiştirmeyi deneyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSites.map((site) => (
            <Card 
              key={site.id} 
              className="bg-white border-0 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => handleSiteClick(site)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl font-semibold text-gray-900 mb-2">
                      {site.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 mt-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        Oluşturulma: {formatDate(site.created_at)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gradient-to-r from-gray-50/50 to-gray-100/50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-900">{site.total_requests}</div>
                      <p className="text-xs text-gray-600">Toplam Talep</p>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-xl">
                      <div className="text-2xl font-bold text-green-700">{site.approved_requests}</div>
                      <p className="text-xs text-gray-600">Onaylanan</p>
                    </div>
                  </div>

                  {/* Onaylanan Harcama Tutarı */}
                  {(site.approved_expenses || 0) > 0 && (
                    <div className="p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-xl border border-blue-100/50">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-medium text-blue-800 uppercase tracking-wide">Onaylanan Harcama</p>
                      </div>
                      <div className="text-xl font-bold text-blue-900">
                        {formatCurrency(site.approved_expenses || 0)}
                      </div>
                      {site.total_budget && site.total_budget > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-blue-700 mb-1">
                            <span>Bütçe Kullanımı</span>
                            <span>{((site.approved_expenses || 0) / site.total_budget * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(((site.approved_expenses || 0) / site.total_budget * 100), 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pending requests */}
                  {site.pending_requests > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50/50 rounded-xl">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-gray-700">
                        <span className="font-medium">{site.pending_requests}</span> bekleyen talep
                      </span>
                    </div>
                  )}

                  {/* Recent requesters */}
                  {site.recent_requesters.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Son Talep Edenler</p>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-700">
                          {site.recent_requesters.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Last request date */}
                  {site.last_request_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Son talep: {formatDate(site.last_request_date)}</span>
                    </div>
                  )}

                  {/* No activity */}
                  {site.total_requests === 0 && (
                    <div className="text-center py-4">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">Henüz talep oluşturulmamış</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}


    </div>
  )
}