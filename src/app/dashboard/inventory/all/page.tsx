'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Package, 
  Search, 
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Flame,
  MoreVertical,
  FileText,
  Plus
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import CreateZimmetModal from '@/components/CreateZimmetModal'

interface InventoryItem {
  id: string
  item_name: string
  quantity: number
  unit: string
  assigned_date: string
  status: 'active' | 'returned' | 'lost' | 'damaged'
  notes: string
  category: string | null
  consumed_quantity: number
  serial_number?: string
  owner_name?: string
  owner_email?: string
  user: {
    id: string
    full_name: string
    email: string
  }
  assigned_by_profile?: {
    full_name: string
    email: string
  }
  purchase_request?: {
    request_number: string
    id: string
  }
}

export default function AllInventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const supabase = createClient()
  const { showToast } = useToast()
  const router = useRouter()

  useEffect(() => {
    checkUserRole()
  }, [])

  useEffect(() => {
    if (userRole && userRole !== 'user') {
      fetchAllInventory()
    }
  }, [userRole])

  useEffect(() => {
    filterItems()
  }, [searchQuery, inventoryItems])

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'warehouse_manager' && profile?.role !== 'admin' && profile?.role !== 'manager' && profile?.role !== 'site_manager') {
        showToast('Bu sayfaya erişim yetkiniz yok', 'error')
        router.push('/dashboard')
        return
      }

      setUserRole(profile.role)
    } catch (error) {
      console.error('Rol kontrolü hatası:', error)
      router.push('/dashboard')
    }
  }

  const fetchAllInventory = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // User inventory'den aktif zimmetleri al
      let query = supabase
        .from('user_inventory')
        .select(`
          *,
          user:user_id(id, full_name, email),
          assigned_by_profile:assigned_by(full_name, email),
          purchase_request:purchase_requests(request_number, id)
        `)
        .eq('status', 'active')

      // Site manager ise sadece kendi oluşturduğu zimmetleri göster
      if (userRole === 'site_manager') {
        query = query.eq('assigned_by', user.id)
      }

      const { data, error } = await query.order('assigned_date', { ascending: false })

      if (error) {
        console.error('Zimmet kayıtları alınamadı:', error)
        showToast('Zimmet kayıtları yüklenemedi', 'error')
        return
      }

      // Pending zimmetleri de al (henüz giriş yapmamış kullanıcılar için)
      // Site manager ise sadece kendi email'i ile eşleşen owner_email'leri göster
      let pendingQuery = supabase
        .from('pending_user_inventory')
        .select('*')
      
      if (userRole === 'site_manager') {
        // Site manager'ın email'ini al
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single()
        
        if (profile?.email) {
          pendingQuery = pendingQuery.eq('owner_email', profile.email)
        }
      }
      
      const { data: pendingData, error: pendingError } = await pendingQuery
        .order('created_at', { ascending: false })

      if (pendingError) {
        console.error('Pending zimmetler alınamadı:', pendingError)
      }

      // Pending zimmetleri user_inventory formatına çevir
      const pendingItems = (pendingData || []).map(item => ({
        id: item.id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit || 'Adet',
        assigned_date: item.created_at,
        status: 'active' as const,
        notes: item.notes || '',
        category: null,
        consumed_quantity: 0,
        serial_number: item.serial_number,
        owner_name: item.owner_name,
        owner_email: item.owner_email,
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          full_name: item.user_name || 'Bekliyor',
          email: item.user_email
        }
      }))

      // Her iki listeyi birleştir
      const allItems = [...(data || []), ...pendingItems]
      
      setInventoryItems(allItems)
      setFilteredItems(allItems)
    } catch (error) {
      console.error('Zimmet kayıtları yüklenirken hata:', error)
      showToast('Bir hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(inventoryItems)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = inventoryItems.filter(item => 
      item.item_name.toLowerCase().includes(query) ||
      item.user?.full_name?.toLowerCase().includes(query) ||
      item.user?.email?.toLowerCase().includes(query) ||
      item.purchase_request?.request_number?.toLowerCase().includes(query)
    )
    setFilteredItems(filtered)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-gray-900 text-white"><CheckCircle className="w-3 h-3 mr-1" />Aktif</Badge>
      case 'returned':
        return <Badge className="bg-gray-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />İade Edildi</Badge>
      case 'lost':
        return <Badge className="bg-gray-400 text-gray-900"><XCircle className="w-3 h-3 mr-1" />Kayıp</Badge>
      case 'damaged':
        return <Badge className="bg-gray-300 text-gray-900"><AlertTriangle className="w-3 h-3 mr-1" />Hasarlı</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>
    }
  }

  const handleExportPDF = async (item: InventoryItem, type: 'teslim' | 'sayim') => {
    try {
      showToast('PDF oluşturuluyor...', 'info')
      
      // Import PDF generators directly from the file
      const { generateTeslimPDF, generateSayimPDF } = await import('@/lib/pdf/zimmetPdfGenerator')
      
      if (type === 'teslim') {
        await generateTeslimPDF(item)
        showToast('Teslim Tesellüm PDF\'i oluşturuldu', 'success')
      } else {
        await generateSayimPDF(item)
        showToast('Sayım Tutanağı PDF\'i oluşturuldu', 'success')
      }
      
    } catch (error) {
      console.error('PDF export hatası:', error)
      showToast('PDF oluşturulamadı', 'error')
    }
  }

  const isConsumable = (item: InventoryItem) => {
    return item.category === 'kontrollü sarf' || item.category === 'sarf malzemesi'
  }

  const getRemainingQuantity = (item: InventoryItem) => {
    return item.quantity - (item.consumed_quantity || 0)
  }

  const getTotalStats = () => {
    const activeItems = inventoryItems.filter(item => item.status === 'active')
    const totalQuantity = activeItems.reduce((sum, item) => sum + item.quantity, 0)
    const uniqueUsers = new Set(activeItems.map(item => item.user?.id)).size
    
    return {
      totalItems: activeItems.length,
      totalQuantity,
      uniqueUsers
    }
  }

  const stats = getTotalStats()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {userRole === 'site_manager' ? 'Oluşturduğum Zimmetler' : 'Tüm Zimmetler'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {userRole === 'site_manager' 
                ? 'Oluşturduğunuz zimmetleri görüntüleyin ve yeni zimmet oluşturun'
                : 'Kullanıcılara atanmış tüm ürünleri görüntüleyin'
              }
            </p>
          </div>
          
          {/* Create Zimmet Button */}
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white h-10 px-6 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Zimmet Oluştur
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Zimmet</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Adet</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalQuantity}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Kullanıcı Sayısı</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
          <CardHeader className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Zimmet Listesi
              </CardTitle>
              
              {/* Search */}
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Ürün, kullanıcı veya talep no ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl"
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Zimmet Kaydı Bulunamadı
                </h3>
                <p className="text-sm text-gray-600">
                  {searchQuery 
                    ? 'Arama kriterlerinize uygun kayıt bulunamadı.' 
                    : userRole === 'site_manager'
                      ? 'Henüz hiç zimmet oluşturmadınız.'
                      : 'Henüz hiç zimmet kaydı yok.'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Kullanıcı
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Ürün
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Miktar
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Sarf
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Tarih
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Talep No
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Durum
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            {/* Zimmet Sahibi (Owner) */}
                            {item.owner_name && (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Zimmet Sahibi</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {item.owner_name}
                                  </p>
                                  <p className="text-xs text-gray-400">{item.owner_email}</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Kullanıcı (User) */}
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-600" />
                              </div>
                              <div>
                                {item.owner_name && (
                                  <p className="text-xs text-gray-500">2. Zimmetli</p>
                                )}
                                <p className="text-sm font-semibold text-gray-900">
                                  {item.user?.full_name || 'İsimsiz'}
                                </p>
                                <p className="text-xs text-gray-400">{item.user?.email}</p>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.item_name}</p>
                            {item.serial_number && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                S/N: {item.serial_number}
                              </p>
                            )}
                            {isConsumable(item) && (
                              <div className="flex items-center gap-1 mt-1">
                                <Flame className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-600">Sarf Malzemesi</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {item.quantity} {item.unit}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {isConsumable(item) ? (
                            <div>
                              <p className="text-sm text-gray-700 font-semibold">
                                {item.consumed_quantity || 0} {item.unit}
                              </p>
                              <p className="text-xs text-gray-500">
                                Kalan: {getRemainingQuantity(item)} {item.unit}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">-</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">
                            {new Date(item.assigned_date).toLocaleDateString('tr-TR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {item.purchase_request ? (
                            <p className="text-sm font-medium text-gray-700">
                              {item.purchase_request.request_number}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">-</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-4">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-600" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-white z-[100]">
                              <DropdownMenuItem
                                onClick={() => handleExportPDF(item, 'teslim')}
                                className="cursor-pointer hover:bg-gray-100"
                              >
                                <FileText className="w-4 h-4 mr-2 text-gray-600" />
                                <span className="text-gray-900">Teslim Tesellüm PDF</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExportPDF(item, 'sayim')}
                                className="cursor-pointer hover:bg-gray-100"
                              >
                                <FileText className="w-4 h-4 mr-2 text-gray-600" />
                                <span className="text-gray-900">Sayım Tutanağı PDF</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Zimmet Modal */}
        <CreateZimmetModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={() => {
            fetchAllInventory()
          }}
          showToast={showToast}
        />
      </div>
    </div>
  )
}
