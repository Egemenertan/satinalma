'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Save, Package, Building2, Calendar, DollarSign, Truck, FileText, Check, AlertCircle, X, Camera, Upload, ImageIcon, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import { addOffers, updateSiteExpenses } from '@/lib/actions'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/lib/types'
import { useToast } from '@/components/ui/toast'
import AssignSupplierModal from '@/components/AssignSupplierModal'

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
  purchase_request_items: Array<{
    id: string
    item_name: string
    description: string
    quantity: number
    unit: string
    specifications: string
    brand?: string
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

        // Önce mevcut talep durumunu kontrol et
        const { data: currentRequest, error: requestError } = await supabase
          .from('purchase_requests')
          .select('status')
          .eq('id', requestId)
          .single()

        if (!requestError && currentRequest && currentRequest.status !== 'sipariş verildi') {
          // Sadece durum 'sipariş verildi' değilse güncelle
          console.log('🔄 Talep durumu güncelleniyor...')
          const { error: updateError } = await supabase
            .from('purchase_requests')
            .update({ 
              status: 'sipariş verildi',
              updated_at: new Date().toISOString()
            })
            .eq('id', requestId)

          if (updateError) {
            console.error('❌ Talep durumu güncellenirken hata:', updateError)
            showToast('Talep durumu güncellenirken bir hata oluştu.', 'error')
          } else {
            console.log('✅ Talep durumu güncellendi')
            await fetchRequestData()
          }
        }

        // State'leri güncelle
        setHasOrder(true)
        setSelectedSupplier(order.supplier)
        setOrderDetails({
          deliveryDate: order.delivery_date,
          amount: order.amount.toString(),
          currency: order.currency,
          documents: [],
          documentPreviewUrls: order.document_urls || []
        })
      } else {
        console.log('ℹ️ Bu talep için sipariş bulunamadı')
      }
    } catch (error) {
      console.error('❌ Sipariş detayları alınırken hata:', error)
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

  // ESC tuşu ile modal kapatma
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isApprovalModalOpen) {
          closeApprovalModal()
        } else if (isModalOpen) {
          closeOfferModal()
        } else if (isAssignSupplierModalOpen) {
          setIsAssignSupplierModalOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isModalOpen, isApprovalModalOpen, isAssignSupplierModalOpen])

  // Modal açıldığında body scroll'unu engelle
  useEffect(() => {
    if (isModalOpen || isApprovalModalOpen) {
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
  }, [isModalOpen, isApprovalModalOpen])

  const fetchRequestData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching request with ID:', requestId)
      
      // İlk olarak purchase request'i çek
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          profiles!purchase_requests_requested_by_fkey(full_name, email)
        `)
        .eq('id', requestId)
        .single()
      
      // Eğer başarılıysa, purchase request items'ları ayrı olarak çek
      if (!error && data) {
        const { data: items, error: itemsError } = await supabase
          .from('purchase_request_items')
          .select('*')
          .eq('purchase_request_id', requestId)
        
        if (!itemsError && items) {
          data.purchase_request_items = items
        } else {
          console.error('❌ Items fetch error:', itemsError)
          data.purchase_request_items = []
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
    if (field === 'unit_price' && request?.purchase_request_items?.[0]) {
      const quantity = request.purchase_request_items[0].quantity
      updated[index].total_price = Number(value) * quantity
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
      
      // Talebin durumunu approved olarak güncelle
      const { error } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      // Seçilen teklifi approved olarak işaretle ve onay nedenini kaydet
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

  const handleSiteManagerApproval = async () => {
    try {
      setSiteManagerApproving(true)
      
      const { error } = await supabase
        .from('purchase_requests')
        .update({ 
          status: 'şantiye şefi onayladı',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (error) throw error
      
      showToast('Talep başarıyla onaylandı!', 'success')
      
      // Sayfayı yenile
      await fetchRequestData()
      
    } catch (error: any) {
      console.error('❌ Site Manager Onay Hatası:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        requestId
      })
      showToast('Onaylama sırasında hata oluştu.', 'error')
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
  const item = request.purchase_request_items?.[0]

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

            {/* Sağ taraf - Status badge'leri ve Onay butonu */}
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
                 request.status === 'sipariş verildi' ? 'Sipariş Verildi' : request.status}
              </Badge>
              
              {/* Site Manager Onay Butonu */}
              {userRole === 'site_manager' && request.status === 'pending' && (
                <Button
                  onClick={handleSiteManagerApproval}
                  disabled={siteManagerApproving}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {siteManagerApproving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Onaylanıyor...
                    </>
                  ) : (
                    'Talebi Onayla'
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
              
              {/* Site Manager Onay Butonu - Mobile */}
              {userRole === 'site_manager' && request.status === 'pending' && (
                <Button
                  onClick={handleSiteManagerApproval}
                  disabled={siteManagerApproving}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  {siteManagerApproving ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Onaylanıyor...
                    </>
                  ) : (
                    'Onayla'
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

          {/* Talep Detayları ve Ürün Bilgileri Yan Yana */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 mb-4 sm:mb-8">
            
            {/* Sol Panel - Talep Detayları */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">Talep Detayları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Başlık</p>
                  <p className="text-lg font-medium text-gray-900">{request.title}</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Departman</p>
                    <p className="text-base text-gray-900">{request.department}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Talep Eden</p>
                    <p className="text-base text-gray-900">{request.profiles?.full_name}</p>
                  </div>
                  {/* Kategori Bilgileri */}
                  {request.category_name && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Malzeme Kategorisi</p>
                      <p className="text-base text-gray-900">{request.category_name}</p>
                      {request.subcategory_name && (
                        <p className="text-sm text-gray-600 mt-1">→ {request.subcategory_name}</p>
                      )}
                    </div>
                  )}
                  {/* Malzeme Sınıf ve Grup Bilgileri */}
                  {(request.material_class || request.material_group) && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Malzeme Sınıflandırması</p>
                      {request.material_class && (
                        <div className="flex items-center gap-2 mb-2">
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
                  )}
                  {request.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Açıklama</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{request.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sağ Panel - Ürün Bilgileri */}
            <div>
              {item ? (
                <Card className="bg-white border-0 shadow-sm h-full">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">Ürün Bilgileri</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Ürün Adı</p>
                      <p className="text-lg font-medium text-gray-900">{item.item_name}</p>
                    </div>
                    
                    {item.brand && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Marka</p>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          {item.brand}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Miktar Highlight */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Talep Edilen Miktar</p>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-semibold text-gray-900">{item.quantity}</div>
                        <Badge variant="outline" className="text-gray-600">
                          {item.unit}
                        </Badge>
                      </div>
                    </div>
                    
                    {item.specifications && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Açıklama</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{item.specifications}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                /* Ürün Bilgileri Yok */
                <Card className="bg-white border-0 shadow-sm h-full">
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-600 mb-2">Ürün Bilgisi Yok</h3>
                      <p className="text-sm text-gray-500">Bu talep için ürün detayları bulunamadı.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Tedarikçi Atama Butonu - Site personeli ve site manager göremez */}
          {userRole !== 'site_personnel' && userRole !== 'site_manager' && !supplierMaterialInfo.isRegistered && item && (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Tedarikçi Ataması</h3>
                      <p className="text-sm text-gray-500">Bu ürünü bir tedarikçiye atayarak otomatik teklif alabilirsiniz</p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setIsAssignSupplierModalOpen(true)}
                    className="bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg px-6 py-3"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Tedarikçiye Ata
                  </Button>
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
                      
                      {/* Bunu Seç Butonu - Site personeli ve site manager göremez */}
                      {userRole !== 'site_personnel' && userRole !== 'site_manager' && (
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

          {/* Alt Bölüm - Teklif Girişi */}
          <div>
            {hasOrder ? (
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
                  {/* Site personnel için sadece teslimat tarihi */}
                  {userRole === 'site_personnel' ? (
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Teslimat Bilgisi</h4>
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm font-medium text-blue-700 mb-1">Teslimat Tarihi</p>
                        <p className="text-xl font-semibold text-blue-900">
                          {new Date(orderDetails.deliveryDate).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Diğer roller için tam sipariş detayları */
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-500 mb-1">Teslimat Tarihi</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {new Date(orderDetails.deliveryDate).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-500 mb-1">Sipariş Tutarı</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {getCurrencySymbol(orderDetails.currency)}
                            {parseFloat(orderDetails.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <p className="text-sm font-medium text-gray-500 mb-1">Durum</p>
                          <Badge className="bg-green-100 text-green-700 border-0">
                            Sipariş Verildi
                          </Badge>
                        </div>
                      </div>

                      {/* Dökümanlar */}
                      {orderDetails.documentPreviewUrls.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Sipariş Dökümanları</h4>
                          <div className="grid grid-cols-4 gap-4">
                            {orderDetails.documentPreviewUrls.map((url, index) => (
                              <div key={index} className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                                {orderDetails.documents[index]?.type.includes('pdf') ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center">
                                    <FileText className="w-8 h-8 text-gray-500" />
                                    <span className="text-xs text-gray-600 mt-2">PDF Döküman</span>
                                  </div>
                                ) : (
                                  <img
                                    src={url}
                                    alt={`Döküman ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </CardContent>
              </Card>
            ) : userRole !== 'site_personnel' && userRole !== 'site_manager' && supplierMaterialInfo.isRegistered ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-200/50">
                <div className="text-left">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    Kayıtlı Tedarikçiler
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Bu ürün için sistemde kayıtlı tedarikçiler bulunduğundan manuel teklif girişi yapılamaz. 
                    Lütfen aşağıdaki tedarikçiler ile iletişime geçiniz.
                  </p>
                </div>

                <div className="grid gap-4 mb-6">
                  {supplierMaterialInfo.suppliers.map((supplier) => (
                    <div 
                      key={supplier.id} 
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 relative group hover:border-gray-300 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{supplier.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{supplier.contact_person}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                            className="text-gray-700 border-gray-200 hover:bg-gray-50"
                          >
                            Detayları Gör
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{supplier.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span>{supplier.email}</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <Button
                          size="sm"
                          className="w-full bg-gray-900 hover:bg-black text-white shadow-lg rounded-lg h-10 font-medium"
                          onClick={() => {
                            setSelectedSupplier(supplier)
                            setIsCreateOrderModalOpen(true)
                          }}
                        >
                          Sipariş Oluştur
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={() => router.push('/dashboard/suppliers')}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl px-6 py-2.5"
                  >
                    Tüm Tedarikçileri Görüntüle
                  </Button>
                </div>
              </div>
            ) : userRole !== 'site_personnel' && userRole !== 'site_manager' ? (
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
              // Site manager için özel bilgilendirme mesajı
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
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsCreateOrderModalOpen(false)
                    setSelectedSupplier(null)
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

              {/* Tutar ve Para Birimi */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tutar
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={orderDetails.amount}
                    onChange={(e) => setOrderDetails({
                      ...orderDetails,
                      amount: e.target.value
                    })}
                    placeholder="0.00"
                    className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Para Birimi
                  </label>
                  <Select 
                    value={orderDetails.currency}
                    onValueChange={(value) => setOrderDetails({
                      ...orderDetails,
                      currency: value
                    })}
                  >
                    <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200">
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

              {/* Döküman Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Dökümanlar
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.multiple = true
                      input.onchange = (e) => {
                        const target = e.target as HTMLInputElement
                        if (target.files) {
                          const files = Array.from(target.files)
                          const urls = files.map(file => URL.createObjectURL(file))
                          setOrderDetails({
                            ...orderDetails,
                            documents: [...orderDetails.documents, ...files],
                            documentPreviewUrls: [...orderDetails.documentPreviewUrls, ...urls]
                          })
                        }
                      }
                      input.click()
                    }}
                    className="h-12 border-2 border-dashed"
                  >
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Resim Yükle
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.pdf'
                      input.multiple = true
                      input.onchange = (e) => {
                        const target = e.target as HTMLInputElement
                        if (target.files) {
                          const files = Array.from(target.files)
                          const urls = files.map(file => URL.createObjectURL(file))
                          setOrderDetails({
                            ...orderDetails,
                            documents: [...orderDetails.documents, ...files],
                            documentPreviewUrls: [...orderDetails.documentPreviewUrls, ...urls]
                          })
                        }
                      }
                      input.click()
                    }}
                    className="h-12 border-2 border-dashed"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    PDF Yükle
                  </Button>
                </div>

                {/* Döküman Önizlemeleri */}
                {orderDetails.documentPreviewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {orderDetails.documentPreviewUrls.map((url, index) => (
                      <div key={index} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                        {orderDetails.documents[index]?.type.includes('pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <FileText className="w-8 h-8 text-gray-500" />
                            <span className="text-xs text-gray-600 mt-2">PDF Döküman</span>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Döküman ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            URL.revokeObjectURL(url)
                            setOrderDetails({
                              ...orderDetails,
                              documents: orderDetails.documents.filter((_, i) => i !== index),
                              documentPreviewUrls: orderDetails.documentPreviewUrls.filter((_, i) => i !== index)
                            })
                          }}
                          className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOrderModalOpen(false)
                  setSelectedSupplier(null)
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
                  try {
                    console.log('🚀 Sipariş oluşturma başlatılıyor...')
                    console.log('📋 Sipariş detayları:', {
                      requestId,
                      supplier: selectedSupplier,
                      orderDetails
                    })

                    if (!orderDetails.deliveryDate || !orderDetails.amount) {
                      showToast('Lütfen tüm zorunlu alanları doldurun.', 'error')
                      return
                    }

                    // Dökümanları yükle
                    console.log('📤 Döküman yükleme başlatılıyor...')
                    const uploadedUrls = []
                    for (const file of orderDetails.documents) {
                      const fileExt = file.name.split('.').pop()
                      const uniqueId = Math.random().toString(36).substring(2, 15)
                      const fileName = `orders/${requestId}_${Date.now()}_${uniqueId}.${fileExt}`

                      console.log(`📄 Döküman yükleniyor: ${fileName}`)
                      const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('satinalma')
                        .upload(fileName, file)

                      if (uploadError) {
                        console.error('❌ Döküman yükleme hatası:', {
                          fileName,
                          error: uploadError
                        })
                        throw new Error(`Döküman yükleme hatası: ${uploadError.message}`)
                      }

                      console.log('✅ Döküman yüklendi:', uploadData)

                      const { data: urlData } = supabase.storage
                        .from('satinalma')
                        .getPublicUrl(fileName)

                      console.log('🔗 Döküman URL:', urlData.publicUrl)
                      uploadedUrls.push(urlData.publicUrl)
                    }

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

                    const orderData = {
                      purchase_request_id: requestId,
                      supplier_id: selectedSupplier.id,
                      delivery_date: orderDetails.deliveryDate,
                      amount: parseFloat(orderDetails.amount),
                      currency: orderDetails.currency,
                      document_urls: uploadedUrls,
                      user_id: session.user.id
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
                    setOrderDetails({
                      deliveryDate: '',
                      amount: '',
                      currency: 'TRY',
                      documents: [],
                      documentPreviewUrls: []
                    })

                    // Sayfayı yenile
                    fetchRequestData()

                  } catch (error: any) {
                    console.error('❌ Sipariş oluşturma hatası:', {
                      error,
                      message: error.message,
                      details: error.details,
                      hint: error.hint,
                      code: error.code
                    })
                    showToast(
                      error.message || 'Sipariş oluşturulurken bir hata oluştu.',
                      'error'
                    )
                  }
                }}
                disabled={!orderDetails.deliveryDate || !orderDetails.amount}
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
                  {userRole !== 'site_personnel' && userRole !== 'site_manager' && !selectedOffer.is_selected && request?.status !== 'approved' && (
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
        onClose={() => setIsAssignSupplierModalOpen(false)}
        itemName={request?.purchase_request_items?.[0]?.item_name || ''}
        itemUnit={request?.purchase_request_items?.[0]?.unit}
        onSuccess={checkItemInSupplierMaterials}
      />
    </div>
  )
}