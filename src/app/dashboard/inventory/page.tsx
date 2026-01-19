'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Package, Calendar, User, FileText, AlertCircle, CheckCircle, XCircle, AlertTriangle, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

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
  product_id: string | null
  assigned_by_profile?: {
    full_name: string
    email: string
  }
  purchase_request?: {
    request_number: string
    id: string
  }
  product?: {
    category: string | null
  }
}

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<{ full_name: string; email: string } | null>(null)
  const [showConsumeModal, setShowConsumeModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [consumeQuantity, setConsumeQuantity] = useState('')
  const [consuming, setConsuming] = useState(false)
  const supabase = createClient()
  const { showToast } = useToast()

  useEffect(() => {
    fetchInventory()
    fetchUserInfo()
  }, [])

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserInfo(profile)
      }
    } catch (error) {
      console.error('Kullanıcı bilgisi alınamadı:', error)
    }
  }

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Kullanıcı oturumu bulunamadı', 'error')
        return
      }

      const { data, error } = await supabase
        .from('user_inventory')
        .select(`
          *,
          assigned_by_profile:assigned_by(full_name, email),
          purchase_request:purchase_requests(request_number, id),
          product:products(category)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('assigned_date', { ascending: false })

      if (error) {
        console.error('Zimmet kayıtları alınamadı:', error)
        showToast('Zimmet kayıtları yüklenemedi', 'error')
        return
      }

      setInventoryItems(data || [])
    } catch (error) {
      console.error('Zimmet kayıtları yüklenirken hata:', error)
      showToast('Bir hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Aktif</Badge>
      case 'returned':
        return <Badge className="bg-blue-100 text-blue-700"><CheckCircle className="w-3 h-3 mr-1" />İade Edildi</Badge>
      case 'lost':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Kayıp</Badge>
      case 'damaged':
        return <Badge className="bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3 mr-1" />Hasarlı</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">{status}</Badge>
    }
  }

  const getTotalQuantity = () => {
    return inventoryItems
      .filter(item => item.status === 'active')
      .reduce((sum, item) => sum + item.quantity, 0)
  }

  const getUniqueItemsCount = () => {
    const uniqueItems = new Set(
      inventoryItems
        .filter(item => item.status === 'active')
        .map(item => item.item_name)
    )
    return uniqueItems.size
  }

  const isConsumable = (item: InventoryItem) => {
    const category = item.category || item.product?.category
    return category === 'kontrollü sarf' || category === 'sarf malzemesi'
  }

  const getRemainingQuantity = (item: InventoryItem) => {
    return item.quantity - (item.consumed_quantity || 0)
  }

  const handleConsumeClick = (item: InventoryItem) => {
    setSelectedItem(item)
    setConsumeQuantity('')
    setShowConsumeModal(true)
  }

  const handleConsume = async () => {
    if (!selectedItem) return

    try {
      const quantity = parseFloat(consumeQuantity)
      
      if (!consumeQuantity.trim() || quantity <= 0) {
        showToast('Geçerli bir miktar girin', 'error')
        return
      }

      const remaining = getRemainingQuantity(selectedItem)
      if (quantity > remaining) {
        showToast(`Maksimum ${remaining} ${selectedItem.unit} sarf edebilirsiniz`, 'error')
        return
      }

      setConsuming(true)

      const newConsumedQuantity = (selectedItem.consumed_quantity || 0) + quantity
      const newStatus = newConsumedQuantity >= selectedItem.quantity ? 'returned' : 'active'

      const { error } = await supabase
        .from('user_inventory')
        .update({
          consumed_quantity: newConsumedQuantity,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedItem.id)

      if (error) {
        console.error('Sarf işlemi hatası:', error)
        showToast('Sarf işlemi başarısız', 'error')
        return
      }

      showToast(
        `${quantity} ${selectedItem.unit} sarf edildi. ${newStatus === 'returned' ? 'Tüm miktar tüketildi.' : `Kalan: ${remaining - quantity} ${selectedItem.unit}`}`,
        'success'
      )

      setShowConsumeModal(false)
      setSelectedItem(null)
      setConsumeQuantity('')
      await fetchInventory()

    } catch (error) {
      console.error('Sarf işlemi hatası:', error)
      showToast('Bir hata oluştu', 'error')
    } finally {
      setConsuming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
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
            <h1 className="text-3xl font-bold text-gray-900">Zimmetli Ürünlerim</h1>
            <p className="text-sm text-gray-600 mt-1">
              {userInfo?.full_name || userInfo?.email || 'Kullanıcı'}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Ürün</p>
                  <p className="text-3xl font-bold text-gray-900">{getUniqueItemsCount()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Toplam Adet</p>
                  <p className="text-3xl font-bold text-gray-900">{getTotalQuantity()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Aktif Zimmet</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {inventoryItems.filter(item => item.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inventory List */}
        <Card className="bg-white shadow-sm rounded-2xl border border-gray-100">
          <CardHeader className="p-6 border-b border-gray-100">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Zimmet Listesi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {inventoryItems.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Zimmetli Ürün Yok
                </h3>
                <p className="text-sm text-gray-600">
                  Şu anda üzerinizde kayıtlı aktif ürün bulunmuyor.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-xl p-5 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-lg font-semibold text-gray-900 flex-1">
                          {item.item_name}
                        </h4>
                        {getStatusBadge(item.status)}
                      </div>
                        
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Miktar</p>
                            <p className="text-sm font-semibold text-gray-900">{item.quantity} {item.unit}</p>
                          </div>
                        </div>
                        
                        {isConsumable(item) && (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                <Flame className="w-5 h-5 text-orange-500" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Sarf Edilen</p>
                                <p className="text-sm font-semibold text-orange-600">{item.consumed_quantity || 0} {item.unit}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Kalan</p>
                                <p className="text-sm font-semibold text-green-600">{getRemainingQuantity(item)} {item.unit}</p>
                              </div>
                            </div>
                          </>
                        )}
                        
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tarih</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {new Date(item.assigned_date).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        
                        {item.assigned_by_profile && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Zimmet Veren</p>
                              <p className="text-sm font-semibold text-gray-900">{item.assigned_by_profile.full_name || item.assigned_by_profile.email}</p>
                            </div>
                          </div>
                        )}
                        
                        {item.purchase_request && (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Talep No</p>
                              <p className="text-sm font-semibold text-gray-900">{item.purchase_request.request_number}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {item.notes && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-sm text-gray-600">{item.notes}</p>
                        </div>
                      )}
                      
                      {/* Sarf Butonu - Sadece sarf malzemeleri için */}
                      {isConsumable(item) && item.status === 'active' && getRemainingQuantity(item) > 0 && (
                        <div className="pt-4 border-t border-gray-200">
                          <Button
                            onClick={() => handleConsumeClick(item)}
                            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-11 px-6 font-medium"
                          >
                            <Flame className="w-5 h-5 mr-2" />
                            Sarf Et
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sarf Etme Modalı */}
        <Dialog open={showConsumeModal} onOpenChange={setShowConsumeModal}>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-900">
                <Flame className="w-5 h-5 text-orange-600" />
                Sarf Et
              </DialogTitle>
            </DialogHeader>
            
            {selectedItem && (
              <div className="py-4 space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-orange-900 mb-2">
                    {selectedItem.item_name}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-orange-700">
                    <div>Toplam: <span className="font-semibold">{selectedItem.quantity} {selectedItem.unit}</span></div>
                    <div>Sarf Edilen: <span className="font-semibold">{selectedItem.consumed_quantity || 0} {selectedItem.unit}</span></div>
                    <div className="col-span-2">Kalan: <span className="font-semibold text-green-600">{getRemainingQuantity(selectedItem)} {selectedItem.unit}</span></div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sarf Edilecek Miktar (Max: {getRemainingQuantity(selectedItem)} {selectedItem.unit})
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getRemainingQuantity(selectedItem)}
                      value={consumeQuantity}
                      onChange={(e) => setConsumeQuantity(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="Miktar girin"
                      className="flex-1 h-11 rounded-xl"
                    />
                    <div className="flex items-center px-4 bg-gray-50 rounded-xl border">
                      <span className="text-sm text-gray-600 font-medium">{selectedItem.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowConsumeModal(false)
                  setSelectedItem(null)
                  setConsumeQuantity('')
                }}
                className="flex-1 rounded-xl"
              >
                İptal
              </Button>
              <Button
                type="button"
                onClick={handleConsume}
                disabled={!consumeQuantity.trim() || parseFloat(consumeQuantity || '0') <= 0 || consuming}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
              >
                {consuming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sarf Ediliyor...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 mr-2" />
                    Sarf Et
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
