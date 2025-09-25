'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Save, Package, Building2, Calendar, DollarSign, Truck, FileText, Check, AlertCircle, X, Camera, Upload, ImageIcon, Phone, Mail, ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react'
import { addOffers, updateSiteExpenses } from '@/lib/actions'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/lib/types'
import { useToast } from '@/components/ui/toast'
import AssignSupplierModal from '@/components/AssignSupplierModal'
import DeliveryConfirmationModal from '@/components/DeliveryConfirmationModal'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'

// Para birimi seçenekleri
const CURRENCIES = [
  { value: 'TRY', label: 'Türk Lirası', symbol: '₺' },
  { value: 'USD', label: 'Amerikan Doları', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'İngiliz Sterlini', symbol: '£' }
]

// Para birimi sembolü alma fonksiyonu
const getCurrencySymbol = (currency: string) => {
  const curr = CURRENCIES.find(c => c.value === currency)
  return curr ? curr.symbol : '₺'
}

interface Offer {
  supplier_name: string
  unit_price: number
  total_price: number
  delivery_days: number
  delivery_date: string
  notes: string
  currency: string
  documents: File[]
  documentPreviewUrls: string[]
}

interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description: string
  department: string
  urgency_level: string
  status: string
  created_at: string
  site_id?: string
  site_name?: string
  construction_site_id?: string
  category_name?: string
  subcategory_name?: string
  material_class?: string
  material_group?: string
  image_urls?: string[]
  sent_quantity?: number
  purchase_request_items: Array<{
    id: string
    item_name: string
    description: string
    quantity: number
    unit: string
    specifications: string
    brand?: string
    original_quantity?: number
  }>
  profiles: {
    full_name: string
    email: string
  }
  sites?: {
    id: string
    name: string
    code?: string
    location?: string
  }
  construction_sites?: {
    id: string
    name: string
    code?: string
    location?: string
  }
}

