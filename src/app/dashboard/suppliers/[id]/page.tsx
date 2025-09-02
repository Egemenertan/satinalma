'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { useToast } from '@/components/ui/toast'
import { 
  Building,
  Phone,
  Mail,
  MapPin,
  Star,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Target,
  ArrowLeft,
  X
} from 'lucide-react'

interface Order {
  id: string
  created_at: string
  updated_at: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  amount: number
  currency: string
  delivery_date: string
  supplier_id: string
  purchase_request_id: string
  document_urls: string[]
  purchase_requests?: {
    title: string
    request_number: string
  }[]
}

interface Supplier {
  id: string
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  tax_number: string
  payment_terms: number
  rating: number
  is_approved: boolean
  created_at: string
  updated_at: string
}

interface SupplierMaterial {
  id: string
  material_item_id: string
  material_item: {
    id: string
    name: string
    unit: string
    subcategory: {
      id: string
      name: string
      category: {
        id: string
        name: string
      }
    }
  }
}

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  console.log('🚀 Component yükleniyor - params:', params)

  const router = useRouter()
  const { showToast } = useToast()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [materials, setMaterials] = useState<SupplierMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [materialItems, setMaterialItems] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('')
  const [selectedMaterialItem, setSelectedMaterialItem] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => {
    let isActive = true

    console.log('🔄 useEffect tetiklendi')
    console.log('📍 Current supplier ID:', params.id)

    const loadData = async () => {
      try {
        await Promise.all([
          fetchSupplierDetails(),
          fetchCategories(),
          fetchSupplierOrders()
        ])
      } catch (error) {
        console.error('Veri yükleme hatası:', error)
      }
    }

    if (isActive) {
      loadData()
    }

    return () => {
      isActive = false
    }
  }, [params.id])

  const fetchSupplierOrders = async () => {
    try {
      console.log('🔍 Siparişler yüklenmeye başlıyor...')
      console.log('📌 Supplier ID:', params.id)
      
      setLoadingOrders(true)
      
      // Ana sorguyu çalıştır
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          updated_at,
          status,
          amount,
          currency,
          delivery_date,
          supplier_id,
          purchase_request_id,
          document_urls,
          purchase_requests:purchase_requests!left (
            title,
            request_number
          )
        `)
        .eq('supplier_id', params.id)
        .order('created_at', { ascending: false })

      if (ordersError) {
        console.error('❌ Sipariş yükleme hatası:', {
          message: ordersError.message,
          details: ordersError.details,
          hint: ordersError.hint,
          code: ordersError.code
        })
        throw ordersError
      }

      console.log('✅ Siparişler başarıyla yüklendi')
      console.log('📦 Toplam sipariş sayısı:', ordersData?.length || 0)
      console.log('📄 Sipariş verileri:', ordersData)
      
      setOrders(ordersData || [])
    } catch (error) {
      console.error('Siparişler yüklenirken hata:', error)
      showToast('Siparişler yüklenirken bir hata oluştu.', 'error')
    } finally {
      setLoadingOrders(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('material_categories')
        .select('*')
        .order('name')
      
      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error)
      showToast('Kategoriler yüklenirken bir hata oluştu.', 'error')
    }
  }

  const fetchSubcategories = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('material_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('name')
      
      if (error) throw error
      setSubcategories(data || [])
      setSelectedSubcategory('')
      setMaterialItems([])
    } catch (error) {
      console.error('Alt kategoriler yüklenirken hata:', error)
      showToast('Alt kategoriler yüklenirken bir hata oluştu.', 'error')
    }
  }

  const fetchMaterialItems = async (subcategoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('material_items')
        .select('*')
        .eq('subcategory_id', subcategoryId)
        .order('name')
      
      if (error) throw error
      setMaterialItems(data || [])
      setSelectedMaterialItem('')
    } catch (error) {
      console.error('Malzemeler yüklenirken hata:', error)
      showToast('Malzemeler yüklenirken bir hata oluştu.', 'error')
    }
  }

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId)
    fetchSubcategories(categoryId)
  }

  const handleSubcategoryChange = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId)
    fetchMaterialItems(subcategoryId)
  }

  const handleAddMaterial = async () => {
    if (!selectedMaterialItem) {
      showToast('Lütfen bir malzeme seçin.', 'error')
      return
    }

    try {
      setSubmitting(true)
      
      // Önce bu malzemenin zaten ekli olup olmadığını kontrol et
      const { data: existingMaterial } = await supabase
        .from('supplier_materials')
        .select('id')
        .eq('supplier_id', params.id)
        .eq('material_item_id', selectedMaterialItem)
        .single()

      if (existingMaterial) {
        showToast('Bu malzeme zaten tedarikçiye ekli.', 'error')
        return
      }

      // Yeni malzeme ekle
      const { error } = await supabase
        .from('supplier_materials')
        .insert({
          supplier_id: params.id,
          material_item_id: selectedMaterialItem
        })

      if (error) throw error

      showToast('Malzeme başarıyla eklendi.', 'success')
      setIsAddMaterialModalOpen(false)
      fetchSupplierDetails() // Malzeme listesini yenile
      
      // State'leri sıfırla
      setSelectedCategory('')
      setSelectedSubcategory('')
      setSelectedMaterialItem('')
      setSubcategories([])
      setMaterialItems([])

    } catch (error) {
      console.error('Malzeme eklenirken hata:', error)
      showToast('Malzeme eklenirken bir hata oluştu.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const fetchSupplierDetails = async () => {
    try {
      console.log('Tedarikçi ID:', params.id)

      // Tedarikçi bilgilerini çek
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select(`
          id,
          name,
          contact_person,
          email,
          phone,
          address,
          tax_number,
          payment_terms,
          rating,
          is_approved,
          created_at,
          updated_at
        `)
        .eq('id', params.id)
        .single()

      if (supplierError) {
        console.error('Tedarikçi bilgileri çekilirken hata:', supplierError)
        throw new Error(`Tedarikçi bilgileri alınamadı: ${supplierError.message}`)
      }

      console.log('Tedarikçi bilgileri:', supplierData)
      setSupplier(supplierData)

      // Tedarikçinin malzemelerini çek
      const { data: materialsData, error: materialsError } = await supabase
        .from('supplier_materials')
        .select(`
          id,
          material_item_id,
          supplier_id
        `)
        .eq('supplier_id', params.id)

      // Malzeme detaylarını ayrı bir sorgu ile çekelim
      if (materialsData && materialsData.length > 0) {
        const materialIds = materialsData.map(m => m.material_item_id)
        
        const { data: itemsData, error: itemsError } = await supabase
          .from('material_items')
          .select(`
            id,
            name,
            unit,
            subcategory:material_subcategories!inner (
              id,
              name,
              category:material_categories!inner (
                id,
                name
              )
            )
          `)
          .in('id', materialIds)

        if (itemsError) {
          console.error('Malzeme detayları çekilirken hata:', itemsError)
          throw new Error(`Malzeme detayları alınamadı: ${itemsError.message}`)
        }

        // Malzeme bilgilerini birleştirelim
        const enrichedMaterials: SupplierMaterial[] = materialsData.map(material => {
          const item = itemsData?.find(item => item.id === material.material_item_id)
          return {
            id: material.id,
            material_item_id: material.material_item_id,
            material_item: {
              id: item?.id || '',
              name: item?.name || '',
              unit: item?.unit || '',
              subcategory: {
                id: item?.subcategory?.[0]?.id || '',
                name: item?.subcategory?.[0]?.name || '',
                category: {
                  id: item?.subcategory?.[0]?.category?.[0]?.id || '',
                  name: item?.subcategory?.[0]?.category?.[0]?.name || ''
                }
              }
            }
          }
        })

        setMaterials(enrichedMaterials)
      } else {
        setMaterials([])
      }

      if (materialsError) {
        console.error('Tedarikçi malzemeleri çekilirken hata:', materialsError)
        throw new Error(`Tedarikçi malzemeleri alınamadı: ${materialsError.message}`)
      }

      console.log('Tedarikçi malzemeleri:', materialsData)
    } catch (error: any) {
      console.error('Tedarikçi detayları yüklenirken hata:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      showToast(error.message || 'Tedarikçi detayları yüklenirken bir hata oluştu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ))
  }

  const getStatusBadge = (isApproved: boolean) => {
    return isApproved ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Onaylı
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Beklemede
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tedarikçi Bulunamadı</h2>
          <p className="text-gray-600 mb-4">İstediğiniz tedarikçi bilgilerine ulaşılamadı.</p>
          <Button onClick={() => router.back()}>Geri Dön</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-normal text-gray-900">{supplier.name}</h1>
            <p className="text-gray-600 mt-1">Tedarikçi Detayları</p>
          </div>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Edit2 className="w-4 h-4 mr-2" />
          Düzenle
        </Button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Panel - Temel Bilgiler */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Temel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{supplier.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{supplier.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{supplier.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                <span>{supplier.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>Vergi No: {supplier.tax_number}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Durum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-2">Onay Durumu</div>
                {getStatusBadge(supplier.is_approved)}
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">Değerlendirme</div>
                <div className="flex items-center gap-2">
                  {getRatingStars(supplier.rating)}
                  <span className="text-sm font-medium">({supplier.rating}/5)</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">Ödeme Vadesi</div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{supplier.payment_terms} gün</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Panel - Detaylar */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="materials" className="w-full">
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="materials" className="flex-1">Malzemeler</TabsTrigger>
                  <TabsTrigger value="orders" className="flex-1">Siparişler</TabsTrigger>
                </TabsList>

                <TabsContent value="materials" className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Tedarik Edilen Malzemeler</h3>
                      <Button onClick={() => setIsAddMaterialModalOpen(true)}>
                        <Package className="w-4 h-4 mr-2" />
                        Malzeme Ekle
                      </Button>
                    </div>
                    
                    {materials.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Henüz malzeme eklenmemiş</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {materials.map((material) => (
                          <Card key={material.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">{material.material_item?.name || 'Bilinmeyen Malzeme'}</h4>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {material.material_item?.subcategory?.category?.name} {' > '} 
                                    {material.material_item?.subcategory?.name}
                                  </div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    Birim: {material.material_item?.unit || '-'}
                                  </div>
                                </div>
                                <Button variant="outline" size="sm">
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Düzenle
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Sipariş Geçmişi</h3>
                    </div>
                    
                    {/* Debug bilgileri */}
                    <div style={{ display: 'none' }}>
                      {`🎯 Render - loadingOrders: ${loadingOrders}`}
                      {`🎯 Render - orders: ${JSON.stringify(orders)}`}
                    </div>
                    
                    {loadingOrders ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>Henüz sipariş bulunmuyor</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {orders.map((order) => (
                          <Card key={order.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium">
                                    {order.purchase_requests?.[0]?.title || 'Sipariş #' + order.id.slice(0, 8)}
                                  </h4>
                                  <div className="text-sm text-gray-600 mt-1">
                                    Talep No: {order.purchase_requests?.[0]?.request_number || '-'}
                                  </div>
                                  <div className="flex items-center gap-4 mt-2">
                                    <div className="text-sm text-gray-500">
                                      <Calendar className="w-4 h-4 inline mr-1" />
                                      Oluşturulma: {new Date(order.created_at).toLocaleDateString('tr-TR')}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      <Package className="w-4 h-4 inline mr-1" />
                                      Teslimat: {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                    </div>
                                    <Badge className={
                                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      order.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                      order.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }>
                                      {order.status === 'completed' ? 'Tamamlandı' :
                                       order.status === 'approved' ? 'Onaylandı' :
                                       order.status === 'rejected' ? 'Reddedildi' :
                                       'Beklemede'}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-lg">
                                    {new Intl.NumberFormat('tr-TR', { 
                                      style: 'currency', 
                                      currency: order.currency || 'TRY'
                                    }).format(order.amount)}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Malzeme Ekleme Modal */}
      {isAddMaterialModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Malzeme Ekle</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAddMaterialModalOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Kategori Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori
                </label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Alt Kategori Seçimi */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alt Kategori
                  </label>
                  <Select value={selectedSubcategory} onValueChange={handleSubcategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alt kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Malzeme Seçimi */}
              {selectedSubcategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Malzeme
                  </label>
                  <Select value={selectedMaterialItem} onValueChange={setSelectedMaterialItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Malzeme seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAddMaterialModalOpen(false)}
                disabled={submitting}
              >
                İptal
              </Button>
              <Button
                onClick={handleAddMaterial}
                disabled={!selectedMaterialItem || submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ekleniyor...
                  </>
                ) : (
                  'Malzeme Ekle'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