export default function OffersPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const requestId = params.id as string
  const supabase = createClientComponentClient<Database>()

  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [existingOffers, setExistingOffers] = useState<any[]>([])
  const [hasOrder, setHasOrder] = useState<boolean>(false)
  const [userRole, setUserRole] = useState<string>('user')
  const [siteManagerApproving, setSiteManagerApproving] = useState<boolean>(false)
  const [supplierMaterialInfo, setSupplierMaterialInfo] = useState<{
    isRegistered: boolean;
    suppliers: Array<{
      id: string;
      name: string;
      contact_person: string;
      phone: string;
      email: string;
    }>;
  }>({
    isRegistered: false,
    suppliers: []
  })
  
  // Her malzeme için ayrı tedarikçi bilgileri
  const [materialSuppliers, setMaterialSuppliers] = useState<{[itemId: string]: {
    isRegistered: boolean;
    suppliers: Array<{
      id: string;
      name: string;
      contact_person: string;
      phone: string;
      email: string;
    }>;
  }}>({})
  
  // Malzeme bazlı sipariş bilgileri - malzeme ID + tedarikçi ID kombinasyonu
  const [materialOrders, setMaterialOrders] = useState<{[key: string]: {
    id: string;
    delivery_date: string;
    supplier_name: string;
    created_at: string;
    material_item_id: string;
  }}>({})
  
  // Local olarak sipariş oluşturulan malzeme-tedarikçi kombinasyonları
  const [localOrderTracking, setLocalOrderTracking] = useState<{[key: string]: {
    supplier_id: string;
    material_item_id: string;
    delivery_date: string;
    order_id: string;
    supplier_name: string;
  }}>({})
  
  // Malzeme bazlı tedarikçi atama modal state'leri
  const [currentMaterialForAssignment, setCurrentMaterialForAssignment] = useState<{
    id: string;
    name: string;
    unit?: string;
  } | null>(null)
  const [newOffers, setNewOffers] = useState<Offer[]>([
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '', currency: 'TRY', documents: [], documentPreviewUrls: [] }
  ])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false)
  const [approvalReason, setApprovalReason] = useState('')
  const [offerToApprove, setOfferToApprove] = useState<any | null>(null)
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [orderDetails, setOrderDetails] = useState({
    deliveryDate: '',
    amount: '',
    currency: 'TRY',
    documents: [] as File[],
    documentPreviewUrls: [] as string[]
  })
  
  // Tedarikçi atama modal state'i
  const [isAssignSupplierModalOpen, setIsAssignSupplierModalOpen] = useState(false)
  
  // Teklif formu açık/kapalı state'i
  const [isOfferFormOpen, setIsOfferFormOpen] = useState(false)
  
  // Resim modal state'leri
  const [selectedImageModal, setSelectedImageModal] = useState<{
    url: string;
    alt: string;
    index: number;
    total: number;
  } | null>(null)

  // Santiye depo modal state'leri
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [sendQuantities, setSendQuantities] = useState<{[key: string]: string}>({})
  const [sendingItem, setSendingItem] = useState(false)

  // Teslimat onayı modal state'leri
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<any>(null)
  const [shipmentData, setShipmentData] = useState<{[key: string]: {total_shipped: number, shipments: any[]}}>({});

  // Teslimat tarihi kontrolü
  const isDeliveryDateReached = () => {
    if (!currentOrder?.delivery_date) {
      console.log('⚠️ currentOrder.delivery_date bulunamadı')
      return false
    }
    
    const deliveryDate = new Date(currentOrder.delivery_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    deliveryDate.setHours(0, 0, 0, 0)
    
    const reached = today >= deliveryDate
    console.log('📅 Teslimat tarihi kontrolü:', {
      deliveryDate: deliveryDate.toISOString().split('T')[0],
      today: today.toISOString().split('T')[0],
      reached
    })
    
    return reached
  }

  // Teslimat onayı yapılabilir mi kontrolü
  const canConfirmDelivery = () => {
    // Site personnel kullanıcısı ve sipariş verildi statusu için butonu göster
    // Order yoksa bile (veri tutarsızlığı) site personnel'in buton görmesini sağla
    const result = userRole === 'site_personnel' && 
           request?.status === 'sipariş verildi' &&
           (!currentOrder || currentOrder.status !== 'delivered') // Order yoksa da çalışsın
    
    console.log('🔍 Teslim alındı butonu kontrolü:', {
      userRole,
      hasCurrentOrder: !!currentOrder,
      currentOrderStatus: currentOrder?.status,
      orderDeliveryDate: currentOrder?.delivery_date,
      isDeliveryDateReached: isDeliveryDateReached(),
      requestStatus: request?.status,
      canConfirm: result
    })
    
    return result
  }

  // Teslimat onayı fonksiyonu
  const handleDeliveryConfirmation = () => {
    // Order yoksa bile modal'ı aç (site personnel için)
    if (userRole === 'site_personnel' && request?.status === 'sipariş verildi') {
      setIsDeliveryModalOpen(true)
    } else if (currentOrder) {
      setIsDeliveryModalOpen(true)
    } else {
      showToast('Sipariş bilgisi bulunamadı', 'error')
    }
  }

  // Teslimat onayı başarılı olduğunda
  const handleDeliverySuccess = () => {
    fetchOrderDetails() // Sipariş durumunu yenile
    fetchRequestData() // Talep verilerini yenile
  }

  // Teklif girilmeye başlandığında formu otomatik aç
  useEffect(() => {
    const hasValidData = newOffers.some(offer => 
      offer.supplier_name.trim() !== '' || 
      offer.unit_price > 0 || 
      offer.documents.length > 0
    )
    if (hasValidData && !isOfferFormOpen) {
      setIsOfferFormOpen(true)
    }
  }, [newOffers, isOfferFormOpen])



  useEffect(() => {
    if (requestId) {
      fetchUserRole()
      fetchRequestData()
      fetchExistingOffers()
      checkItemInSupplierMaterials()
      fetchOrderDetails()
      fetchShipmentData()
      fetchMaterialSuppliers()
      fetchMaterialOrders()
    }
  }, [requestId])

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (profile?.role) {
          setUserRole(profile.role)
          console.log('👤 User role in offers page:', profile.role)
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const fetchShipmentData = async () => {
    try {
      const { data: shipments, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('purchase_request_id', requestId)
        .order('shipped_at', { ascending: false })

      if (error) {
        console.error('Error fetching shipments:', error)
        setShipmentData({})
        return
      }

      // Profile bilgilerini ayrı çek
      let shipmentsWithProfiles = shipments || []
      
      if (shipments && shipments.length > 0) {
        const userIds = [...new Set(shipments.map(s => s.shipped_by))]
        
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)

        if (!profileError && profiles) {
          shipmentsWithProfiles = shipments.map(shipment => ({
            ...shipment,
            profiles: profiles.find(p => p.id === shipment.shipped_by) || null
          }))
        }
      }

      // Shipment verilerini item_id'ye göre grupla
      const groupedShipments: {[key: string]: {total_shipped: number, shipments: any[]}} = {}
      
      console.log('📦 Shipment verileri gruplama başlıyor:', {
        requestId,
        totalShipments: shipmentsWithProfiles.length,
        shipmentsDetail: shipmentsWithProfiles.map(s => ({
          id: s.id,
          item_id: s.purchase_request_item_id,
          quantity: s.shipped_quantity,
          shipped_at: s.shipped_at
        }))
      })
      
      shipmentsWithProfiles.forEach((shipment, index) => {
        const itemId = shipment.purchase_request_item_id
        const quantity = parseFloat(shipment.shipped_quantity)
        
        console.log(`📦 Shipment ${index + 1}:`, {
          shipment_id: shipment.id,
          item_id: itemId,
          quantity: quantity,
          shipped_at: shipment.shipped_at
        })
        
        if (!groupedShipments[itemId]) {
          groupedShipments[itemId] = {
            total_shipped: 0,
            shipments: []
          }
          console.log(`📦 Yeni item grubu oluşturuldu: ${itemId}`)
        }
        
        const oldTotal = groupedShipments[itemId].total_shipped
        groupedShipments[itemId].total_shipped += quantity
        groupedShipments[itemId].shipments.push(shipment)
        
        console.log(`📦 Item ${itemId} güncellendi:`, {
          oldTotal,
          addedQuantity: quantity,
          newTotal: groupedShipments[itemId].total_shipped,
          shipmentsCount: groupedShipments[itemId].shipments.length
        })
      })

      console.log('📦 Final grouped shipments:', groupedShipments)

      setShipmentData(groupedShipments)
      
    } catch (error) {
      console.error('Error fetching shipment data:', error)
      setShipmentData({})
    }
  }

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      console.log('🔍 Sipariş detayları alınıyor...', requestId)

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          supplier:suppliers(
            id,
            name,
            contact_person,
            phone,
            email
          )
        `)
        .eq('purchase_request_id', requestId)
        .maybeSingle()

      console.log('📦 Sorgu sonucu:', { order, error })

      if (error) {
        console.error('❌ Sipariş detayları alınamadı:', error)
        return
      }

      if (order) {
        console.log('✅ Sipariş bulundu:', {
          id: order.id,
          supplier: order.supplier,
          delivery_date: order.delivery_date,
          amount: order.amount,
          currency: order.currency,
          document_urls: order.document_urls
        })

        // Supabase trigger otomatik olarak status'u güncelleyecek, manuel güncellemeye gerek yok
        console.log('✅ Sipariş oluşturuldu, status otomatik güncellenecek')

        // State'leri güncelle
        setHasOrder(true)
        setSelectedSupplier(order.supplier)
        setCurrentOrder(order) // Teslimat onayı için order bilgisini sakla
        setOrderDetails({
          deliveryDate: order.delivery_date,
          amount: '', // Tutar field'ı kullanılmıyor artık
          currency: order.currency,
          documents: [],
          documentPreviewUrls: order.document_urls || []
        })
      } else {
        console.log('ℹ️ Bu talep için sipariş bulunamadı')
        setHasOrder(false)
        setCurrentOrder(null)
      }
    } catch (error) {
      console.error('❌ Sipariş detayları alınırken hata:', error)
    }
  }

  // Malzeme bazlı sipariş bilgilerini çek
  const fetchMaterialOrders = async () => {
    try {
      console.log('🔍 Malzeme sipariş bilgileri alınıyor...')
      
      // Bu talep için oluşturulmuş siparişleri çek
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          delivery_date,
          created_at,
          material_item_id,
          supplier:suppliers(
            id,
            name
          )
        `)
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Sipariş bilgileri alınamadı:', error)
        return
      }

      console.log('📦 Sipariş bilgileri:', orders)

      if (orders && orders.length > 0) {
        const ordersData: {[key: string]: {
          id: string;
          delivery_date: string;
          supplier_name: string;
          created_at: string;
          material_item_id: string;
        }} = {}

        orders.forEach((order: any) => {
          if (order.supplier && order.supplier.id) {
            const supplierId = order.supplier.id
            const materialItemId = order.material_item_id
            
            const orderInfo = {
              id: order.id,
              delivery_date: order.delivery_date,
              supplier_name: order.supplier.name,
              created_at: order.created_at,
              material_item_id: materialItemId || ''
            }
            
            // Material item ID varsa o ile key oluştur
            if (materialItemId) {
              const key = `${materialItemId}_${supplierId}`
              ordersData[key] = orderInfo
              console.log(`✅ Malzeme bazlı sipariş: ${key}`, orderInfo)
            }
            
            // Geriye uyumluluk için sadece supplier ID ile de kaydet
            ordersData[supplierId] = orderInfo
          }
        })

        setMaterialOrders(ordersData)
        console.log('✅ Sipariş bilgileri state\'e kaydedildi:', ordersData)
      } else {
        setMaterialOrders({})
        console.log('ℹ️ Bu talep için sipariş bulunamadı')
      }
    } catch (error) {
      console.error('❌ Sipariş bilgileri alınırken hata:', error)
      setMaterialOrders({})
    }
  }

  // Her malzeme için tedarikçi kontrolü
  const fetchMaterialSuppliers = async () => {
    try {
      console.log('🔍 Malzeme bazlı tedarikçi kontrolü başlatılıyor...')
      
      // Önce talep edilen ürünlerin listesini alalım
      const { data: requestData, error: requestError } = await supabase
        .from('purchase_requests')
        .select('purchase_request_items(id, item_name)')
        .eq('id', requestId)
        .single()

      if (requestError) {
        console.error('❌ Purchase request data alınamadı:', requestError)
        throw requestError
      }

      console.log('📋 Purchase request items:', requestData?.purchase_request_items)

      if (requestData?.purchase_request_items && requestData.purchase_request_items.length > 0) {
        const materialSuppliersData: {[itemId: string]: {
          isRegistered: boolean;
          suppliers: Array<{
            id: string;
            name: string;
            contact_person: string;
            phone: string;
            email: string;
          }>;
        }} = {}

        // Her malzeme için ayrı ayrı tedarikçi kontrolü yap
        for (const item of requestData.purchase_request_items) {
          console.log(`🔍 ${item.item_name} için tedarikçi kontrolü...`)
          
          try {
            // Yeni şema ile kontrol et (material_item field'ı ile)
            const { data: supplierMaterialsNew, error: materialsErrorNew } = await supabase
              .from('supplier_materials')
              .select(`
                id,
                supplier_id,
                material_item
              `)
              .eq('material_item', item.item_name)

            if (!materialsErrorNew && supplierMaterialsNew && supplierMaterialsNew.length > 0) {
              console.log(`✅ ${item.item_name} için tedarikçi bulundu:`, supplierMaterialsNew.length)
              
              // Tedarikçi bilgilerini alalım
              const supplierIds = supplierMaterialsNew.map(sm => sm.supplier_id)
              const { data: suppliers, error: suppliersError } = await supabase
                .from('suppliers')
                .select('id, name, contact_person, phone, email')
                .in('id', supplierIds)

              if (!suppliersError && suppliers) {
                materialSuppliersData[item.id] = {
                  isRegistered: true,
                  suppliers: suppliers
                }
              } else {
                materialSuppliersData[item.id] = {
                  isRegistered: false,
                  suppliers: []
                }
              }
            } else {
              console.log(`ℹ️ ${item.item_name} için kayıtlı tedarikçi bulunamadı`)
              materialSuppliersData[item.id] = {
                isRegistered: false,
                suppliers: []
              }
            }
          } catch (itemError) {
            console.error(`❌ ${item.item_name} için tedarikçi kontrolü hatası:`, itemError)
            materialSuppliersData[item.id] = {
              isRegistered: false,
              suppliers: []
            }
          }
        }

        console.log('📊 Toplam malzeme tedarikçi verisi:', materialSuppliersData)
        setMaterialSuppliers(materialSuppliersData)
      }
    } catch (error: any) {
      console.error('❌ Malzeme tedarikçi kontrolü hatası:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })
      showToast('Malzeme tedarikçi kontrolü yapılırken bir hata oluştu.', 'error')
    }
  }

  const checkItemInSupplierMaterials = async () => {
    try {
      console.log('🔍 Tedarikçi malzeme kontrolü başlatılıyor...')
      
      // Önce talep edilen ürünün adını alalım
      const { data: requestData, error: requestError } = await supabase
        .from('purchase_requests')
        .select('purchase_request_items(item_name)')
        .eq('id', requestId)
        .single()

      if (requestError) {
        console.error('❌ Purchase request data alınamadı:', requestError)
        throw requestError
      }

      console.log('📋 Purchase request data:', requestData)

      if (requestData?.purchase_request_items?.[0]?.item_name) {
        const itemName = requestData.purchase_request_items[0].item_name
        console.log('🔍 Aranan ürün adı:', itemName)
        
        // Önce supplier_materials tablosu var mı kontrol edelim
        console.log('🔍 Supplier_materials tablosunu kontrol ediliyor...')
        
        // Yeni şema ile kontrol et (material_item field'ı ile)
        const { data: supplierMaterialsNew, error: materialsErrorNew } = await supabase
          .from('supplier_materials')
          .select(`
            id,
            supplier_id,
            material_item
          `)
          .eq('material_item', itemName)

        console.log('🔍 Yeni şema sorgusu sonucu:', { 
          data: supplierMaterialsNew, 
          error: materialsErrorNew 
        })

        if (materialsErrorNew) {
          console.log('⚠️ Yeni şema başarısız, eski şema deneniyor...')
          
          // Eski şema ile kontrol et (material_items join ile)
          const { data: supplierMaterials, error: materialsError } = await supabase
            .from('supplier_materials')
            .select(`
              id,
              supplier_id,
              material_item_id
            `)
            .limit(1) // Sadece tablo var mı test et

          console.log('🔍 Eski şema test sorgusu:', { 
            data: supplierMaterials, 
            error: materialsError 
          })

          if (materialsError) {
            console.error('❌ Supplier_materials tablosuna erişim hatası:', materialsError)
            // Hata olsa bile devam et, bu tablonun olmama ihtimali var
            setSupplierMaterialInfo({
              isRegistered: false,
              suppliers: []
            })
            return
          }
        }

        // Eğer yeni şema çalışıyorsa
        if (!materialsErrorNew && supplierMaterialsNew && supplierMaterialsNew.length > 0) {
          console.log('✅ Yeni şema ile ürün bulundu:', supplierMaterialsNew)
          
          // Tedarikçi bilgilerini alalım
          const supplierIds = supplierMaterialsNew.map(sm => sm.supplier_id)
          const { data: suppliers, error: suppliersError } = await supabase
            .from('suppliers')
            .select('id, name, contact_person, phone, email')
            .in('id', supplierIds)

          if (suppliersError) {
            console.error('❌ Tedarikçi bilgileri alınamadı:', suppliersError)
            throw suppliersError
          }

          console.log('✅ Tedarikçi bilgileri alındı:', suppliers)

          setSupplierMaterialInfo({
            isRegistered: true,
            suppliers: suppliers || []
          })
        } else {
          console.log('ℹ️ Bu ürün için kayıtlı tedarikçi bulunamadı')
          setSupplierMaterialInfo({
            isRegistered: false,
            suppliers: []
          })
        }
      } else {
        console.log('⚠️ Purchase request items bulunamadı')
        setSupplierMaterialInfo({
          isRegistered: false,
          suppliers: []
        })
      }
    } catch (error: any) {
      console.error('❌ Error checking supplier materials:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })
      showToast('Tedarikçi kontrolü yapılırken bir hata oluştu.', 'error')
      
      // Hata durumunda bile state'i set et
      setSupplierMaterialInfo({
        isRegistered: false,
        suppliers: []
      })
    }
  }


  // Cleanup URL objects when component unmounts
  useEffect(() => {
    return () => {
      newOffers.forEach(offer => {
        offer.documentPreviewUrls.forEach(url => URL.revokeObjectURL(url))
      })
    }
  }, [])

  // ESC tuşu ile modal kapatma ve keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedImageModal) {
          closeImageModal()
        } else if (isApprovalModalOpen) {
          closeApprovalModal()
        } else if (isModalOpen) {
          closeOfferModal()
        } else if (isAssignSupplierModalOpen) {
          setIsAssignSupplierModalOpen(false)
        } else if (isSendModalOpen) {
          setIsSendModalOpen(false)
          setSendQuantities({})
        }
      } else if (selectedImageModal) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          navigateImage('prev')
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          navigateImage('next')
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, isApprovalModalOpen, isAssignSupplierModalOpen, selectedImageModal])

  // Modal açıldığında body scroll'unu engelle
  useEffect(() => {
    if (isModalOpen || isApprovalModalOpen || selectedImageModal || isSendModalOpen) {
      // Modal açıldığında scroll'u engelle
      document.body.style.overflow = 'hidden'
    } else {
      // Modal kapandığında scroll'u geri aç
      document.body.style.overflow = 'unset'
    }

    // Cleanup: Bileşen unmount olduğunda scroll'u geri aç
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isModalOpen, isApprovalModalOpen, selectedImageModal, isSendModalOpen])

  const fetchRequestData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching request with ID:', requestId)
      
      // İlk olarak purchase request'i çek
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      
      // Eğer başarılıysa, purchase request items'ları ayrı olarak çek
      if (!error && data) {
        const { data: items, error: itemsError } = await supabase
          .from('purchase_request_items')
          .select('id, item_name, description, quantity, unit, specifications, brand, original_quantity')
          .eq('purchase_request_id', requestId)
        
        if (!itemsError && items) {
          data.purchase_request_items = items
        } else {
          console.error('❌ Items fetch error:', itemsError)
          data.purchase_request_items = []
        }

        // Talep eden kullanıcının bilgilerini ayrı olarak çek
        if (data.requested_by) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', data.requested_by)
            .single()

          if (!profileError && profileData) {
            data.profiles = profileData
          } else {
            console.error('❌ Profile fetch error:', profileError)
            data.profiles = { full_name: 'Bilinmiyor', email: '' }
          }
        }
      }
      
      // Eğer başarılı ve site_id varsa, şantiye bilgisini ayrı çek
      if (!error && data) {
        let siteData = null
        
        // Önce sites tablosundan dene
        if (data.site_id) {
          const { data: sitesData, error: sitesError } = await supabase
            .from('sites')
            .select('id, name, code, location')
            .eq('id', data.site_id)
            .single()
          
          if (!sitesError && sitesData) {
            data.sites = sitesData
          }
        }
        
        // Sonra construction_sites tablosundan dene
        if (data.construction_site_id) {
          const { data: constructionSitesData, error: constructionSitesError } = await supabase
            .from('construction_sites')
            .select('id, name, code, location')
            .eq('id', data.construction_site_id)
            .single()
          
          if (!constructionSitesError && constructionSitesData) {
            data.construction_sites = constructionSitesData
          }
        }
      }
      
      console.log('📊 Supabase response:', { data, error })
      
      if (error) {
        console.error('❌ Supabase error:', error)
        throw error
      }
      
      console.log('✅ Request data loaded successfully:', data)
      setRequest(data)
    } catch (error) {
      console.error('💥 Error fetching request:', error)
      console.error('💥 Error details:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingOffers = async () => {
    try {
      console.log('📥 Fetching existing offers for request:', requestId)
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('purchase_request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('📋 Fetched offers:', data?.map(o => ({ 
        supplier: o.supplier_name, 
        docUrls: o.document_urls?.length || 0 
      })))
      
      setExistingOffers(data || [])
    } catch (error) {
      console.error('Error fetching offers:', error)
    }
  }

  const updateOffer = (index: number, field: keyof Offer, value: string | number) => {
    const updated = [...newOffers]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-calculate total price and delivery date
    if (field === 'unit_price' && request?.purchase_request_items && request.purchase_request_items.length > 0) {
      // Çoklu ürün varsa toplam miktarı hesapla
      const totalQuantity = request.purchase_request_items.reduce((sum, item) => sum + item.quantity, 0)
      updated[index].total_price = Number(value) * totalQuantity
    }

    if (field === 'delivery_days' && value) {
      const date = new Date()
      date.setDate(date.getDate() + Number(value))
      updated[index].delivery_date = date.toISOString().split('T')[0]
    }

    setNewOffers(updated)
  }

  const addOfferRow = () => {
    if (newOffers.length < 5) {
      setNewOffers([...newOffers, { 
        supplier_name: '', unit_price: 0, total_price: 0, 
        delivery_days: 0, delivery_date: '', notes: '', currency: 'TRY',
        documents: [], documentPreviewUrls: [] 
      }])
    }
  }

  const removeOfferRow = (index: number) => {
    if (newOffers.length > 1) {
      // Cleanup URL objects for the removed offer
      newOffers[index].documentPreviewUrls.forEach(url => URL.revokeObjectURL(url))
      setNewOffers(newOffers.filter((_, i) => i !== index))
    }
  }

  const handleDocumentUpload = (offerIndex: number, files: FileList | null) => {
    console.log('📁 handleDocumentUpload called:', { offerIndex, files: files?.length })
    if (!files) return

    const updated = [...newOffers]
    const currentDocuments = updated[offerIndex].documents.length
    const newFiles = Array.from(files).slice(0, 3 - currentDocuments) // Max 3 döküman
    const newPreviewUrls: string[] = []

    console.log('📋 Processing files:', { currentDocs: currentDocuments, newFiles: newFiles.length })

    newFiles.forEach(file => {
      console.log('🔍 Processing file:', { name: file.name, type: file.type, size: file.size })
      if (file.type.startsWith('image/') || file.type.includes('pdf')) {
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
        console.log('✅ File accepted and preview created')
      } else {
        console.log('❌ File rejected - invalid type')
      }
    })

    updated[offerIndex] = {
      ...updated[offerIndex],
      documents: [...updated[offerIndex].documents, ...newFiles],
      documentPreviewUrls: [...updated[offerIndex].documentPreviewUrls, ...newPreviewUrls]
    }

    console.log('💾 Updated offer state:', { 
      offerIndex, 
      totalDocs: updated[offerIndex].documents.length,
      newDocsAdded: newFiles.length
    })

    setNewOffers(updated)
  }

  const removeDocument = (offerIndex: number, docIndex: number) => {
    const updated = [...newOffers]
    
    // Cleanup URL object
    URL.revokeObjectURL(updated[offerIndex].documentPreviewUrls[docIndex])
    
    updated[offerIndex] = {
      ...updated[offerIndex],
      documents: updated[offerIndex].documents.filter((_, i) => i !== docIndex),
      documentPreviewUrls: updated[offerIndex].documentPreviewUrls.filter((_, i) => i !== docIndex)
    }

    setNewOffers(updated)
  }

  const triggerCameraCapture = (offerIndex: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,application/pdf'
    input.capture = 'environment' // Arka kamera
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleDocumentUpload(offerIndex, target.files)
    }
    input.click()
  }

  const triggerFileSelect = (offerIndex: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,application/pdf'
    input.multiple = true
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleDocumentUpload(offerIndex, target.files)
    }
    input.click()
  }

  const openOfferModal = (offer: any) => {
    setSelectedOffer(offer)
    setIsModalOpen(true)
  }

  const closeOfferModal = () => {
    setSelectedOffer(null)
    setIsModalOpen(false)
  }

  const openApprovalModal = (offer: any) => {
    setOfferToApprove(offer)
    setIsApprovalModalOpen(true)
    setApprovalReason('')
  }

  const closeApprovalModal = () => {
    setOfferToApprove(null)
    setIsApprovalModalOpen(false)
    setApprovalReason('')
  }

  // Resim modal fonksiyonları
  const openImageModal = (url: string, alt: string, index: number, total: number) => {
    setSelectedImageModal({ url, alt, index, total })
  }

  const closeImageModal = () => {
    setSelectedImageModal(null)
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImageModal || !request?.image_urls) return
    
    const newIndex = direction === 'next' 
      ? (selectedImageModal.index + 1) % request.image_urls.length
      : (selectedImageModal.index - 1 + request.image_urls.length) % request.image_urls.length
    
    setSelectedImageModal({
      ...selectedImageModal,
      url: request.image_urls[newIndex],
      index: newIndex,
      alt: `Malzeme resmi ${newIndex + 1}`
    })
  }

  const isValidOffer = (offer: Offer) => {
    return offer.supplier_name.trim() !== '' && 
           offer.unit_price > 0 && 
           offer.delivery_days >= 0 && 
           offer.documents.length > 0 // Döküman zorunlu
  }

  const uploadDocuments = async (offerIndex: number, documents: File[]) => {
    console.log('🚀 uploadDocuments called with:', { offerIndex, documentsCount: documents.length })
    
    // Debug: Authentication ve session kontrolü
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('🔐 Current session:', session)
    console.log('🔐 Session error:', sessionError)
    console.log('🔐 User ID:', session?.user?.id)
    console.log('🔐 User role:', session?.user?.role)
    
    const uploadedUrls: string[] = []
    
    for (let i = 0; i < documents.length; i++) {
      const file = documents[i]
      const fileExt = file.name.split('.').pop()
      const uniqueId = Math.random().toString(36).substring(2, 15)
      const fileName = `offers/${requestId}_offer_${offerIndex}_doc_${i}_${Date.now()}_${uniqueId}.${fileExt}`
      
      console.log('📤 Uploading file:', { fileName, fileSize: file.size, fileType: file.type })
      
      try {
        const { data, error } = await supabase.storage
          .from('satinalma')
          .upload(fileName, file)

        console.log('📥 Upload response:', { data, error })

        if (error) {
          console.error('❌ Storage upload error:', error)
          throw error
        }

        const { data: urlData } = supabase.storage
          .from('satinalma')
          .getPublicUrl(fileName)

        console.log('🔗 Generated URL:', urlData.publicUrl)
        uploadedUrls.push(urlData.publicUrl)
      } catch (error) {
        console.error('❌ Döküman yükleme hatası:', error)
        // Hata durumunda işlemi durdur
        throw new Error(`Döküman yüklenirken hata oluştu: ${error}`)
      }
    }
    
    console.log('✅ Upload completed. URLs:', uploadedUrls)
    return uploadedUrls
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      const validOffers = newOffers.filter(isValidOffer)
      
      if (validOffers.length === 0) {
        showToast('En az bir geçerli teklif girmelisiniz. Tüm zorunlu alanları (döküman dahil) doldurun.', 'error')
        return
      }

      console.log('🚀 Starting offer submission process...')
      console.log('📋 Valid offers:', validOffers.map(o => ({ supplier: o.supplier_name, docs: o.documents.length })))

      // Dökümanları yükle ve URL'leri al
      console.log('🔄 Starting document uploads for offers:', validOffers.length)
      const offersWithDocuments = await Promise.all(
        validOffers.map(async (offer, index) => {
          console.log(`📋 Processing offer ${index + 1}:`, { supplier: offer.supplier_name, docCount: offer.documents.length })
          const documentUrls = await uploadDocuments(index, offer.documents)
          
          const processedOffer = {
            supplier_name: offer.supplier_name,
            unit_price: offer.unit_price,
            total_price: offer.total_price,
            delivery_days: offer.delivery_days,
            delivery_date: offer.delivery_date,
            notes: offer.notes,
            currency: offer.currency,
            document_urls: documentUrls // Döküman URL'leri
          }
          
          console.log(`✅ Processed offer ${index + 1}:`, processedOffer)
          return processedOffer
        })
      )

      console.log('📊 Final offers with documents:', offersWithDocuments)

      console.log('🚀 Calling addOffers function...')
      const result = await addOffers(requestId, offersWithDocuments)
      console.log('✅ addOffers result:', result)
      
      showToast('Teklifler başarıyla kaydedildi!', 'success')
      
      // Sayfayı yeniden yükle ve form temizle
      await fetchRequestData()
      await fetchExistingOffers()
      
      // Formu temizle
      setNewOffers([
        { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '', currency: 'TRY', documents: [], documentPreviewUrls: [] }
      ])
      
    } catch (error) {
      console.error('Error submitting offers:', error)
      showToast('Teklifler kaydedilirken hata oluştu.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproveOffer = async (offerId: string, reason?: string) => {
    try {
      setApproving(offerId)
      
      // Önce onaylanan teklifi al
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .select('total_price, currency')
        .eq('id', offerId)
        .single()
      
      if (offerError || !offer) {
        throw new Error('Teklif bilgisi alınamadı')
      }
      
      // Sadece teklifi onayla - status trigger otomatik güncelleyecek
      await supabase
        .from('offers')
        .update({ 
          is_selected: true,
          selected_at: new Date().toISOString(),
          approval_reason: reason || null
        })
        .eq('id', offerId)

      // Şantiye harcama tutarını güncelle
      if (request?.site_id && offer.total_price) {
        console.log('🏗️ Updating site expenses:', {
          siteId: request.site_id,
          siteName: request.site_name,
          amount: offer.total_price,
          currency: offer.currency
        })
        
        const expenseResult = await updateSiteExpenses(request.site_id, offer.total_price)
        if (expenseResult.success) {
          console.log('✅ Site expenses updated successfully:', expenseResult.newTotal)
        } else {
          console.error('❌ Failed to update site expenses:', expenseResult.error)
          // Hata durumunda kullanıcıyı bilgilendir ama işlemi durdurma
          showToast('Teklif onaylandı ancak şantiye harcama tutarı güncellenemedi.', 'info')
        }
      }

      showToast('Teklif başarıyla onaylandı!', 'success')
      
      // Sayfa verilerini yeniden yükle
      await fetchRequestData()
      await fetchExistingOffers()
      
    } catch (error) {
      console.error('Error approving offer:', error)
      showToast('Teklif onaylanırken hata oluştu.', 'error')
    } finally {
      setApproving(null)
    }
  }

  const confirmApproval = async () => {
    if (!offerToApprove || !approvalReason.trim()) {
      showToast('Lütfen onay nedenini belirtin.', 'error')
      return
    }

    await handleApproveOffer(offerToApprove.id, approvalReason.trim())
    closeApprovalModal()
  }

  // Santiye depo fonksiyonları
  const handleSendItem = () => {
    setIsSendModalOpen(true)
    setSendQuantities({})
  }

  const handleDepotNotAvailable = async () => {
    try {
      // Bu fonksiyon "Depoda Yok" durumunu işleyecek
      const { error } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'depoda mevcut değil',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (error) throw error
      
      showToast('Talep "Depoda Mevcut Değil" olarak işaretlendi.', 'info')
      await fetchRequestData()
      
      // Cache temizleme (tek seferlik)
      invalidatePurchaseRequestsCache()
      
    } catch (error) {
      console.error('Error updating depot status:', error)
      showToast('Durum güncellenirken hata oluştu.', 'error')
    }
  }

  // Tek malzeme gönderimi için özel fonksiyon (çifte işlem önleme)
  const handleSingleItemSend = async (item: any, sentQuantity: number) => {
    try {
      console.log('🚀 Tek malzeme gönderim başlatılıyor:', {
        itemId: item.id,
        itemName: item.item_name,
        sentQuantity,
        currentQuantity: item.quantity
      })

      // Kullanıcı bilgisini al
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı bilgisi alınamadı')
      }

      // Kalan miktar hesapla
      const remainingQuantity = item.quantity - sentQuantity
      const isFullyFulfilled = remainingQuantity <= 0

      console.log('📊 Tek malzeme hesaplamaları:', {
        sentQuantity,
        currentQuantity: item.quantity,
        remainingQuantity,
        isFullyFulfilled
      })

      // 1. Shipment kaydı oluştur
      const shipmentData = {
        purchase_request_id: requestId,
        purchase_request_item_id: item.id,
        shipped_quantity: sentQuantity,
        shipped_by: user.id,
        notes: `${item.item_name} - ${sentQuantity} ${item.unit} gönderildi`
      }

      console.log('📦 Shipment kaydı oluşturuluyor:', shipmentData)
      
      // Aynı item için çifte kayıt kontrolü
      const { data: existingShipments, error: checkError } = await supabase
        .from('shipments')
        .select('id, shipped_quantity, shipped_at')
        .eq('purchase_request_id', requestId)
        .eq('purchase_request_item_id', item.id)
        .order('shipped_at', { ascending: false })
        .limit(5)

      console.log('📦 Mevcut shipment kayıtları kontrol:', {
        itemId: item.id,
        itemName: item.item_name,
        existingShipments: existingShipments?.map(s => ({
          id: s.id,
          quantity: s.shipped_quantity,
          shipped_at: s.shipped_at
        })) || [],
        newQuantity: sentQuantity
      })
      
      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert(shipmentData)

      if (shipmentError) {
        console.error('❌ Shipment insert error:', shipmentError)
        throw shipmentError
      }

      console.log('✅ Shipment kaydı başarıyla oluşturuldu')

      // 2. Purchase request item'ı güncelle (sadece tam karşılanmadıysa)
      if (!isFullyFulfilled) {
        console.log('🔄 Purchase request item güncelleniyor:', {
          itemId: item.id,
          newQuantity: remainingQuantity
        })
        
        const { error: itemError } = await supabase
          .from('purchase_request_items')
          .update({ quantity: remainingQuantity })
          .eq('purchase_request_id', requestId)
          .eq('id', item.id)
        
        if (itemError) {
          console.error('❌ Item update error:', itemError)
          throw itemError
        }
        
        console.log('✅ Purchase request item güncellendi')
      }

      // 3. Status güncelleme (hem otomatik trigger hem de manuel backup)
      console.log('✅ Shipment ve item güncellemeleri tamamlandı, status güncelleniyor...')
      
      // İlk önce trigger çalışsın diye kısa bekle
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        // Manuel trigger çağrısı (trigger çalışmazsa backup)
        const { data: triggerResult, error: triggerError } = await supabase
          .rpc('update_purchase_request_status_manual', {
            request_id: requestId
          })
        
        if (triggerError) {
          console.log('⚠️ Manuel trigger hatası, direkt status güncellemesi yapılacak:', triggerError)
          
          // Fallback: Direkt status güncelleme
          const newStatus = isFullyFulfilled ? 'gönderildi' : 'kısmen gönderildi'
          const { error: directUpdateError } = await supabase
            .from('purchase_requests')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
          
          if (directUpdateError) {
            console.error('❌ Direkt status güncelleme de başarısız:', directUpdateError)
            // Hata olsa bile devam et, veriler yenilenecek
          } else {
            console.log('✅ Status direkt güncelleme ile başarıyla ayarlandı:', newStatus)
          }
        } else {
          console.log('✅ Status manuel trigger ile başarıyla güncellendi:', triggerResult)
        }
      } catch (error) {
        console.error('❌ Status güncelleme hatası:', error)
        // Hata olsa bile devam et, UI yenilendiğinde doğru status görünecek
      }

      // 4. Başarı mesajı
      showToast(
        isFullyFulfilled 
          ? `${item.item_name} tamamen gönderildi!` 
          : `${item.item_name}: ${sentQuantity} ${item.unit} gönderildi (Kalan: ${remainingQuantity} ${item.unit})`,
        'success'
      )

      // 5. Verileri yenile
      await fetchRequestData()
      await fetchShipmentData()
      
      // Cache temizleme (tek seferlik)
      invalidatePurchaseRequestsCache()

    } catch (error: any) {
      console.error('❌ Tek malzeme gönderim hatası:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        stack: error?.stack,
        itemId: item.id,
        itemName: item.item_name,
        sentQuantity,
        requestId,
        errorString: String(error)
      })
      throw error // Hatayı yukarı fırlat
    }
  }

  const confirmSendItem = async () => {
    const items = request?.purchase_request_items || []
    if (items.length === 0) {
      showToast('Ürün bilgisi bulunamadı.', 'error')
      return
    }

    // Tüm ürünler için gönderilecek miktarları kontrol et
    const sendData: Array<{
      item: any;
      sentQuantity: number;
      isFullyFulfilled: boolean;
      remainingQuantity: number;
    }> = []

    let hasValidQuantity = false

    for (const item of items) {
      const quantityStr = sendQuantities[item.id] || ''
      const sentQuantity = parseFloat(quantityStr)

      if (!quantityStr.trim() || sentQuantity <= 0) {
        continue // Bu ürün için miktar girilmemiş, atla
      }

      hasValidQuantity = true

      if (sentQuantity > item.quantity) {
        showToast(`${item.item_name} için gönderilen miktar talep edilen miktardan (${item.quantity} ${item.unit}) fazla olamaz.`, 'error')
        return
      }

      const isFullyFulfilled = sentQuantity >= item.quantity
      const remainingQuantity = item.quantity - sentQuantity

      sendData.push({
        item,
        sentQuantity,
        isFullyFulfilled,
        remainingQuantity
      })
    }

    if (!hasValidQuantity) {
      showToast('En az bir ürün için geçerli miktar girin.', 'error')
      return
    }

    try {
      setSendingItem(true)
      
      // Kullanıcı bilgisini al
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı bilgisi alınamadı')
      }

      // Tüm ürünlerin gönderilip gönderilmediğini kontrol et
      // Eğer tek ürün gönderimi yapılıyorsa ve o ürün tam gönderilmişse, genel durumu kontrol et
      let allItemsFullyFulfilled = false
      let hasPartialFulfillment = false
      
      if (sendData.length === 1) {
        // Tek ürün gönderimi durumu
        const singleItem = sendData[0]
        if (singleItem.isFullyFulfilled) {
          // Bu ürün tam gönderildi, diğer ürünlerin durumunu kontrol et
          // Kalan ürünlerin miktarı 0 veya zaten gönderilmiş mi kontrol et
          const otherItemsNeedShipping = items.some(item => {
            if (item.id === singleItem.item.id) return false // Şu an gönderilen ürünü atla
            return item.quantity > 0 // Kalan miktarı varsa henüz gönderilmemiş demektir
          })
          
          console.log('🔍 Single item shipment analysis:', {
            singleItemName: singleItem.item.item_name,
            singleItemFullyFulfilled: singleItem.isFullyFulfilled,
            otherItemsNeedShipping,
            allItemsStatus: items.map(item => ({
              name: item.item_name,
              quantity: item.quantity,
              id: item.id,
              isCurrentItem: item.id === singleItem.item.id
            }))
          })
          
          allItemsFullyFulfilled = !otherItemsNeedShipping
          hasPartialFulfillment = otherItemsNeedShipping
        } else {
          // Bu ürün kısmen gönderildi
          allItemsFullyFulfilled = false
          hasPartialFulfillment = true
        }
      } else {
        // Çoklu ürün gönderimi durumu
        console.log('🔍 Çoklu malzeme gönderimi analizi:', {
          sendDataLength: sendData.length,
          totalItemsLength: items.length,
          sendData: sendData.map(d => ({
            itemName: d.item.item_name,
            sentQuantity: d.sentQuantity,
            isFullyFulfilled: d.isFullyFulfilled
          }))
        })
        
        // Tüm malzemeler için gönderim durumunu kontrol et
        let totalItemsProcessed = 0
        let fullyFulfilledCount = 0
        
        // Gönderilen malzemeleri say
        sendData.forEach(data => {
          totalItemsProcessed++
          if (data.isFullyFulfilled) {
            fullyFulfilledCount++
          }
        })
        
        // Gönderilmeyen malzemeleri de kontrol et (kalan miktar > 0)
        items.forEach(item => {
          const wasProcessed = sendData.some(data => data.item.id === item.id)
          if (!wasProcessed && item.quantity > 0) {
            // Bu malzeme hiç gönderilmedi ve hala miktarı var
            totalItemsProcessed++
          }
        })
        
        // Durum analizi
        if (fullyFulfilledCount === items.length) {
          // Tüm malzemeler tam karşılandı
          allItemsFullyFulfilled = true
          hasPartialFulfillment = false
        } else if (sendData.length > 0) {
          // En az bir malzeme gönderildi ama tam değil
          allItemsFullyFulfilled = false
          hasPartialFulfillment = true
        } else {
          // Hiçbir malzeme gönderilmedi (bu duruma normalde gelmemeli)
          allItemsFullyFulfilled = false
          hasPartialFulfillment = false
        }
        
        console.log('📊 Çoklu gönderim sonucu:', {
          allItemsFullyFulfilled,
          hasPartialFulfillment,
          fullyFulfilledCount,
          totalItems: items.length,
          sendDataLength: sendData.length
        })
      }
      
      // Request status'unu belirle
      const newStatus = allItemsFullyFulfilled ? 'gönderildi' : 'kısmen gönderildi'
      
      console.log('🔄 Updating purchase request status:', {
        requestId,
        newStatus,
        sendDataCount: sendData.length,
        totalItems: items.length,
        allItemsFullyFulfilled,
        hasPartialFulfillment
      })
      
      // 1. Her gönderim için shipments tablosuna kayıt ekle
      const shipmentInserts = sendData.map(data => ({
        purchase_request_id: requestId,
        purchase_request_item_id: data.item.id,
        shipped_quantity: data.sentQuantity,
        shipped_by: user.id,
        notes: `${data.item.item_name} - ${data.sentQuantity} ${data.item.unit} gönderildi`
      }))

      console.log('📦 Inserting shipment records:', shipmentInserts)
      
      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert(shipmentInserts)

      if (shipmentError) {
        console.error('❌ Shipment insert error:', shipmentError)
        throw shipmentError
      }

      console.log('✅ Shipment records inserted successfully')
      
      // Robust status güncelleme sistemi
      console.log('🔄 Status güncelleniyor:', newStatus)
      
      // İlk önce trigger çalışsın diye kısa bekle
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        // Manuel trigger çağrısı (trigger çalışmazsa backup)
        const { data: triggerResult, error: triggerError } = await supabase
          .rpc('update_purchase_request_status_manual', {
            request_id: requestId
          })
        
        if (triggerError) {
          console.log('⚠️ Manuel trigger hatası, direkt status güncellemesi yapılacak:', triggerError)
          
          // Fallback: Direkt status güncelleme
          const { error: directUpdateError } = await supabase
            .from('purchase_requests')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
          
          if (directUpdateError) {
            console.error('❌ Direkt status güncelleme de başarısız:', directUpdateError)
            throw directUpdateError
          } else {
            console.log('✅ Status direkt güncelleme ile başarıyla ayarlandı:', newStatus)
          }
        } else {
          console.log('✅ Status manuel trigger ile başarıyla güncellendi:', triggerResult)
        }
      } catch (error) {
        console.error('❌ Status güncelleme hatası:', error)
        throw error
      }
      
      // 3. Her ürün için purchase_request_items tablosunu güncelle
      for (const data of sendData) {
        if (!data.isFullyFulfilled) {
          console.log('🔄 Updating purchase request item quantity:', {
            itemId: data.item.id,
            itemName: data.item.item_name,
            remainingQuantity: data.remainingQuantity,
            originalQuantity: data.item.quantity
          })
          
          const { error: itemError } = await supabase
            .from('purchase_request_items')
            .update({ 
              quantity: data.remainingQuantity
            })
            .eq('purchase_request_id', requestId)
            .eq('id', data.item.id)
          
          if (itemError) {
            console.error('❌ Item update error:', itemError)
            throw itemError
          }
          
          console.log('✅ Purchase request item updated successfully')
        }
      }
      
      // Başarı mesajı
      const sentItems = sendData.map(data => 
        `${data.item.item_name}: ${data.sentQuantity} ${data.item.unit}${!data.isFullyFulfilled ? ` (Kalan: ${data.remainingQuantity})` : ''}`
      )
      
      showToast(
        allItemsFullyFulfilled 
          ? 'Tüm malzemeler gönderildi!' 
          : `Malzemeler gönderildi:\n${sentItems.join('\n')}`, 
        'success'
      )
      
      setIsSendModalOpen(false)
      setSendQuantities({})
      
      // Verileri yenile
      await fetchRequestData()
      await fetchShipmentData()
      
      // Cache temizleme (tek seferlik)
      invalidatePurchaseRequestsCache()
      
    } catch (error: any) {
      console.error('❌ Error sending items:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        requestId,
        sendData
      })
      showToast(
        error?.message || 'Gönderim işlemi sırasında hata oluştu.',
        'error'
      )
    } finally {
      setSendingItem(false)
    }
  }

  const handleSiteManagerApproval = async () => {
    setSiteManagerApproving(true)
    
    try {
      console.log('🚀 Site Manager onayı başlatılıyor...', {
        requestId,
        currentStatus: request?.status,
        userRole
      })

      // Kullanıcı oturum kontrolü
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.')
      }

      console.log('✅ Kullanıcı oturumu doğrulandı:', user.id)

      // Önce direkt update'i dene
      let updateResult, error;
      
      try {
        // Method 1: Direkt update
        const result = await supabase
          .from('purchase_requests')
          .update({ 
            status: 'satın almaya gönderildi',
            updated_at: new Date().toISOString()
          })
          .eq('id', requestId)
          .select();
          
        updateResult = result.data;
        error = result.error;
        
        console.log('🔍 Direkt update sonucu:', { updateResult, error });

        // Başarılı update sonrası approval history kaydı ekle
        if (!error && updateResult) {
          const { error: historyError } = await supabase
            .from('approval_history')
            .insert({
              purchase_request_id: requestId,
              action: 'approved',
              performed_by: user.id,
              comments: 'Site Manager tarafından satın almaya gönderildi'
            });

          if (historyError) {
            console.error('⚠️ Approval history kaydı eklenirken hata:', historyError);
          } else {
            console.log('✅ Approval history kaydı eklendi');
          }
        }
        
      } catch (directError) {
        console.log('⚠️ Direkt update başarısız, stored procedure deneniyor...', directError);
        
        // Method 2: Stored procedure ile
        try {
          const { data: procResult, error: procError } = await supabase
            .rpc('update_request_status_by_site_manager', {
              request_id: requestId,
              new_status: 'satın almaya gönderildi'
            });
            
          console.log('🔍 Stored procedure sonucu:', { procResult, procError });
          
          if (procError) {
            error = procError;
          } else {
            // Başarılı ise veriyi tekrar çek
            const { data: refetchedData } = await supabase
              .from('purchase_requests')
              .select('*')
              .eq('id', requestId)
              .single();
            updateResult = refetchedData ? [refetchedData] : null;
          }
        } catch (procError) {
          console.error('❌ Stored procedure de başarısız:', procError);
          error = procError;
        }
      }

      console.log('📊 Update sonucu:', { updateResult, error })

      if (error) {
        console.error('❌ Update hatası:', error)
        
        // RLS hatası ise özel mesaj
        if (error.message?.includes('policy') || error.message?.includes('permission') || error.code === '42501') {
          throw new Error(`Yetki hatası: Site manager rolünüz ile bu işlemi yapmaya yetkiniz yok. Lütfen sistem yöneticinize başvurun.\n\nDetay: ${error.message}`)
        }
        
        throw error
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error('Status güncellendi ancak sonuç alınamadı. Sayfayı yenileyip kontrol edin.')
      }

      console.log('✅ Status başarıyla güncellendi:', updateResult[0])
      showToast('Malzemeler satın almaya gönderildi!', 'success')
      
      // Sayfayı yenile
      await fetchRequestData()
      invalidatePurchaseRequestsCache()
      
    } catch (error: any) {
      console.error('❌ Site Manager onay hatası:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        requestId
      })
      showToast('Hata oluştu: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setSiteManagerApproving(false)
    }
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'normal': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'low': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'şantiye şefi onayladı': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'awaiting_offers': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'approved': return 'bg-green-100 text-green-700 border-green-200'
      case 'sipariş verildi': return 'bg-green-100 text-green-700 border-green-200'
      case 'gönderildi': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'kısmen gönderildi': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'depoda mevcut değil': return 'bg-red-100 text-red-700 border-red-200'
      case 'eksik onaylandı': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'alternatif onaylandı': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'satın almaya gönderildi': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'eksik malzemeler talep edildi': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-medium">Talep bilgileri yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Talep Bulunamadı</h3>
          <p className="text-gray-600 mb-6">Aradığınız talep mevcut değil veya erişim izniniz yok.</p>
          <Button 
            onClick={() => router.push('/dashboard/requests')}
            className="bg-gray-800 hover:bg-gray-900 rounded-xl px-6 py-3 font-medium"
          >
            Taleplere Dön
          </Button>
        </div>
      </div>
    )
  }

  const totalOffers = existingOffers.length
  const items = request?.purchase_request_items || []
  const firstItem = items[0] // Backward compatibility için

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sade Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between h-16">
            {/* Sol taraf - Geri butonu ve başlık */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/requests')}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 h-9"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Geri</span>
              </Button>
              <div className="w-px h-6 bg-gray-200"></div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Teklif Girişi</h1>
                <p className="text-sm text-gray-500">{request.request_number}</p>
              </div>
            </div>

            {/* Sağ taraf - Status badge'leri ve Site Manager butonu */}
            <div className="flex items-center gap-3">
              <Badge className={`border ${getUrgencyColor(request.urgency_level)} text-xs px-2 py-1`}>
                {request.urgency_level === 'critical' ? 'Kritik' : 
                 request.urgency_level === 'high' ? 'Yüksek' :
                 request.urgency_level === 'normal' ? 'Normal' : 'Düşük'}
              </Badge>
              <Badge className={`border ${getStatusColor(request.status)} text-xs px-2 py-1`}>
                {request.status === 'pending' ? 'Beklemede' :
                 request.status === 'şantiye şefi onayladı' ? 'Şantiye Şefi Onayladı' :
                 request.status === 'awaiting_offers' ? 'Onay Bekliyor' :
                 request.status === 'sipariş verildi' ? 'Sipariş Verildi' :
                 request.status === 'gönderildi' ? 'Gönderildi' :
                 request.status === 'kısmen gönderildi' ? 'Kısmen Gönderildi' :
                 request.status === 'depoda mevcut değil' ? 'Depoda Mevcut Değil' :
                 request.status === 'eksik onaylandı' ? 'Eksik Onaylandı' :
                 request.status === 'alternatif onaylandı' ? 'Alternatif Onaylandı' :
                 request.status === 'satın almaya gönderildi' ? 'Satın Almaya Gönderildi' :
                 request.status === 'eksik malzemeler talep edildi' ? 'Eksik Malzemeler Talep Edildi' : request.status}
              </Badge>
              
              {/* Site Manager için Satın Almaya Gönder butonu */}
              {userRole === 'site_manager' && 
               (request.status === 'kısmen gönderildi' || request.status === 'depoda mevcut değil') && (
                <Button
                  onClick={handleSiteManagerApproval}
                  disabled={siteManagerApproving}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 h-9 rounded-lg"
                >
                  {siteManagerApproving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Gönderiliyor...
                    </>
                  ) : (
                    'Satın Almaya Gönder'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden">
            {/* Tek satır - Geri butonu, başlık ve onay butonu */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/dashboard/requests')}
                  className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 h-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Geri</span>
                </Button>
                <div>
                  <h1 className="text-base font-semibold text-gray-900">Teklif Girişi</h1>
                  <p className="text-xs text-gray-500">{request.request_number}</p>
                </div>
              </div>
              
              {/* Mobile Site Manager butonu */}
              {userRole === 'site_manager' && 
               (request.status === 'kısmen gönderildi' || request.status === 'depoda mevcut değil') && (
                <Button
                  onClick={handleSiteManagerApproval}
                  disabled={siteManagerApproving}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 h-8 rounded-lg"
                >
                  {siteManagerApproving ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Gönderiliyor...
                    </>
                  ) : (
                    'Satın Almaya Gönder'
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-8">
          
          {/* Şantiye Bilgisi - Sade */}
          <div className="mb-4 sm:mb-8">
            {request.site_name ? (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.site_name}</h2>
            ) : request.sites ? (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.sites.name}</h2>
            ) : request.construction_sites ? (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.construction_sites.name}</h2>
            ) : (
              <h2 className="text-xl sm:text-3xl font-semibold text-gray-900">{request.department} Şantiyesi</h2>
            )}
          </div>

          {/* Talep Detayları - Tek Kolon */}
          <div className="mb-4 sm:mb-8">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">Talep Detayları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Başlık</p>
                  <p className="text-lg font-medium text-gray-900">{request.title}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Departman</p>
                    <p className="text-base text-gray-900">{request.department}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Talep Eden</p>
                    <p className="text-base text-gray-900">{request.profiles?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Talep Tarihi</p>
                    <p className="text-base text-gray-900">{new Date(request.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  {/* Kategori Bilgileri */}
                  {request.category_name && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-500 mb-2">Malzeme Kategorisi</p>
                      <p className="text-base text-gray-900">{request.category_name}</p>
                      {request.subcategory_name && (
                        <p className="text-sm text-gray-600 mt-1">→ {request.subcategory_name}</p>
                      )}
                    </div>
                  )}
                  {/* Malzeme Sınıf ve Grup Bilgileri */}
                  {(request.material_class || request.material_group) && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-sm font-medium text-gray-500 mb-2">Malzeme Sınıflandırması</p>
                      <div className="flex flex-wrap items-center gap-3">
                      {request.material_class && (
                          <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium">Sınıf</span>
                          <p className="text-base text-gray-900">{request.material_class}</p>
                        </div>
                      )}
                      {request.material_group && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium">Grup</span>
                          <p className="text-base text-gray-900">{request.material_group}</p>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>
                  {request.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Açıklama</p>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4">{request.description}</p>
                    </div>
                  )}
              </CardContent>
            </Card>
                </div>

          {/* Malzeme Bazlı Tedarikçi/Sipariş Yönetimi - Tüm roller için (santiye_depo hariç ayrı bölümde) */}
          {request?.purchase_request_items && request.purchase_request_items.length > 0 && userRole !== 'santiye_depo' && (
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-gray-900">
                      {(userRole === 'site_personnel' || userRole === 'site_manager') ? 
                        'Malzeme Durumu ve Teslimat Bilgileri' : 
                        'Malzeme Tedarikçi Yönetimi'
                      }
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {(userRole === 'site_personnel' || userRole === 'site_manager') ? 
                        'Malzemeler için gönderim durumu ve teslimat tarihleri' : 
                        'Her malzeme için tedarikçi ataması ve sipariş yönetimi'
                      }
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {request.purchase_request_items.map((item, index) => {
                    const materialSupplier = materialSuppliers[item.id] || { isRegistered: false, suppliers: [] }
                    
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        {/* Malzeme Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {request.purchase_request_items.length > 1 && (
                                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </div>
                              )}
                              <h4 className="text-lg font-semibold text-gray-900">{item.item_name}</h4>
                              {item.brand && (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {item.brand}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-4">
                                <span>Miktar: <strong>{item.quantity} {item.unit}</strong></span>
                                {item.specifications && (
                                  <span className="text-xs text-gray-500">• {item.specifications}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Tedarikçi Durumu Badge */}
                          <div className="text-right">
                            {materialSupplier.isRegistered ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                ✓ {materialSupplier.suppliers.length} Tedarikçi
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                                Tedarikçi Yok
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Site personnel ve site manager için sadeleştirilmiş görünüm */}
                        {(userRole === 'site_personnel' || userRole === 'site_manager') ? (
                          <div className="space-y-3">
                            {/* Gönderim Durumu */}
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Gönderilen Miktar */}
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Gönderilen</div>
                                  <div className="text-lg font-bold text-green-900">
                                    {(() => {
                                      const itemShipments = shipmentData[item.id]
                                      const totalShipped = itemShipments?.total_shipped || 0
                                      
                                      console.log(`📊 Gönderilen miktar hesaplama (${item.item_name}):`, {
                                        itemId: item.id,
                                        itemName: item.item_name,
                                        shipmentData: itemShipments,
                                        totalShipped,
                                        rawShipments: itemShipments?.shipments?.map(s => ({
                                          id: s.id,
                                          quantity: s.shipped_quantity,
                                          shipped_at: s.shipped_at
                                        }))
                                      })
                                      
                                      return `${totalShipped.toFixed(2)} ${item.unit}`
                                    })()}
                                  </div>
                                  {(() => {
                                    const itemShipments = shipmentData[item.id]
                                    const totalShipped = itemShipments?.total_shipped || 0
                                    if (totalShipped > 0) {
                                      // Yüzde hesaplaması: gönderilen / ilk talep
                                      const originalRequest = item.original_quantity || (item.quantity + totalShipped)
                                      const percentage = ((totalShipped / originalRequest) * 100).toFixed(1)
                                      return (
                                        <div className="text-xs text-green-700 mt-1">
                                          %{percentage} tamamlandı
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                                
                                {/* Talep Edilen İlk Miktar */}
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">İlk Talep</div>
                                  <div className="text-lg font-bold text-blue-900">
                                    {(() => {
                                      // Santiye depo mantığını uygula: İlk talep = original_quantity || (current + shipped)
                                      const itemShipments = shipmentData[item.id]
                                      const totalShipped = itemShipments?.total_shipped || 0
                                      const originalRequest = item.original_quantity || (item.quantity + totalShipped)
                                      
                                      console.log(`📊 Site Manager/Personnel İlk Talep hesaplama (${item.item_name}):`, {
                                        itemId: item.id,
                                        itemName: item.item_name,
                                        original_quantity_field: item.original_quantity,
                                        current_quantity_field: item.quantity,
                                        totalShipped,
                                        calculated_original: originalRequest,
                                        userRole
                                      })
                                      
                                      return `${originalRequest.toFixed(2)} ${item.unit}`
                                    })()}
                                  </div>
                                  {(() => {
                                    const itemShipments = shipmentData[item.id]
                                    const totalShipped = itemShipments?.total_shipped || 0
                                    if (item.quantity === 0) {
                                      return (
                                        <div className="text-xs text-green-700 mt-1">Tamamlandı</div>
                                      )
                                    } else if (totalShipped > 0) {
                                      return (
                                        <div className="text-xs text-orange-700 mt-1">Kalan: {item.quantity} {item.unit}</div>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                                
                                {/* Teslimat Tarihi */}
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <div className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Teslimat Tarihi</div>
                                  {(() => {
                                    // Bu malzeme için sipariş varsa teslimat tarihini göster
                                    const materialBasedKey = `${item.id}_${materialSuppliers[item.id]?.suppliers?.[0]?.id}`
                                    let orderInfo = materialOrders[materialBasedKey]
                                    
                                    // Bulamazsa genel supplier key'i ile ara
                                    if (!orderInfo && materialSuppliers[item.id]?.suppliers?.[0]) {
                                      orderInfo = materialOrders[materialSuppliers[item.id].suppliers[0].id]
                                    }
                                    
                                    if (orderInfo) {
                                      return (
                                        <div className="text-lg font-bold text-blue-900">
                                          {new Date(orderInfo.delivery_date).toLocaleDateString('tr-TR')}
                                        </div>
                                      )
                                    }
                                    return (
                                      <div className="text-sm text-gray-500">
                                        Henüz sipariş verilmedi
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : materialSupplier.isRegistered && materialSupplier.suppliers.length > 0 ? (
                          <div className="space-y-3">
                            <h5 className="text-sm font-medium text-gray-700">Kayıtlı Tedarikçiler:</h5>
                            <div className="grid gap-3">
                              {materialSupplier.suppliers.map((supplier, supplierIndex) => {
                                // Önce local tracking'den kontrol et (daha güncel)
                                const localTrackingKey = `${item.id}_${supplier.id}`
                                const localOrder = localOrderTracking[localTrackingKey]
                                
                                // Material item ID ile direkt sipariş ara
                                const materialBasedKey = `${item.id}_${supplier.id}`
                                let existingOrder = materialOrders[materialBasedKey]
                                
                                // Bulamazsa genel supplier key'i ile ara (geriye uyumluluk)
                                if (!existingOrder) {
                                  existingOrder = materialOrders[supplier.id]
                                }
                                
                                // Local tracking varsa onu kullan, yoksa database'den gelen bilgiyi kullan
                                const orderToShow = localOrder ? {
                                  id: localOrder.order_id,
                                  delivery_date: localOrder.delivery_date,
                                  supplier_name: localOrder.supplier_name,
                                  created_at: new Date().toISOString(),
                                  material_item_id: localOrder.material_item_id
                                } : existingOrder
                                
                                return (
                                  <div key={supplier.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h6 className="font-medium text-gray-900">{supplier.name}</h6>
                                        <p className="text-xs text-gray-600">{supplier.contact_person}</p>
                                        <div className="flex items-center gap-4 mt-1">
                                          <span className="text-xs text-gray-500">{supplier.phone}</span>
                                          <span className="text-xs text-gray-500">{supplier.email}</span>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                                          className="text-gray-700 border-gray-200 hover:bg-gray-50 text-xs"
                                        >
                                          Detay
                                        </Button>
                                        {orderToShow ? (
                                          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                            <div className="flex items-center gap-2 mb-1">
                                              <Check className="h-3 w-3 text-green-600" />
                                              <span className="text-xs font-medium text-green-800">Sipariş Verildi</span>
                                              {localOrder && (
                                                <span className="text-xs text-green-600">(Bu malzeme için)</span>
                                              )}
                                            </div>
                                            <div className="text-xs text-green-700">
                                              <div className="font-medium">Teslimat: {new Date(orderToShow.delivery_date).toLocaleDateString('tr-TR')}</div>
                                              <div className="text-green-600 mt-1">
                                                Sipariş ID: #{orderToShow.id.slice(-8)}
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setSelectedSupplier(supplier)
                                              setCurrentMaterialForAssignment({
                                                id: item.id,
                                                name: item.item_name,
                                                unit: item.unit
                                              })
                                              setIsCreateOrderModalOpen(true)
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                                          >
                                            <Package className="h-3 w-3 mr-1" />
                                            Sipariş Oluştur
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <>
                            {(userRole === 'site_personnel' || userRole === 'site_manager') ? (
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="text-center py-6">
                                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Package className="w-6 h-6 text-gray-400" />
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">Bu malzeme için henüz sipariş verilmemiş</p>
                                  <p className="text-xs text-gray-500">Satın alma sorumlusu tarafından tedarikçi ataması ve sipariş işlemi yapılması bekleniyor</p>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <div className="mb-3">
                                  <p className="text-sm text-gray-600 mb-2">Bu malzeme için henüz tedarikçi atanmamış</p>
                                </div>
                                <Button
                                  onClick={() => {
                                    setCurrentMaterialForAssignment({
                                      id: item.id,
                                      name: item.item_name,
                                      unit: item.unit
                                    })
                                    setIsAssignSupplierModalOpen(true)
                                  }}
                                  className="bg-black hover:bg-gray-900 text-white rounded-md"
                                >
                                  <Building2 className="h-4 w-4 mr-2" />
                                  Tedarikçi Ata
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* Genel Bilgilendirme */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs">i</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">
                        {(userRole === 'site_personnel' || userRole === 'site_manager') ? 
                          'Malzeme Durumu Takip Sistemi' : 
                          'Malzeme Tedarikçi Sistemi'
                        }
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        {(userRole === 'site_personnel' || userRole === 'site_manager') ? 
                          'Bu sayfada her malzeme için gönderim durumunu, kalan miktarları ve teslimat tarihlerini takip edebilirsiniz.' :
                          'Her malzeme için ayrı tedarikçi atayabilir ve direkt sipariş oluşturabilirsiniz. Tedarikçi atanmamış malzemeler için manuel teklif girişi yapılabilir.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


          {/* Mevcut Teklifler - Eğer varsa */}
          {existingOffers.length > 0 && (
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold text-gray-900">Mevcut Teklifler</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{totalOffers}/3 teklif girildi</p>
                  </div>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                    {totalOffers} Teklif
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
                {existingOffers.map((offer, index) => (
                  <Card key={offer.id} className={`bg-gray-50 border-0 shadow-sm hover:shadow-md transition-all duration-200 ${
                    offer.is_selected 
                      ? 'ring-2 ring-green-200 bg-green-50' 
                      : ''
                  }`}>
                    <CardContent className="p-6">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <span className="text-sm font-medium text-gray-700">{index + 1}</span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-base">{offer.supplier_name}</h4>
                            {offer.is_selected && (
                              <Badge className="bg-green-100 text-green-700 text-xs mt-1 border-0">
                                ✓ Seçildi
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-white border-gray-200 text-gray-600">
                          {offer.delivery_days} gün
                        </Badge>
                      </div>
                    
                    {/* Fiyat Bilgileri */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500 mb-1">Birim Fiyat</div>
                        <div className="text-lg font-semibold text-gray-900">{getCurrencySymbol(offer.currency || 'TRY')}{Number(offer.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500 mb-1">Toplam Tutar</div>
                        <div className="text-xl font-semibold text-gray-900">{getCurrencySymbol(offer.currency || 'TRY')}{Number(offer.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                    
                    {offer.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-500 mb-2">Notlar</div>
                        <p className="text-gray-700 text-sm leading-relaxed bg-white rounded-lg p-3">{offer.notes}</p>
                      </div>
                    )}

                    {/* Döküman Önizlemeleri */}
                    {offer.document_urls && offer.document_urls.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-500 mb-3">Dökümanlar ({offer.document_urls.length})</div>
                        <div className="grid grid-cols-3 gap-2">
                          {offer.document_urls.slice(0, 3).map((url: string, docIndex: number) => (
                            <div 
                              key={docIndex} 
                              className="aspect-square bg-white rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 border border-gray-200"
                              onClick={() => window.open(url, '_blank')}
                            >
                              {url.includes('.pdf') ? (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                  <FileText className="w-6 h-6 text-gray-400 mb-1" />
                                  <span className="text-xs text-gray-500 font-medium">PDF</span>
                                </div>
                              ) : (
                                <img
                                  src={url}
                                  alt={`Döküman ${docIndex + 1}`}
                                  className="w-full h-full object-cover"
                                  onLoad={() => {
                                    console.log('✅ Image loaded successfully:', url)
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Image failed to load:', url)
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement!.innerHTML = `
                                      <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                                        <div class="w-6 h-6 text-gray-400 mb-1">📷</div>
                                        <span class="text-xs text-gray-500 font-medium">Resim</span>
                                      </div>
                                    `;
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Butonlar */}
                    <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                      {/* Teklifi İncele Butonu */}
                      <Button
                        onClick={() => openOfferModal(offer)}
                        variant="outline"
                        className="w-full h-10 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 font-medium rounded-lg"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Teklifi İncele
                      </Button>
                      
                      {/* Bunu Seç Butonu - Site personeli, santiye depo ve site manager göremez */}
                      {userRole !== 'site_personnel' && userRole !== 'site_manager' && userRole !== 'santiye_depo' && (
                        <Button
                          onClick={() => openApprovalModal(offer)}
                          disabled={approving === offer.id || request?.status === 'approved'}
                          className={`w-full h-10 font-medium rounded-lg transition-all duration-200 ${
                            offer.is_selected 
                              ? 'bg-green-600 hover:bg-green-700 text-white' 
                              : 'bg-gray-900 hover:bg-gray-800 text-white'
                          } disabled:opacity-50`}
                        >
                          {approving === offer.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Onaylanıyor...
                            </>
                          ) : request?.status === 'approved' ? (
                            'Onaylandı'
                          ) : offer.is_selected ? (
                            '✓ Seçildi'
                          ) : (
                            'Bu Teklifi Onayla'
                          )}
                        </Button>
                      )}
                    </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {totalOffers >= 3 && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                    <p className="text-gray-700 font-medium">3 teklif tamamlandı - Onay bekliyor</p>
                  </div>
                </div>
              )}
              </CardContent>
            </Card>
          )}

          {/* Şantiye Depo için Malzeme Listesi ve Gönderim İşlemleri */}
          {userRole === 'santiye_depo' && request?.purchase_request_items && request.purchase_request_items.length > 0 && (
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-gray-900">Depo İşlemleri</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Talep edilen malzemeleri kontrol edin ve gönderim yapın</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {request.purchase_request_items.map((item, index) => {
                    const itemShipments = shipmentData[item.id]
                    const totalShipped = itemShipments?.total_shipped || 0
                    const isShipped = totalShipped > 0 // Gönderim yapılmış mı?
                    const originalQuantity = item.original_quantity || (item.quantity + totalShipped) // İlk talep miktarı
                    const remainingQuantity = item.quantity // Database'de zaten kalan miktar tutuluyor
                    
                    console.log(`📊 Santiye Depo hesaplaması (${item.item_name}):`, {
                      itemId: item.id,
                      itemName: item.item_name,
                      original_quantity_field: item.original_quantity,
                      current_quantity_field: item.quantity,
                      totalShipped,
                      calculated_original: originalQuantity,
                      remaining_used: remainingQuantity
                    })
                    
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        {/* Malzeme Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {request.purchase_request_items.length > 1 && (
                                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </div>
                              )}
                              <h5 className="text-lg font-semibold text-gray-900">{item.item_name}</h5>
                              {item.brand && (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {item.brand}
                                </Badge>
                              )}
                            </div>
                            {item.specifications && (
                              <div className="text-xs text-gray-500 mt-2 bg-white p-2 rounded">
                                Açıklama: {item.specifications}
                              </div>
                            )}
                          </div>
                          
                          {/* Durum Badge */}
                          <div>
                            {isShipped ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                ✓ Gönderildi
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                ⏳ Bekliyor
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Miktar Bilgileri - Sadece Görüntüleme */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          {/* İlk Talep - Hiç değişmez */}
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="text-xs font-medium text-blue-600 mb-1 uppercase tracking-wide">İlk Talep</div>
                            <div className="text-lg font-bold text-blue-900">{originalQuantity} {item.unit}</div>
                          </div>
                          
                          {/* Gönderilen - Net gönderilen miktar */}
                          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="text-xs font-medium text-green-600 mb-1 uppercase tracking-wide">Gönderilen</div>
                            <div className="text-lg font-bold text-green-900">{totalShipped.toFixed(2)} {item.unit}</div>
                          </div>
                          
                          {/* Kalan - İlk talep - gönderilen */}
                          <div className={`rounded-lg p-3 border ${
                            remainingQuantity <= 0 
                              ? 'bg-gray-50 border-gray-200' 
                              : 'bg-orange-50 border-orange-200'
                          }`}>
                            <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
                              remainingQuantity <= 0 ? 'text-gray-600' : 'text-orange-600'
                            }`}>
                              Kalan
                            </div>
                            <div className={`text-lg font-bold ${
                              remainingQuantity <= 0 ? 'text-gray-600' : 'text-orange-900'
                            }`}>
                              {Math.max(0, remainingQuantity).toFixed(2)} {item.unit}
                            </div>
                          </div>
                        </div>

                        {/* Gönderim İşlemleri - Sadece henüz gönderilmemişse göster */}
                        {!isShipped ? (
                          <div className="space-y-3">
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <h6 className="text-sm font-medium text-gray-700 mb-3">Gönderim İşlemleri</h6>
                              <div className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-4">
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Gönderilecek Miktar
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={originalQuantity}
                                    value={sendQuantities[item.id] || ''}
                                    onChange={(e) => setSendQuantities(prev => ({
                                      ...prev,
                                      [item.id]: e.target.value
                                    }))}
                                    placeholder={`Max: ${originalQuantity}`}
                                    className="h-10 bg-white"
                                  />
                                </div>
                                <div className="col-span-2 text-center">
                                  <span className="text-sm font-medium text-gray-600">{item.unit}</span>
                                </div>
                                <div className="col-span-3">
                                  <Button
                                    onClick={async () => {
                                      const quantity = sendQuantities[item.id]
                                      if (!quantity?.trim() || parseFloat(quantity) <= 0) {
                                        showToast('Geçerli bir miktar girin.', 'error')
                                        return
                                      }
                                      
                                      if (parseFloat(quantity) > originalQuantity) {
                                        showToast(`Maksimum ${originalQuantity} ${item.unit} gönderebilirsiniz.`, 'error')
                                        return
                                      }
                                      
                                      // Çifte işlem önleme - sadece bu malzeme için gönderim yap
                                      if (sendingItem) {
                                        console.log('⚠️ Zaten gönderim işlemi devam ediyor, tekrar çağrı engellendi')
                                        return
                                      }
                                      
                                      try {
                                        setSendingItem(true)
                                        
                                        // Tek malzeme gönderimi için özel fonksiyon
                                        await handleSingleItemSend(item, parseFloat(quantity))
                                        
                                        // Gönderim başarılı, state temizle
                                        setSendQuantities(prev => ({
                                          ...prev,
                                          [item.id]: ''
                                        }))
                                        
                                      } catch (error) {
                                        console.error('❌ Tek malzeme gönderim hatası:', error)
                                        showToast('Gönderim sırasında hata oluştu.', 'error')
                                      } finally {
                                        setSendingItem(false)
                                      }
                                    }}
                                    disabled={!sendQuantities[item.id]?.trim() || parseFloat(sendQuantities[item.id] || '0') <= 0 || sendingItem}
                                    className="w-full h-10 bg-green-600 hover:bg-green-700 text-white text-xs"
                                  >
                                    {sendingItem ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                    ) : (
                                      <Package className="h-3 w-3 mr-1" />
                                    )}
                                    Gönder
                                  </Button>
                                </div>
                                <div className="col-span-3">
                                  <Button
                                    onClick={handleDepotNotAvailable}
                                    variant="outline"
                                    className="w-full h-10 border-red-200 text-red-700 hover:bg-red-50 text-xs"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Depoda Yok
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Gönderim Tamamlandı Mesajı */
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800">
                                Bu malzeme başarıyla gönderildi
                              </span>
                            </div>
                            {itemShipments && itemShipments.shipments.length > 0 && (
                              <div className="mt-2 text-xs text-green-700">
                                Gönderim tarihi: {new Date(itemShipments.shipments[0].shipped_at).toLocaleDateString('tr-TR')}
                                {itemShipments.shipments[0].profiles?.full_name && (
                                  <span className="ml-2">• {itemShipments.shipments[0].profiles.full_name}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Genel Durum Özeti */}
                {(() => {
                  const shippedCount = request.purchase_request_items.filter(item => {
                    const itemShipments = shipmentData[item.id]
                    return (itemShipments?.total_shipped || 0) > 0
                  }).length
                  
                  const totalCount = request.purchase_request_items.length
                  
                  if (shippedCount === totalCount) {
                    return (
                      <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-200">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-green-900">Tüm Malzemeler Gönderildi</h4>
                            <p className="text-sm text-green-700">
                              Bu talep için tüm malzemeler başarıyla gönderilmiştir.
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  } else if (shippedCount > 0) {
                    return (
                      <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <Package className="h-4 w-4 text-yellow-600" />
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-yellow-800">
                              {shippedCount}/{totalCount} malzeme gönderildi
                            </h5>
                            <p className="text-xs text-yellow-600 mt-1">
                              Kalan malzemelerin gönderimini tamamlayın
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
              </CardContent>
            </Card>
          )}

          {/* Alt Bölüm - Teklif Girişi */}
          <div>
            {hasOrder || request?.status === 'sipariş verildi' ? (
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-gray-900">Sipariş Detayları</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">Bu talep için sipariş oluşturuldu</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>

                {/* Sipariş Detayları */}
                <div className="space-y-6">
                  {/* Site personnel için sadece teslimat onayı alanı */}
                  {(() => {
                    console.log('🔍 Site personnel check:', {
                      userRole,
                      isSitePersonnel: userRole === 'site_personnel',
                      hasOrder,
                      requestStatus: request?.status
                    })
                    return userRole === 'site_personnel'
                  })() && (
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Teslimat İşlemleri</h4>
                      
                      {/* Teslimat onayı butonu */}
                      {canConfirmDelivery() && (
                        <div className="space-y-3">
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Truck className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700">Teslimat Onayı</span>
                            </div>
                            <p className="text-xs text-green-600">
                              Sipariş verildi. Malzeme teslimatını aldığınızda aşağıdaki butona tıklayarak irsaliye fotoğrafını yükleyebilirsiniz.
                            </p>
                          </div>
                          <Button
                            onClick={handleDeliveryConfirmation}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Teslim Alındı
                          </Button>
                        </div>
                      )}

                      {/* Teslimat henüz gelmedi bilgisi */}
                      {currentOrder && !isDeliveryDateReached() && currentOrder.status !== 'delivered' && (
                        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-700">Teslimat Bekleniyor</span>
                          </div>
                          <p className="text-xs text-yellow-600">
                            Teslimat tarihi henüz gelmedi. Malzeme geldiğinde bu sayfadan teslimat onayı yapabilirsiniz.
                          </p>
                        </div>
                      )}
                      
                      {/* Teslim alındı bilgisi */}
                      {currentOrder?.status === 'delivered' && (
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Teslimat Alındı</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Diğer roller için tam sipariş detayları */}
                  {(userRole !== 'site_personnel' && userRole !== 'site_manager' && userRole !== 'santiye_depo') && (
                    <>
                      {/* Tedarikçi Bilgileri */}
                      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{selectedSupplier?.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{selectedSupplier?.contact_person}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/suppliers/${selectedSupplier?.id}`)}
                            className="text-gray-700 border-gray-200 hover:bg-gray-100"
                          >
                            Tedarikçi Detayları
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{selectedSupplier?.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span>{selectedSupplier?.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Sipariş Bilgileri */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-500 mb-1">Teslimat Tarihi</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {new Date(orderDetails.deliveryDate).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-500 mb-1">Durum</p>
                          <Badge className="bg-green-100 text-green-700 border-0">
                            Sipariş Verildi
                          </Badge>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </CardContent>
              </Card>
            ) : userRole !== 'site_personnel' && userRole !== 'site_manager' && userRole !== 'santiye_depo' ? (
              <div className="bg-gradient-to-br from-white/80 to-gray-50/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200/50">
                {/* Clickable Header */}
                <div 
                  className="flex items-center justify-between mb-6 cursor-pointer group"
                  onClick={() => setIsOfferFormOpen(!isOfferFormOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900/10 rounded-xl flex items-center justify-center group-hover:bg-gray-900/20 transition-colors duration-200">
                      <Plus className="h-5 w-5 text-gray-900" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors duration-200">
                        Yeni Teklif Girişi
                      </h3>
                      <p className="text-sm text-gray-500">
                        {isOfferFormOpen 
                          ? 'Teklif formunu gizlemek için tıklayın' 
                          : 'Manuel teklif girişi yapmak için tıklayın • Toplam 3 teklif'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Toggle Icon */}
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors duration-200">
                    {isOfferFormOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                </div>
              
              {/* Collapsible Form Content */}
              {isOfferFormOpen && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                
                {newOffers.map((offer, index) => (
                  <div key={index} className="bg-gradient-to-br from-gray-50/50 to-gray-100/50 rounded-2xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-normal text-gray-700">{index + 1}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Teklif {index + 1}</h3>
                      </div>
                      {newOffers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOfferRow(index)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-full px-3 h-8 transition-all duration-200"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Tedarikçi Adı */}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          Tedarikçi Firma Adı *
                        </label>
                        <Input
                          value={offer.supplier_name}
                          onChange={(e) => updateOffer(index, 'supplier_name', e.target.value)}
                          placeholder="Tedarikçi firma adını girin"
                          className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200"
                        />
                      </div>

                      {/* Birim Fiyat ve Para Birimi */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                            <DollarSign className="h-4 w-4 text-gray-700" />
                            Birim Fiyat *
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={offer.unit_price || ''}
                            onChange={(e) => updateOffer(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                            Para Birimi *
                          </label>
                          <Select 
                            value={offer.currency} 
                            onValueChange={(value) => updateOffer(index, 'currency', value)}
                          >
                            <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200 flex items-center">
                              <SelectValue placeholder="TRY" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-gray-200 shadow-lg rounded-xl">
                              {CURRENCIES.map((currency) => (
                                <SelectItem key={currency.value} value={currency.value}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{currency.symbol}</span>
                                    <span>{currency.value}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Toplam Fiyat (otomatik) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          Toplam Fiyat
                        </label>
                        <div className="h-12 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-xl flex items-center px-4 shadow-sm">
                          <span className="font-semibold text-green-700 text-lg">
                            {getCurrencySymbol(offer.currency)}{offer.total_price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Teslimat Süresi */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          <Truck className="h-4 w-4 text-gray-700" />
                          Teslimat (Gün) *
                        </label>
                        <Input
                          type="number"
                          value={offer.delivery_days || ''}
                          onChange={(e) => updateOffer(index, 'delivery_days', parseInt(e.target.value) || 0)}
                          placeholder="7"
                          className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200"
                        />
                      </div>

                      {/* Teslimat Tarihi (otomatik) */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          <Calendar className="h-4 w-4 text-gray-700" />
                          Teslimat Tarihi
                        </label>
                        <div className="h-12 bg-gray-50/50 rounded-xl flex items-center px-4 shadow-sm">
                          <span className="text-gray-600 font-medium">
                            {offer.delivery_date || 'Teslimat süresini girin'}
                          </span>
                        </div>
                      </div>

                      {/* Notlar */}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          Ek Notlar ve Özel Şartlar
                        </label>
                        <textarea
                          value={offer.notes}
                          onChange={(e) => updateOffer(index, 'notes', e.target.value)}
                          placeholder="Ödeme şartları, garanti bilgileri, özel şartlar..."
                          className="w-full h-24 bg-white/80 backdrop-blur-sm rounded-xl border-0 shadow-sm focus:ring-2 focus:ring-gray-500/20 transition-all duration-200 resize-none px-4 py-3"
                        />
                      </div>

                      {/* Döküman Upload - Zorunlu */}
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Teklif Dökümanları *
                          </span>
                        </label>
                        
                        {/* Upload Buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {/* Camera Button */}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => triggerCameraCapture(index)}
                            disabled={offer.documents.length >= 3}
                            className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                          >
                            <Camera className="w-5 h-5 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Kamera</span>
                          </Button>

                          {/* File Select Button */}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => triggerFileSelect(index)}
                            disabled={offer.documents.length >= 3}
                            className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                          >
                            <Upload className="w-5 h-5 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Dosya Seç</span>
                          </Button>
                        </div>

                        {/* Document Previews */}
                        {offer.documentPreviewUrls.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-600">Yüklenen Dökümanlar:</p>
                            <div className="grid grid-cols-3 gap-3">
                              {offer.documentPreviewUrls.map((url, docIndex) => (
                                <div key={docIndex} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                                  {offer.documents[docIndex]?.type.includes('pdf') ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileText className="w-8 h-8 text-gray-500" />
                                      <span className="absolute bottom-1 left-1 right-1 text-xs text-gray-600 bg-white/80 rounded px-1 py-0.5 truncate">
                                        {offer.documents[docIndex]?.name}
                                      </span>
                                    </div>
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`Document ${docIndex + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDocument(index, docIndex)}
                                    className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-500">
                              {offer.documents.length}/3 döküman yüklendi
                            </p>
                          </div>
                        )}

                        {/* Upload Instructions */}
                        {offer.documents.length === 0 && (
                          <div className="text-center py-4 px-4 bg-red-50/50 rounded-xl border border-red-200/50">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-red-400" />
                            <p className="text-sm text-red-700 font-medium">
                              ⚠ Teklif dökümanları zorunludur
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                              Fiyat listesi, teknik şartname, resmi teklif belgesi vb.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Teklif Durumu */}
                    <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-gray-50/50 to-gray-100/50">
                      <div className="flex items-center gap-3">
                        {isValidOffer(offer) ? (
                          <>
                            <div className="w-3 h-3 bg-gray-900 rounded-full shadow-sm"></div>
                            <span className="text-sm text-gray-700 font-medium">✓ Teklif geçerli ve kaydedilebilir</span>
                          </>
                        ) : (
                          <>
                            <div className="w-3 h-3 bg-gray-500 rounded-full shadow-sm"></div>
                            <span className="text-sm text-gray-600">⚠ Gerekli alanları doldurun (döküman zorunlu)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Teklif Ekle Butonu */}
                {newOffers.length < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addOfferRow}
                    className="w-full h-14 bg-gradient-to-r from-gray-50/50 to-gray-100/50 hover:from-gray-100/50 hover:to-gray-200/50 rounded-2xl border-2 border-dashed border-gray-200/50 hover:border-gray-300/50 transition-all duration-200"
                  >
                    <Plus className="h-5 w-5 mr-3 text-gray-700" />
                    <span className="text-base font-medium text-gray-700">Başka Teklif Ekle</span>
                  </Button>
                )}

                {/* Submit Butonları */}
                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-100/50">
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/dashboard/requests')}
                    className="flex-1 h-12 bg-gray-100/50 hover:bg-gray-200/50 rounded-xl text-gray-700 font-medium transition-all duration-200"
                    disabled={submitting}
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !newOffers.some(isValidOffer)}
                    className="flex-1 h-12 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black rounded-xl text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        <span className="text-base">Dökümanlar yükleniyor...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-3" />
                        <span className="text-base">Teklifleri Kaydet</span>
                      </>
                    )}
                  </Button>
                </div>
                </div>
                )}
              </div>
            ) : userRole === 'site_manager' ? (
              // Site manager için özel bilgilendirme mesajı - sadece özel durumda göster
              !['kısmen gönderildi', 'depoda mevcut değil'].includes(request?.status || '') ? (
                <Card className="bg-white border-0 shadow-sm">
                  <CardContent className="p-8">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Teklif Sürecini Takip Edin</h3>
                      <p className="text-gray-600 mb-4">
                        Site manager olarak mevcut teklifleri görüntüleyebilir ve süreci takip edebilirsiniz. 
                        Teklif girişi ve onaylama yetkileriniz bulunmamaktadır.
                      </p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="text-sm text-blue-700 font-medium">Takip modunda</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null
            ) : (
              // Site personeli için bilgilendirme mesajı
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Talep Takibi</h3>
                    <p className="text-gray-600 mb-4">
                      Bu talep için teklif süreci devam ediyor. Sipariş oluşturulduğunda detayları burada görüntüleyebileceksiniz.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">Süreç devam ediyor</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Sipariş Oluşturma Modal */}
      {isCreateOrderModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Sipariş Oluştur</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedSupplier.name}</p>
                  {currentMaterialForAssignment && (
                    <p className="text-xs text-blue-600 mt-1">
                      Malzeme: {currentMaterialForAssignment.name}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsCreateOrderModalOpen(false)
                    setSelectedSupplier(null)
                    setCurrentMaterialForAssignment(null)
                    setOrderDetails({
                      deliveryDate: '',
                      amount: '',
                      currency: 'TRY',
                      documents: [],
                      documentPreviewUrls: []
                    })
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Teslimat Tarihi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teslimat Tarihi
                </label>
                <Input
                  type="date"
                  value={orderDetails.deliveryDate}
                  onChange={(e) => setOrderDetails({
                    ...orderDetails,
                    deliveryDate: e.target.value
                  })}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200"
                />
              </div>


            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOrderModalOpen(false)
                  setSelectedSupplier(null)
                  setCurrentMaterialForAssignment(null)
                  setOrderDetails({
                    deliveryDate: '',
                    amount: '',
                    currency: 'TRY',
                    documents: [],
                    documentPreviewUrls: []
                  })
                }}
              >
                İptal
              </Button>
              <Button
                onClick={async () => {
                  let orderData: any = null
                  try {
                    console.log('🚀 Sipariş oluşturma başlatılıyor...')
                    console.log('📋 Sipariş detayları:', {
                      requestId,
                      supplier: selectedSupplier,
                      orderDetails
                    })

                    if (!orderDetails.deliveryDate) {
                      showToast('Lütfen teslimat tarihini seçin.', 'error')
                      return
                    }

                    // Döküman yükleme kaldırıldı
                    const uploadedUrls: string[] = []

                    console.log('📦 Sipariş kaydı oluşturuluyor...')
                    // Önce mevcut kullanıcı bilgisini al
                    console.log('🔐 Oturum kontrolü başlatılıyor...')
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
                    
                    if (sessionError) {
                      console.error('❌ Oturum hatası:', sessionError)
                      throw new Error(`Oturum bilgisi alınamadı: ${sessionError.message}`)
                    }

                    console.log('📋 Oturum bilgisi:', session)
                    
                    if (!session) {
                      console.error('❌ Oturum bulunamadı')
                      throw new Error('Aktif bir oturum bulunamadı. Lütfen tekrar giriş yapın.')
                    }
                    
                    if (!session.user) {
                      console.error('❌ Kullanıcı bilgisi bulunamadı')
                      throw new Error('Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.')
                    }
                    
                    if (!session.user.id) {
                      console.error('❌ Kullanıcı ID bulunamadı')
                      throw new Error('Kullanıcı ID bilgisi bulunamadı. Lütfen tekrar giriş yapın.')
                    }
                    
                    console.log('✅ Oturum kontrolü başarılı:', {
                      userId: session.user.id,
                      email: session.user.email
                    })

                    orderData = {
                      purchase_request_id: requestId,
                      supplier_id: selectedSupplier.id,
                      delivery_date: orderDetails.deliveryDate,
                      amount: 0, // Tutar bilgisi kaldırıldı, default 0
                      currency: orderDetails.currency,
                      document_urls: uploadedUrls,
                      user_id: session.user.id,
                      material_item_id: currentMaterialForAssignment?.id || null // SQL çalıştırıldıktan sonra aktif!
                    }
                    console.log('📋 Sipariş verisi:', orderData)

                    // Siparişi oluştur
                    const { data: order, error: orderError } = await supabase
                      .from('orders')
                      .insert(orderData)
                      .select()
                      .single()

                    if (orderError) {
                      console.error('❌ Sipariş oluşturma hatası:', {
                        error: orderError,
                        data: orderData
                      })
                      throw new Error(`Sipariş oluşturma hatası: ${orderError.message}`)
                    }

                    console.log('✅ Sipariş oluşturuldu:', order)

                    // Local tracking'e sipariş bilgisini ekle
                    if (currentMaterialForAssignment) {
                      const orderInfo = {
                        supplier_id: selectedSupplier.id,
                        material_item_id: currentMaterialForAssignment.id,
                        delivery_date: orderDetails.deliveryDate,
                        order_id: order.id,
                        supplier_name: selectedSupplier.name
                      }
                      
                      // Material item ID bazlı key (material_item_id + supplier_id)
                      const materialBasedKey = `${currentMaterialForAssignment.id}_${selectedSupplier.id}`
                      
                      setLocalOrderTracking(prev => ({
                        ...prev,
                        [materialBasedKey]: orderInfo // Sadece material-specific key
                      }))
                      
                      console.log('✅ Local tracking güncellendi:', {
                        materialBasedKey: materialBasedKey,
                        materialName: currentMaterialForAssignment.name,
                        orderId: order.id
                      })
                    } else {
                      // Genel sipariş (malzeme atanmamış)
                      setLocalOrderTracking(prev => ({
                        ...prev,
                        [selectedSupplier.id]: {
                          supplier_id: selectedSupplier.id,
                          material_item_id: '',
                          delivery_date: orderDetails.deliveryDate,
                          order_id: order.id,
                          supplier_name: selectedSupplier.name
                        }
                      }))
                      console.log('✅ Local tracking güncellendi (genel):', selectedSupplier.id)
                    }

                    // Talep durumunu güncelle
                    console.log('🔄 Talep durumu güncelleniyor...')
                    const { error: updateError } = await supabase
                      .from('purchase_requests')
                      .update({ 
                        status: 'sipariş verildi',
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', requestId)

                    if (updateError) {
                      console.error('❌ Talep güncelleme hatası:', updateError)
                      throw new Error(`Talep güncelleme hatası: ${updateError.message}`)
                    }

                    console.log('✅ Talep durumu güncellendi')
                    showToast('Sipariş başarıyla oluşturuldu!', 'success')
                    
                    // Modalı kapat ve state'i temizle
                    setIsCreateOrderModalOpen(false)
                    setSelectedSupplier(null)
                    setCurrentMaterialForAssignment(null)
                    setOrderDetails({
                      deliveryDate: '',
                      amount: '',
                      currency: 'TRY',
                      documents: [],
                      documentPreviewUrls: []
                    })

                    // Sayfayı yenile - tüm verileri güncelle
                    await fetchRequestData()
                    await fetchMaterialSuppliers() // Malzeme tedarikçi listesini yenile
                    await fetchMaterialOrders() // Malzeme sipariş bilgilerini yenile

                  } catch (error: any) {
                    console.error('❌ Sipariş oluşturma hatası:', error)
                    console.error('❌ Hata detayları:', {
                      message: error?.message,
                      details: error?.details,
                      hint: error?.hint,
                      code: error?.code,
                      stack: error?.stack
                    })
                    if (orderData) {
                      console.error('❌ OrderData:', orderData)
                    }
                    showToast(
                      error?.message || 'Sipariş oluşturulurken bir hata oluştu.',
                      'error'
                    )
                  }
                }}
                disabled={!orderDetails.deliveryDate}
                className="bg-gray-900 hover:bg-black text-white"
              >
                Siparişi Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Teklif İnceleme Modal */}
      {isModalOpen && selectedOffer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Teklif Detayı</h2>
                  <p className="text-gray-500 mt-1">{selectedOffer.supplier_name}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={closeOfferModal}
                  className="w-10 h-10 p-0 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Teklif Bilgileri */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Tedarikçi</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedOffer.supplier_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Birim Fiyat</label>
                    <p className="text-lg text-gray-900">{getCurrencySymbol(selectedOffer.currency || 'TRY')}{Number(selectedOffer.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Toplam Fiyat</label>
                    <p className="text-xl font-bold text-green-600">{getCurrencySymbol(selectedOffer.currency || 'TRY')}{Number(selectedOffer.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Teslimat Süresi</label>
                    <p className="text-lg text-gray-900">{selectedOffer.delivery_days} gün</p>
                  </div>
                  {selectedOffer.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 block mb-1">Notlar</label>
                      <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">{selectedOffer.notes}</p>
                    </div>
                  )}
                </div>
              </div>

            

              {/* Dökümanlar */}
              {selectedOffer.document_urls && selectedOffer.document_urls.length > 0 ? (
                <div>
                  <label className="text-lg font-semibold text-gray-900 block mb-4">Teklif Dökümanları ({selectedOffer.document_urls.length})</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedOffer.document_urls.map((url: string, index: number) => (
                      <div key={index} className="group relative">
                        <div 
                          className="aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200"
                          onClick={() => window.open(url, '_blank')}
                        >
                          {url.includes('.pdf') ? (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <FileText className="w-16 h-16 text-gray-500 mb-2" />
                              <span className="text-sm text-gray-600">PDF Döküman</span>
                            </div>
                          ) : (
                            <img
                              src={url}
                              alt={`Döküman ${index + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onLoad={() => {
                                console.log('✅ Modal image loaded successfully:', url)
                              }}
                              onError={(e) => {
                                console.error('❌ Modal image failed to load:', url)
                              }}
                            />
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                                <span className="text-sm font-medium text-gray-800">Tam Boyut</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">Döküman {index + 1}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-lg font-semibold text-gray-900 block mb-4">Teklif Dökümanları</label>
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <FileText className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">Bu teklif için henüz döküman yüklenmemiş</p>
                    <p className="text-xs text-gray-400 mt-1">
                      document_urls: {selectedOffer.document_urls ? 'var ama boş' : 'field yok'}
                    </p>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 -m-6 mt-6 rounded-b-2xl">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={closeOfferModal}
                    className="px-6"
                  >
                    Kapat
                  </Button>
                  {userRole !== 'site_personnel' && userRole !== 'site_manager' && userRole !== 'santiye_depo' && !selectedOffer.is_selected && request?.status !== 'approved' && (
                    <Button
                      onClick={() => {
                        closeOfferModal()
                        openApprovalModal(selectedOffer)
                      }}
                      className="px-6 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black"
                    >
                      Bu Teklifi Onayla
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teklif Onaylama Modal */}
      {isApprovalModalOpen && offerToApprove && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Teklifi Onayla</h2>
                  <p className="text-gray-500 text-sm mt-1">{offerToApprove.supplier_name}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={closeApprovalModal}
                  className="w-8 h-8 p-0 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Teklif Özeti */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Birim Fiyat:</span>
                    <p className="font-semibold text-gray-900">
                      {getCurrencySymbol(offerToApprove.currency || 'TRY')}
                      {Number(offerToApprove.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Toplam Tutar:</span>
                    <p className="font-bold text-green-600">
                      {getCurrencySymbol(offerToApprove.currency || 'TRY')}
                      {Number(offerToApprove.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Teslimat:</span>
                    <p className="font-semibold text-gray-900">{offerToApprove.delivery_days} gün</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Para Birimi:</span>
                    <p className="font-semibold text-gray-900">{offerToApprove.currency || 'TRY'}</p>
                  </div>
                </div>
              </div>

              {/* Onay Nedeni */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Onay Nedeni *
                </label>
                <textarea
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="Bu teklifi neden seçiyorsunuz? (örn: En uygun fiyat, kaliteli malzeme, hızlı teslimat, güvenilir tedarikçi...)"
                  className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400 transition-all duration-200 resize-none"
                  maxLength={500}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">
                    Bu bilgi onay geçmişinde kayıt altına alınacaktır.
                  </p>
                  <p className="text-xs text-gray-400">
                    {approvalReason.length}/500
                  </p>
                </div>
              </div>

              {/* Uyarı */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Dikkat</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Bu teklifi onayladığınızda satın alma talebi sonuçlandırılacak ve 
                      diğer teklifler reddedilecektir. Bu işlem geri alınamaz.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <Button
                variant="outline"
                onClick={closeApprovalModal}
                disabled={approving !== null}
                className="flex-1 h-11 rounded-xl"
              >
                İptal
              </Button>
              <Button
                onClick={confirmApproval}
                disabled={!approvalReason.trim() || approving !== null}
                className="flex-1 h-11 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {approving === offerToApprove.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Onaylanıyor...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Teklifi Onayla
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tedarikçi Atama Modal */}
      <AssignSupplierModal
        isOpen={isAssignSupplierModalOpen}
        onClose={() => {
          setIsAssignSupplierModalOpen(false)
          setCurrentMaterialForAssignment(null)
        }}
        itemName={currentMaterialForAssignment?.name || firstItem?.item_name || ''}
        itemUnit={currentMaterialForAssignment?.unit || firstItem?.unit}
        materialClass={request?.material_class || undefined}
        materialGroup={request?.material_group || undefined}
        onSuccess={() => {
          checkItemInSupplierMaterials()
          fetchMaterialSuppliers() // Malzeme bazlı tedarikçi listesini yenile
        }}
      />

      {/* Resim Modal */}
      {selectedImageModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          {/* Modal Overlay - Click to close */}
          <div 
            className="absolute inset-0 cursor-pointer"
            onClick={closeImageModal}
          />
          
          {/* Modal Content */}
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeImageModal}
              className="absolute top-4 right-4 z-10 h-12 w-12 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Image Counter */}
            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
              {selectedImageModal.index + 1} / {selectedImageModal.total}
            </div>

            {/* Previous Button */}
            {selectedImageModal.total > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateImage('prev')}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
            )}

            {/* Next Button */}
            {selectedImageModal.total > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateImage('next')}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 bg-black/50 hover:bg-black/70 text-white border-0 rounded-full"
              >
                <ArrowLeft className="h-6 w-6 rotate-180" />
              </Button>
            )}

            {/* Image */}
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={selectedImageModal.url}
                alt={selectedImageModal.alt}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  console.error('❌ Modal image failed to load:', selectedImageModal.url)
                }}
              />
            </div>

            {/* Image Title */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-sm text-white px-6 py-3 rounded-full text-sm font-medium">
              {selectedImageModal.alt}
            </div>
          </div>

          {/* Keyboard Instructions */}
          {selectedImageModal.total > 1 && (
            <div className="absolute bottom-4 right-4 z-10 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-xs">
              <div className="flex items-center gap-4">
                <span>← → Gezinmek için</span>
                <span>ESC Kapatmak için</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Santiye Depo - Gönder Modal */}
      {isSendModalOpen && items.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Malzeme Gönder</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {items.length > 1 ? `${items.length} farklı malzeme` : items[0].item_name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsSendModalOpen(false)
                    setSendQuantities({})
                  }}
                  className="w-8 h-8 p-0 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Çoklu ürün listesi */}
              <div className="space-y-6">
                {items.map((item, index) => {
                  const currentQuantity = sendQuantities[item.id] || ''
                  const numericQuantity = parseFloat(currentQuantity)
                  const hasValidQuantity = currentQuantity.trim() !== '' && numericQuantity > 0
                  const isFullyFulfilled = hasValidQuantity && numericQuantity >= item.quantity

                  return (
                    <div key={item.id} className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                      {/* Ürün başlığı */}
                      {items.length > 1 && (
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Malzeme {index + 1}
                          </span>
                        </div>
                      )}

                      {/* Talep Bilgileri */}
                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">İlk Talep:</span>
                            <p className="font-bold text-gray-900 text-lg">
                              {(() => {
                                const itemShipments = shipmentData[item.id]
                                const totalShipped = itemShipments?.total_shipped || 0
                                const originalRequest = item.original_quantity || (item.quantity + totalShipped)
                                
                                console.log(`📊 Modal İlk Talep hesaplama (${item.item_name}):`, {
                                  itemId: item.id,
                                  original_quantity_field: item.original_quantity,
                                  current_quantity_field: item.quantity,
                                  totalShipped,
                                  calculated_original: originalRequest
                                })
                                
                                return `${originalRequest} ${item.unit}`
                              })()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Kalan:</span>
                            <p className="font-bold text-gray-900 text-lg">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Ürün:</span>
                            <p className="font-semibold text-gray-900">
                              {item.item_name}
                            </p>
                          </div>
                        </div>
                        {item.specifications && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <span className="text-gray-600 text-xs">Açıklama:</span>
                            <p className="text-sm text-gray-700 mt-1">{item.specifications}</p>
                          </div>
                        )}
                      </div>

                      {/* Gönderilecek Miktar */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Gönderilecek Miktar {items.length === 1 ? '*' : '(İsteğe bağlı)'}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={item.quantity}
                              value={currentQuantity}
                              onChange={(e) => setSendQuantities(prev => ({
                                ...prev,
                                [item.id]: e.target.value
                              }))}
                              placeholder="0.00"
                              className="h-12 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                            />
                          </div>
                          <div>
                            <div className="h-12 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
                              <span className="text-gray-700 font-medium">
                                {item.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Maksimum: {item.quantity} {item.unit}
                        </p>
                      </div>

                      {/* Gönderim Durumu Bilgisi */}
                      {hasValidQuantity && (
                        <div className={`mt-4 rounded-xl p-4 ${
                          isFullyFulfilled
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            {isFullyFulfilled ? (
                              <>
                                <Check className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-medium text-green-800">
                                  Bu malzeme tamamen karşılanacak
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-800">
                                  Kısmi gönderim - Kalan: {(item.quantity - numericQuantity).toFixed(2)} {item.unit}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Genel Durum Özeti */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Gönderim Özeti</span>
                </div>
                <div className="text-sm text-blue-700">
                  {Object.values(sendQuantities).filter(q => q.trim() !== '' && parseFloat(q) > 0).length === 0 ? (
                    'Henüz hiçbir malzeme için miktar girilmedi'
                  ) : items.length === 1 ? (
                    'Tek malzeme gönderimi'
                  ) : (
                    `${Object.values(sendQuantities).filter(q => q.trim() !== '' && parseFloat(q) > 0).length} / ${items.length} malzeme için miktar girildi`
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex gap-3 rounded-b-2xl">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSendModalOpen(false)
                  setSendQuantities({})
                }}
                disabled={sendingItem}
                className="flex-1 h-11 rounded-xl"
              >
                İptal
              </Button>
              <Button
                onClick={confirmSendItem}
                disabled={Object.values(sendQuantities).every(q => !q.trim() || parseFloat(q) <= 0) || sendingItem}
                className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {sendingItem ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Malzemeleri Gönder
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Teslimat Onayı Modalı */}
      <DeliveryConfirmationModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        orderId={currentOrder?.id || 'temp-order-id'} // Geçici ID order yoksa
        requestId={requestId}
        deliveryDate={currentOrder?.delivery_date || new Date().toISOString()} // Bugün order yoksa
        onSuccess={handleDeliverySuccess}
      />
    </div>
  )
}