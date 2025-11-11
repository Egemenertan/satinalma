'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, Save, Package, Building2, Calendar, DollarSign, Truck, FileText, Check, AlertCircle, X, 
  Camera, Upload, ChevronDown, ChevronUp, Phone, Mail, Download, MessageCircle, Share, ChevronLeft, ChevronRight 
} from 'lucide-react'
import { OffersPageProps, Offer, CURRENCIES, getCurrencySymbol } from './types'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase'
import { addOffers, updateSiteExpenses } from '@/lib/actions'
import AssignSupplierModal from '@/components/AssignSupplierModal'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import { generateMaterialPurchaseRequest, getMaterialPurchaseHTML, type MaterialPurchaseRequest } from '@/lib/pdf-generator'
import ReturnedMaterialsCard from './ReturnedMaterialsCard'

interface ProcurementViewProps extends OffersPageProps {
  currentOrder: any
  localOrderTracking: {[key: string]: any}
  setLocalOrderTracking: React.Dispatch<React.SetStateAction<{[key: string]: any}>>
}

export default function ProcurementView({
  request,
  existingOffers,
  materialSuppliers,
  materialOrders,
  currentOrder,
  localOrderTracking,
  setLocalOrderTracking,
  onRefresh,
  showToast
}: ProcurementViewProps) {
  const router = useRouter()
  const supabase = createClient()

  // Local state
  const [newOffers, setNewOffers] = useState<Offer[]>([
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '', currency: 'TRY', documents: [], documentPreviewUrls: [] }
  ])
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
    quantity: '',
    documents: [] as File[],
    documentPreviewUrls: [] as string[]
  })
  const [isAssignSupplierModalOpen, setIsAssignSupplierModalOpen] = useState(false)
  const [currentMaterialForAssignment, setCurrentMaterialForAssignment] = useState<{
    id: string;
    name: string;
    unit?: string;
    isReturnReorder?: boolean; // İade yeniden siparişi flag'i
    supplierSpecific?: boolean; // Tedarikçi özel siparişi
    targetSupplierId?: string; // Hedef tedarikçi ID'si
    isBulkOrder?: boolean; // Toplu sipariş flag'i
  } | null>(null)
  const [isOfferFormOpen, setIsOfferFormOpen] = useState(false)
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false)
  const [currentPDFData, setCurrentPDFData] = useState<any>(null)
  const [pdfHtmlContent, setPdfHtmlContent] = useState<string>('')
  const [isImageGalleryOpen, setIsImageGalleryOpen] = useState(false)
  const [currentImageGallery, setCurrentImageGallery] = useState<{images: string[], itemName: string, currentIndex: number}>({
    images: [],
    itemName: '',
    currentIndex: 0
  })
  // İade nedeniyle sipariş için orijinal sipariş bilgileri
  const [returnOrderDetails, setReturnOrderDetails] = useState<any>(null)
  const [loadingReturnDetails, setLoadingReturnDetails] = useState(false)

  // Multi-select state for bulk supplier assignment
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [assigningSupplier, setAssigningSupplier] = useState(false)

  // Bulk order state
  const [isBulkOrderModalOpen, setIsBulkOrderModalOpen] = useState(false)
  const [bulkOrderSupplier, setBulkOrderSupplier] = useState<any | null>(null)
  const [bulkOrderDetails, setBulkOrderDetails] = useState<Record<string, {
    quantity: string
    deliveryDate: string
  }>>({})

  // Multi-select functions
  const toggleMaterialSelection = (materialId: string) => {
    const newSelected = new Set(selectedMaterials)
    if (newSelected.has(materialId)) {
      newSelected.delete(materialId)
    } else {
      newSelected.add(materialId)
    }
    setSelectedMaterials(newSelected)
    
    // Auto-enable multi-select mode when materials are selected
    if (newSelected.size > 0 && !isMultiSelectMode) {
      setIsMultiSelectMode(true)
    }
  }

  const selectAllMaterials = () => {
    if (!request?.purchase_request_items) return
    
    const activeItems = request.purchase_request_items.filter(item => {
      if (item.quantity > 0) return true
      if (item.quantity === 0) {
        const hasOrders = Array.isArray(materialOrders) 
          ? materialOrders.some(order => order.material_item_id === item.id)
          : false
        const hasLocalOrders = Object.values(localOrderTracking).some((order: any) => 
          order.material_item_id === item.id
        )
        return !hasOrders && !hasLocalOrders
      }
      return false
    })
    
    const allMaterialIds = activeItems.map(item => item.id)
    const newSelected = new Set(selectedMaterials)
    
    // Eğer tüm malzemeler seçiliyse, hepsini kaldır
    const allSelected = allMaterialIds.every(id => newSelected.has(id))
    
    if (allSelected) {
      allMaterialIds.forEach(id => newSelected.delete(id))
    } else {
      allMaterialIds.forEach(id => newSelected.add(id))
    }
    
    setSelectedMaterials(newSelected)
    setIsMultiSelectMode(newSelected.size > 0)
  }

  const clearMaterialSelection = () => {
    setSelectedMaterials(new Set())
    setIsMultiSelectMode(false)
  }

  // Helper function: Ortak tedarikçi bul
  const findCommonSupplier = (allSuppliers: any[][]): any | null => {
    if (allSuppliers.length === 0) return null
    
    // İlk malzemenin tedarikçileri
    const firstSuppliers = allSuppliers[0] || []
    if (firstSuppliers.length === 0) return null
    
    // Her tedarikçiyi kontrol et
    for (const supplier of firstSuppliers) {
      const isCommon = allSuppliers.every(materialSuppliers => 
        materialSuppliers.some(s => s.id === supplier.id)
      )
      
      if (isCommon) {
        return supplier
      }
    }
    
    return null
  }

  // Helper function: Toplu sipariş detaylarını güncelle
  const updateBulkOrderDetail = (materialId: string, field: 'quantity' | 'deliveryDate', value: string) => {
    setBulkOrderDetails(prev => {
      const updated = {
        ...prev,
        [materialId]: {
          ...prev[materialId],
          [field]: value
        }
      }
      
      // Eğer ilk malzeme için tarih seçiliyorsa, diğer malzemelere de uygula
      if (field === 'deliveryDate' && value) {
        const selectedMaterialsData = request?.purchase_request_items?.filter(
          item => selectedMaterials.has(item.id)
        ) || []
        
        const firstMaterialId = selectedMaterialsData[0]?.id
        
        // İlk malzeme için tarih seçiliyorsa
        if (materialId === firstMaterialId) {
          selectedMaterialsData.forEach(material => {
            if (material.id !== firstMaterialId) {
              // Diğer malzemelerin tarihini de güncelle
              updated[material.id] = {
                ...updated[material.id],
                deliveryDate: value
              }
            }
          })
        }
      }
      
      return updated
    })
  }

  const handleBulkSupplierAssignment = () => {
    if (selectedMaterials.size === 0) {
      showToast('Lütfen en az bir malzeme seçin', 'error')
      return
    }
    
    // İlk seçili malzemenin bilgilerini al (modal başlığı için)
    const firstSelectedMaterial = request?.purchase_request_items?.find(
      item => selectedMaterials.has(item.id)
    )
    
    if (firstSelectedMaterial) {
      setCurrentMaterialForAssignment({
        id: firstSelectedMaterial.id,
        name: `${selectedMaterials.size} malzeme seçildi`,
        unit: firstSelectedMaterial.unit
      })
      setIsAssignSupplierModalOpen(true)
    }
  }

  // Toplu Sipariş Handler
  const handleBulkOrderClick = async () => {
    if (selectedMaterials.size === 0) {
      showToast('Lütfen en az bir malzeme seçin', 'error')
      return
    }

    console.log('🚀 Toplu sipariş işlemi başlatılıyor...', {
      selectedCount: selectedMaterials.size
    })

    // Seçili malzemeleri al
    const selectedMaterialsData = request?.purchase_request_items?.filter(
      item => selectedMaterials.has(item.id)
    ) || []

    if (selectedMaterialsData.length === 0) {
      showToast('Seçili malzeme bulunamadı', 'error')
      return
    }

    // Her malzeme için tedarikçi kontrolü
    const materialSupplierMap = new Map()
    selectedMaterialsData.forEach(material => {
      const suppliers = materialSuppliers[material.id]?.suppliers || []
      materialSupplierMap.set(material.id, suppliers)
    })

    console.log('📊 Malzeme-Tedarikçi Haritası:', Array.from(materialSupplierMap.entries()).map(([id, suppliers]) => ({
      materialId: id,
      supplierCount: suppliers.length,
      suppliers: suppliers.map((s: any) => s.name)
    })))

    // Ortak tedarikçi kontrolü
    const allSuppliers = Array.from(materialSupplierMap.values())
    const commonSupplier = findCommonSupplier(allSuppliers)

    if (commonSupplier) {
      console.log('✅ Ortak tedarikçi bulundu:', commonSupplier.name)
      // Ortak tedarikçi var, direkt sipariş modalı aç
      openBulkOrderModal(commonSupplier, selectedMaterialsData)
    } else {
      console.log('⚠️ Ortak tedarikçi bulunamadı, tedarikçi seçim modalı açılıyor')
      // Tedarikçi seçimi gerekli
      setCurrentMaterialForAssignment({
        id: 'bulk',
        name: `${selectedMaterials.size} malzeme seçildi`,
        unit: selectedMaterialsData[0]?.unit,
        isBulkOrder: true
      })
      setIsAssignSupplierModalOpen(true)
    }
  }

  // Toplu sipariş modalını aç
  const openBulkOrderModal = (supplier: any, materials: any[]) => {
    console.log('📋 Toplu sipariş modalı açılıyor:', {
      supplier: supplier.name,
      materialsCount: materials.length
    })
    
    setBulkOrderSupplier(supplier)
    
    // Her malzeme için default değerleri set et
    const defaultDetails: Record<string, { quantity: string; deliveryDate: string }> = {}
    materials.forEach(material => {
      defaultDetails[material.id] = {
        quantity: material.quantity.toString(),
        deliveryDate: ''
      }
    })
    
    setBulkOrderDetails(defaultDetails)
    setIsBulkOrderModalOpen(true)
  }

  // Toplu sipariş submit
  const handleBulkOrderSubmit = async () => {
    try {
      console.log('📦 Toplu sipariş oluşturma başladı')
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.user?.id) {
        throw new Error('Aktif bir oturum bulunamadı. Lütfen tekrar giriş yapın.')
      }

      const orderPromises = Array.from(selectedMaterials).map(async (materialId) => {
        const material = request.purchase_request_items.find(m => m.id === materialId)
        const details = bulkOrderDetails[materialId]
        
        // Validasyon
        if (!details?.quantity || !details?.deliveryDate) {
          throw new Error(`${material?.item_name || 'Bilinmeyen malzeme'} için eksik bilgi`)
        }

        const orderQuantity = parseFloat(details.quantity)
        
        if (orderQuantity <= 0) {
          throw new Error(`${material?.item_name} için geçersiz miktar`)
        }

        if (orderQuantity > material.quantity) {
          throw new Error(`${material?.item_name} için sipariş miktarı, kalan miktarı (${material.quantity}) aşamaz`)
        }
        
        console.log(`📋 Sipariş oluşturuluyor: ${material?.item_name} - ${orderQuantity} ${material?.unit}`)
        
        // Sipariş oluştur
        const orderData = {
          purchase_request_id: request.id,
          supplier_id: bulkOrderSupplier.id,
          material_item_id: materialId,
          quantity: orderQuantity,
          delivery_date: details.deliveryDate,
          amount: 0,
          currency: 'TRY',
          status: 'pending',
          user_id: session.user.id
        }
        
        const { data: order, error } = await supabase
          .from('orders')
          .insert(orderData)
          .select()
          .single()
        
        if (error) throw error
        
        console.log(`✅ Sipariş oluşturuldu: ${material?.item_name}`)
        
        // Miktar güncelle
        const newQuantity = Math.max(0, material.quantity - orderQuantity)
        
        const { error: rpcError } = await supabase
          .rpc('update_purchase_request_item_quantity', {
            item_id: materialId,
            new_quantity: newQuantity
          })

        if (rpcError) {
          console.log('⚠️ RPC başarısız, direkt update deneniyor:', rpcError)
          
          const { error: updateError } = await supabase
            .from('purchase_request_items')
            .update({ 
              quantity: newQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', materialId)

          if (updateError) {
            console.error('⚠️ Miktar güncellenirken hata:', updateError)
          } else {
            console.log(`✅ Malzeme miktarı güncellendi (direkt): ${material?.item_name}`)
          }
        } else {
          console.log(`✅ Malzeme miktarı güncellendi (RPC): ${material?.item_name}`)
        }

        // Local tracking güncelle
        const orderInfo = {
          supplier_id: bulkOrderSupplier.id,
          material_item_id: materialId,
          delivery_date: details.deliveryDate,
          order_id: order.id,
          supplier_name: bulkOrderSupplier.name,
          quantity: orderQuantity
        }
        
        const materialBasedKey = `${materialId}_${bulkOrderSupplier.id}_${Date.now()}`
        
        setLocalOrderTracking(prev => ({
          ...prev,
          [materialBasedKey]: orderInfo
        }))
        
        return order
      })
      
      await Promise.all(orderPromises)
      
      showToast(`${selectedMaterials.size} malzeme için sipariş başarıyla oluşturuldu!`, 'success')
      clearMaterialSelection()
      setIsBulkOrderModalOpen(false)
      setBulkOrderSupplier(null)
      setBulkOrderDetails({})
      await onRefresh()
      
    } catch (error: any) {
      console.error('❌ Toplu sipariş hatası:', error)
      showToast(`Hata: ${error.message}`, 'error')
    }
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

  // İade nedeniyle sipariş durumunda orijinal sipariş bilgilerini çek
  useEffect(() => {
    const fetchReturnOrderDetails = async () => {
      if (request?.status === 'iade nedeniyle sipariş' && (request as any).return_order_id && !returnOrderDetails) {
        setLoadingReturnDetails(true)
        try {
          console.log('🔍 İade sipariş detayları çekiliyor:', (request as any).return_order_id)
          
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select(`
              id,
              delivery_date,
              return_notes,
              created_at,
              suppliers:supplier_id (
                id,
                name,
                contact_person,
                phone,
                email
              )
            `)
            .eq('id', (request as any).return_order_id)
            .single()

          if (orderError) {
            console.error('❌ İade sipariş detayları çekilemedi:', orderError)
          } else if (orderData) {
            console.log('✅ İade sipariş detayları çekildi:', orderData)
            setReturnOrderDetails(orderData)
          }
        } catch (error) {
          console.error('❌ İade sipariş detayları çekme hatası:', error)
        } finally {
          setLoadingReturnDetails(false)
        }
      }
    }

    fetchReturnOrderDetails()
  }, [request?.status, (request as any)?.return_order_id, returnOrderDetails])

  // Cleanup URL objects when component unmounts
  useEffect(() => {
    return () => {
      newOffers.forEach(offer => {
        offer.documentPreviewUrls.forEach(url => URL.revokeObjectURL(url))
      })
    }
  }, [])

  // Klavye navigasyonu için resim galerisi
  useEffect(() => {
    if (!isImageGalleryOpen) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImageGalleryOpen(false)
      } else if (e.key === 'ArrowLeft' && currentImageGallery.images.length > 1) {
        const newIndex = currentImageGallery.currentIndex === 0 
          ? currentImageGallery.images.length - 1 
          : currentImageGallery.currentIndex - 1
        setCurrentImageGallery(prev => ({...prev, currentIndex: newIndex}))
      } else if (e.key === 'ArrowRight' && currentImageGallery.images.length > 1) {
        const newIndex = currentImageGallery.currentIndex === currentImageGallery.images.length - 1 
          ? 0 
          : currentImageGallery.currentIndex + 1
        setCurrentImageGallery(prev => ({...prev, currentIndex: newIndex}))
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isImageGalleryOpen, currentImageGallery])

  const updateOffer = (index: number, field: keyof Offer, value: string | number) => {
    const updated = [...newOffers]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-calculate total price and delivery date
    if (field === 'unit_price' && request?.purchase_request_items && request.purchase_request_items.length > 0) {
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
      newOffers[index].documentPreviewUrls.forEach(url => URL.revokeObjectURL(url))
      setNewOffers(newOffers.filter((_, i) => i !== index))
    }
  }

  const handleDocumentUpload = (offerIndex: number, files: FileList | null) => {
    console.log('📁 handleDocumentUpload called:', { offerIndex, files: files?.length })
    if (!files) return

    const updated = [...newOffers]
    const currentDocuments = updated[offerIndex].documents.length
    const newFiles = Array.from(files).slice(0, 3 - currentDocuments)
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
    input.capture = 'environment'
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
           offer.documents.length > 0
  }

  const uploadDocuments = async (offerIndex: number, documents: File[]) => {
    console.log('🚀 uploadDocuments called with:', { offerIndex, documentsCount: documents.length })
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('🔐 Current session:', session)
    console.log('🔐 Session error:', sessionError)
    
    const uploadedUrls: string[] = []
    
    for (let i = 0; i < documents.length; i++) {
      const file = documents[i]
      const fileExt = file.name.split('.').pop()
      const uniqueId = Math.random().toString(36).substring(2, 15)
      const fileName = `offers/${request.id}_offer_${offerIndex}_doc_${i}_${Date.now()}_${uniqueId}.${fileExt}`
      
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
            document_urls: documentUrls
          }
          
          console.log(`✅ Processed offer ${index + 1}:`, processedOffer)
          return processedOffer
        })
      )

      console.log('📊 Final offers with documents:', offersWithDocuments)

      console.log('🚀 Calling addOffers function...')
      const result = await addOffers(request.id, offersWithDocuments)
      console.log('✅ addOffers result:', result)
      
      showToast('Teklifler başarıyla kaydedildi!', 'success')
      
      await onRefresh()
      
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
      
      const { data: offer, error: offerError } = await supabase
        .from('offers')
        .select('total_price, currency')
        .eq('id', offerId)
        .single()
      
      if (offerError || !offer) {
        throw new Error('Teklif bilgisi alınamadı')
      }
      
      await supabase
        .from('offers')
        .update({ 
          is_selected: true,
          selected_at: new Date().toISOString(),
          approval_reason: reason || null
        })
        .eq('id', offerId)

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
          showToast('Teklif onaylandı ancak şantiye harcama tutarı güncellenemedi.', 'info')
        }
      }

      showToast('Teklif başarıyla onaylandı!', 'success')
      await onRefresh()
      
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

  // PDF Export fonksiyonu - Modal açar
  const handleExportMaterialPDF = async (material: any) => {
    try {
      console.log('🔍 PDF modal açılıyor:', material)
      
      // Malzeme için tedarikçileri al
      const materialSupplier = materialSuppliers[material.id] || { isRegistered: false, suppliers: [] }
      
      // PDF data'sını hazırla
      const pdfData: MaterialPurchaseRequest = {
        request: {
          id: request.id,
          title: request.title,
          created_at: request.created_at,
          site_name: request.site_name || request.sites?.name || 'Belirtilmemiş',
          description: request.description,
          urgency_level: request.urgency_level || 'medium',
          profiles: request.profiles
        },
        material: {
          id: material.id,
          item_name: material.item_name,
          quantity: material.quantity,
          unit: material.unit,
          brand: material.brand,
          specifications: material.specifications,
          description: material.description,
          image_urls: material.image_urls || []
        },
        suppliers: materialSupplier.suppliers || []
      }
      
      console.log('📄 PDF verisi hazırlandı:', pdfData)
      
      // HTML content oluştur
      const htmlContent = getMaterialPurchaseHTML(pdfData)
      
      // Modal'ı aç
      setCurrentPDFData(pdfData)
      setPdfHtmlContent(htmlContent)
      setIsPDFModalOpen(true)
      
    } catch (error) {
      console.error('❌ PDF modal hatası:', error)
      showToast('PDF oluşturulurken hata oluştu.', 'error')
    }
  }

  // PDF İndir fonksiyonu
  const handleDownloadPDF = () => {
    if (pdfHtmlContent) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(pdfHtmlContent)
        printWindow.document.close()
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus()
            printWindow.print()
          }, 500)
        }
      } else {
        showToast('Pop-up engellendi. Lütfen pop-up engelleyicisini devre dışı bırakın.', 'error')
      }
    }
  }

  // WhatsApp Paylaş fonksiyonu
  const handleShareWhatsApp = () => {
    if (currentPDFData) {
      const message = `
*Malzeme Teklif Talebi*

Sayın Tedarikçimiz, aşağıda belirtilen malzeme için teklif talebinde bulunmaktayız:

📦 *Malzeme:* ${currentPDFData.material.item_name}
📏 *Miktar:* ${currentPDFData.material.quantity} ${currentPDFData.material.unit}
${currentPDFData.material.brand ? `🏷️ *Marka:* ${currentPDFData.material.brand}` : ''}
${currentPDFData.material.specifications ? `📋 *Özellikler:* ${currentPDFData.material.specifications}` : ''}

Lütfen en uygun fiyat ve teslimat sürenizi bize bildirin.

Teşekkürler,
DOVEC İnşaat
      `.trim()

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank')
    }
  }

  // Sipariş detayları görünümünü kaldırdık - malzeme tedarikçi yönetimi devam etsin

  const totalOffers = existingOffers.length
  const firstItem = request?.purchase_request_items?.[0]

  // İade edilen malzeme var mı kontrol et
  const hasReturnedMaterials = (() => {
    if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
      return false
    }
    
    // İade edilen malzemeleri bul
    const returnedItems = request.purchase_request_items.filter((item: any) => {
      const itemOrders = Array.isArray(materialOrders) 
        ? materialOrders.filter((order: any) => order.material_item_id === item.id)
        : []
      
      return itemOrders.some((order: any) => (order.returned_quantity || 0) > 0)
    })
    
    return returnedItems.length > 0
  })()

  return (
    <>
      {/* Status Badge - İade nedeniyle sipariş durumunu göster */}
      {request?.status === 'iade nedeniyle sipariş' && (
        <div className="mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
             
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-red-700">İade Nedeniyle Sipariş</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    Otomatik
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Bu talep iade işlemi sonrasında otomatik oluşturuldu.
                  {(request as any).original_request_id && (
                    <span className="ml-1 font-medium">
                      Orijinal: #{(request as any).original_request_id.toString().slice(-8)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* İade Sipariş Detayları */}
            {loadingReturnDetails ? (
              <div className="bg-gray-50 rounded-md p-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                  <span className="text-xs text-gray-600">Detaylar yükleniyor...</span>
                </div>
              </div>
            ) : returnOrderDetails ? (
              <div className="bg-gray-50 rounded-md p-3 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  İade Edilen Sipariş
                </h4>
                
                <div className="space-y-2">
                  {/* Tedarikçi Bilgileri */}
                  <div className="flex items-start gap-2">
                    <svg className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6"></path>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900">{returnOrderDetails.suppliers?.name || 'Bilinmeyen Tedarikçi'}</p>
                      {returnOrderDetails.suppliers?.contact_person && (
                        <p className="text-xs text-gray-600">{returnOrderDetails.suppliers.contact_person}</p>
                      )}
                      {returnOrderDetails.suppliers?.phone && (
                        <p className="text-xs text-gray-600">{returnOrderDetails.suppliers.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Teslimat Tarihi (varsa) */}
                  {returnOrderDetails.delivery_date && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Teslimat:</span> {new Date(returnOrderDetails.delivery_date).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  )}
                </div>

                {/* İade Notları */}
                {returnOrderDetails.return_notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-start gap-2">
                      <svg className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700">İade Nedeni:</p>
                        <p className="text-xs text-gray-600 mt-0.5">{returnOrderDetails.return_notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (request as any).return_order_id ? (
              <div className="bg-gray-50 rounded-md p-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                  <span className="text-xs">Detaylar yüklenemedi</span>
                </div>
              </div>
            ) : null}

            {/* Talep Açıklaması */}
            {request.description && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">{request.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* İade Edilen Malzemeler */}
      <ReturnedMaterialsCard
        request={request}
        materialOrders={materialOrders}
        materialSuppliers={materialSuppliers}
        setCurrentImageGallery={setCurrentImageGallery}
        setIsImageGalleryOpen={setIsImageGalleryOpen}
        onReorder={(item, returnedQuantity, supplierInfo) => {
          // İade edilen malzeme için yeniden sipariş oluştur
          console.log('Yeniden sipariş:', item.item_name, 'İade miktarı:', returnedQuantity, 'Tedarikçi:', supplierInfo)
          
          // Önce bu tedarikçi için yeniden sipariş istenip istenmediğini kontrol et
          if (supplierInfo) {
            const supplierOrders = Array.isArray(materialOrders) 
              ? materialOrders.filter((order: any) => 
                  order.material_item_id === item.id && 
                  order.supplier_id === supplierInfo.supplier_id &&
                  (order.returned_quantity || 0) > 0
                )
              : []
            
            // Bu tedarikçi için yeniden sipariş istenmiyorsa işlemi durdur
            const reorderNotRequested = supplierOrders.some((order: any) => order.reorder_requested === false)
            if (reorderNotRequested) {
              showToast('Bu tedarikçi için yeniden sipariş istenmediği belirtilmiş.', 'info')
              return
            }
          }
          
          if (supplierInfo) {
            // Belirtilen tedarikçi ile sipariş modalını aç
            const supplier = {
              id: supplierInfo.supplier_id,
              name: supplierInfo.supplier_name,
              contact_person: supplierInfo.contact_person || '',
              phone: supplierInfo.phone || '',
              email: supplierInfo.email || ''
            }
            
            setSelectedSupplier(supplier)
            setCurrentMaterialForAssignment({
              id: item.id,
              name: item.item_name,
              unit: item.unit,
              isReturnReorder: true, // İade yeniden siparişi olarak işaretle
              supplierSpecific: true, // Tedarikçi özel siparişi
              targetSupplierId: supplierInfo.supplier_id // Hedef tedarikçi ID'si
            })
            setOrderDetails({
              deliveryDate: '',
              amount: '',
              currency: 'TRY',
              quantity: returnedQuantity.toString(), // Kart üzerindeki ile aynı miktarı set et
              documents: [],
              documentPreviewUrls: []
            })
            setIsCreateOrderModalOpen(true)
          } else {
            // İade edilen malzeme için tedarikçi bilgisini al (eski yöntem - fallback)
            const itemOrders = Array.isArray(materialOrders) 
              ? materialOrders.filter((order: any) => order.material_item_id === item.id && (order.returned_quantity || 0) > 0)
              : []
            
            if (itemOrders.length > 0) {
              // Mevcut tedarikçi ile sipariş modalını aç
              const supplier = {
                id: itemOrders[0].supplier_id,
                name: itemOrders[0].supplier?.name || itemOrders[0].suppliers?.name || 'Tedarikçi',
                contact_person: itemOrders[0].supplier?.contact_person || '',
                phone: itemOrders[0].supplier?.phone || '',
                email: itemOrders[0].supplier?.email || ''
              }
              
              setSelectedSupplier(supplier)
              setCurrentMaterialForAssignment({
                id: item.id,
                name: item.item_name,
                unit: item.unit,
                isReturnReorder: true // İade yeniden siparişi olarak işaretle
              })
              setOrderDetails({
                deliveryDate: '',
                amount: '',
                currency: 'TRY',
                quantity: returnedQuantity.toString(), // İade miktarını default olarak set et
                documents: [],
                documentPreviewUrls: []
              })
              setIsCreateOrderModalOpen(true)
            } else {
              // Tedarikçi bulunamazsa tedarikçi atama modalını aç
              setCurrentMaterialForAssignment({
                id: item.id,
                name: item.item_name,
                unit: item.unit,
                isReturnReorder: true // İade yeniden siparişi olarak işaretle
              })
              setIsAssignSupplierModalOpen(true)
            }
          }
        }}
        onAssignSupplier={(materialId, materialName, materialUnit) => {
          // Tedarikçi atama modalını aç
          setCurrentMaterialForAssignment({
            id: materialId,
            name: materialName,
            unit: materialUnit
          })
          setIsAssignSupplierModalOpen(true)
        }}
        onCreateOrder={(supplier, material, returnedQuantity) => {
          // Sipariş oluşturma modalını aç
          setSelectedSupplier(supplier)
          setCurrentMaterialForAssignment({
            id: material.id,
            name: material.item_name,
            unit: material.unit,
            isReturnReorder: true // İade yeniden siparişi olarak işaretle
          })
          setOrderDetails({
            deliveryDate: '',
            amount: '',
            currency: 'TRY',
            quantity: returnedQuantity.toString(), // İade miktarını default olarak set et
            documents: [],
            documentPreviewUrls: []
          })
          setIsCreateOrderModalOpen(true)
        }}
        onExportPDF={(material) => {
          // PDF export fonksiyonunu çağır
          handleExportMaterialPDF(material)
        }}
      />

      {/* Malzeme Bazlı Tedarikçi/Sipariş Yönetimi - İade varsa gösterme */}
      {!hasReturnedMaterials && request?.purchase_request_items && request.purchase_request_items.length > 0 && (
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Malzeme Tedarikçi Yönetimi
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {request.purchase_request_items.filter(item => item.quantity > 0).length > 0 
                      ? `${request.purchase_request_items.filter(item => item.quantity > 0).length} malzeme için tedarikçi ataması ve sipariş yönetimi`
                      : 'Tüm malzemeler santiye depo tarafından gönderildi'
                    }
                  </p>
                </div>
              </div>
              
              {/* Multi-select controls */}
              {(() => {
                const activeItems = request.purchase_request_items.filter(item => {
                  if (item.quantity > 0) return true
                  if (item.quantity === 0) {
                    const hasOrders = Array.isArray(materialOrders) 
                      ? materialOrders.some(order => order.material_item_id === item.id)
                      : false
                    const hasLocalOrders = Object.values(localOrderTracking).some((order: any) => 
                      order.material_item_id === item.id
                    )
                    return !hasOrders && !hasLocalOrders
                  }
                  return false
                })
                
                return activeItems.length > 1 && (
                  <div className="flex items-center gap-3">
                    {selectedMaterials.size > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-green-600 text-white text-sm">
                          {selectedMaterials.size} Seçili
                        </Badge>
                        <Button
                          onClick={clearMaterialSelection}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2"
                        >
                          Seçimi Temizle
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllMaterials}
                      className="text-xs h-7 px-2"
                    >
                      {(() => {
                        const allMaterialIds = activeItems.map(item => item.id)
                        const allSelected = allMaterialIds.every(id => selectedMaterials.has(id))
                        return allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'
                      })()}
                    </Button>
                  </div>
                )
              })()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              {(() => {
                // Aktif malzemeler: quantity > 0 VEYA hiç sipariş kaydı yok
                const activeItems = request.purchase_request_items.filter(item => {
                  // Eğer quantity > 0 ise kesinlikle göster
                  if (item.quantity > 0) return true
                  
                  // Quantity = 0 ama hiç sipariş kaydı yoksa da göster
                  if (item.quantity === 0) {
                    const hasOrders = Array.isArray(materialOrders) 
                      ? materialOrders.some(order => order.material_item_id === item.id)
                      : false
                    const hasLocalOrders = Object.values(localOrderTracking).some((order: any) => 
                      order.material_item_id === item.id
                    )
                    
                    // Hiç sipariş kaydı yoksa göster
                    return !hasOrders && !hasLocalOrders
                  }
                  
                  return false
                })
                
                return activeItems.length === 0 ? (
                  // Tüm malzemeler gönderildi veya sipariş verildi
                  <div className="text-center py-4">
                   
                  </div>
                ) : (
                  activeItems
                  .map((item, index) => {
                    const materialSupplier = materialSuppliers[item.id] || { isRegistered: false, suppliers: [] }
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`border border-gray-200 rounded-lg p-4 transition-colors cursor-pointer ${
                          selectedMaterials.has(item.id) 
                            ? 'bg-green-50 border-green-200 border-2' 
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => toggleMaterialSelection(item.id)}
                      >
                        {/* Malzeme Header */}
                        <div className="flex items-start gap-4 mb-4">
                          {/* Checkbox */}
                          <div className="flex items-center justify-center pt-1">
                            <div 
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                selectedMaterials.has(item.id)
                                  ? 'bg-green-600 border-green-600'
                                  : 'border-gray-300 hover:border-gray-500'
                              }`}
                            >
                              {selectedMaterials.has(item.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                          {/* Malzeme Resmi */}
                          {item.image_urls && item.image_urls.length > 0 && (
                            <div className="flex-shrink-0">
                              <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <img
                                  src={item.image_urls[0]}
                                  alt={item.item_name}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                  onClick={() => {
                                    setCurrentImageGallery({
                                      images: item.image_urls,
                                      itemName: item.item_name,
                                      currentIndex: 0
                                    })
                                    setIsImageGalleryOpen(true)
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement!.innerHTML = `
                                      <div class="w-full h-full flex items-center justify-center bg-gray-200">
                                        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                        </svg>
                                      </div>
                                    `;
                                  }}
                                />
                              </div>
                              {item.image_urls.length > 1 && (
                                <div 
                                  className="text-xs text-gray-500 text-center mt-1 cursor-pointer hover:text-gray-700 transition-colors"
                                  onClick={() => {
                                    setCurrentImageGallery({
                                      images: item.image_urls,
                                      itemName: item.item_name,
                                      currentIndex: 0
                                    })
                                    setIsImageGalleryOpen(true)
                                  }}
                                >
                                  +{item.image_urls.length - 1} resim
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {request.purchase_request_items.length > 1 && (
                                <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </div>
                              )}
                              <h4 className="text-lg font-semibold text-gray-900">{item.item_name}</h4>
                            </div>
                            {item.brand && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-700">Marka:</span>
                                <span className="text-sm font-medium text-gray-900">{item.brand}</span>
                              </div>
                            )}
                            
                            {/* Kullanım Amacı */}
                            {item.purpose && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-700">Kullanım Amacı:</span>
                                <span className="text-sm font-medium text-gray-900">{item.purpose}</span>
                              </div>
                            )}
                            
                            {/* Gerekli Teslimat Tarihi */}
                            {item.delivery_date && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-700">Gerekli Tarih:</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(item.delivery_date).toLocaleDateString('tr-TR')}
                                </span>
                              </div>
                            )}
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-4">
                                <span>Kalan Miktar: <strong className={item.quantity > 0 ? 'text-orange-600' : 'text-green-600'}>{item.quantity} {item.unit}</strong></span>
                                {item.original_quantity && (
                                  <span className="text-xs text-gray-500">• İlk Talep: {item.original_quantity} {item.unit}</span>
                                )}
                                {item.specifications && (
                                  <span className="text-sm text-gray-600">• {item.specifications}</span>
                                )}
                              </div>
                              {item.description && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* PDF Export ve Tedarikçi Durumu */}
                          <div className="flex items-start gap-3">
                            {/* PDF Export Butonu */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleExportMaterialPDF(item)
                              }}
                              className="h-8 px-3 text-xs bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-sm"
                              title="Satın Alma Talep Formu PDF Export"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              PDF
                            </Button>
                            
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
                        </div>

                        {materialSupplier.isRegistered && materialSupplier.suppliers.length > 0 ? (
                          <div className="space-y-3">
                            <h5 className="text-sm font-medium text-gray-700">Sipariş Takibi:</h5>
                            
                            {/* Mevcut Siparişler Listesi */}
                            {(() => {
                              // Local tracking'den bu malzeme için siparişleri al
                              const localOrders = Object.values(localOrderTracking)
                                .filter((order: any) => order.material_item_id === item.id)
                              
                              // materialOrders'dan da bu malzeme için siparişleri al
                              const dbOrders = Array.isArray(materialOrders) 
                                ? materialOrders.filter((order: any) => order.material_item_id === item.id)
                                : []
                              
                              // İkisini birleştir (duplicate'ları önlemek için order_id kontrolü yap)
                              const allOrders = [...localOrders]
                              dbOrders.forEach((dbOrder: any) => {
                                const exists = localOrders.some((localOrder: any) => 
                                  localOrder.order_id === dbOrder.id
                                )
                                if (!exists) {
                                  allOrders.push({
                                    supplier_id: dbOrder.supplier_id,
                                    material_item_id: dbOrder.material_item_id,
                                    delivery_date: dbOrder.delivery_date,
                                    order_id: dbOrder.id,
                                    supplier_name: dbOrder.suppliers?.name || 'Bilinmeyen Tedarikçi',
                                    quantity: dbOrder.quantity || 0
                                  })
                                }
                              })
                              
                              return allOrders.map((order: any, orderIndex: number) => (
                                <div key={`${order.supplier_id}_${orderIndex}_${order.order_id}`} className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Check className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-800">Sipariş Verildi</span>
                                  </div>
                                  <div className="text-sm text-green-700 space-y-1">
                                    <div className="flex justify-between">
                                      <span>Tedarikçi:</span>
                                      <span className="font-medium">{order.supplier_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Miktar:</span>
                                      <span className="font-medium">{order.quantity} {item.unit}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Teslimat:</span>
                                      <span className="font-medium">{new Date(order.delivery_date).toLocaleDateString('tr-TR')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Sipariş ID:</span>
                                      <span className="font-medium text-gray-600">#{order.order_id.toString().slice(-8)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            })()}

                            {/* Tedarikçi Listesi */}
                            <div className="space-y-2">
                              <h6 className="text-sm font-medium text-gray-700">Mevcut Tedarikçiler:</h6>
                              <div className="grid gap-3">
                                {materialSupplier.suppliers.map((supplier: any) => {
                                  // Bu tedarikçiden bu malzeme için sipariş var mı kontrol et
                                  const localOrders = Object.values(localOrderTracking)
                                    .filter((order: any) => 
                                      order.material_item_id === item.id && 
                                      order.supplier_id === supplier.id
                                    )
                                  
                                  const dbOrders = Array.isArray(materialOrders) 
                                    ? materialOrders.filter((order: any) => 
                                        order.material_item_id === item.id && 
                                        order.supplier_id === supplier.id
                                      )
                                    : []
                                  
                                  // Birleştir ve duplicate'ları önle
                                  const supplierOrders = [...localOrders]
                                  dbOrders.forEach((dbOrder: any) => {
                                    const exists = localOrders.some((localOrder: any) => 
                                      localOrder.order_id === dbOrder.id
                                    )
                                    if (!exists) {
                                      supplierOrders.push({
                                        supplier_id: dbOrder.supplier_id,
                                        material_item_id: dbOrder.material_item_id,
                                        delivery_date: dbOrder.delivery_date,
                                        order_id: dbOrder.id,
                                        supplier_name: dbOrder.suppliers?.name || 'Bilinmeyen Tedarikçi',
                                        quantity: dbOrder.quantity || 0
                                      })
                                    }
                                  })
                                  
                                  // Toplam sipariş miktarı
                                  const totalOrderQuantity = supplierOrders.reduce((sum: number, order: any) => 
                                    sum + (order.quantity || 0), 0
                                  )
                                  
                                  return (
                                    <div key={supplier.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h6 className="font-medium text-gray-900">{supplier.name}</h6>
                                            {/* Sipariş Durumu Badge */}
                                            {supplierOrders.length > 0 && (
                                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5">
                                                ✓ Sipariş Verildi ({totalOrderQuantity} {item.unit})
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-600">{supplier.contact_person}</p>
                                          <div className="flex items-center gap-4 mt-1">
                                            <span className="text-xs text-gray-500">{supplier.phone}</span>
                                            <span className="text-xs text-gray-500">{supplier.email}</span>
                                          </div>
                                          
                                          {/* Sipariş Detayları */}
                                          {supplierOrders.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                              <div className="text-xs text-gray-600 space-y-1">
                                                {supplierOrders.map((order: any, orderIdx: number) => (
                                                  <div key={`${order.order_id}_${orderIdx}`} className="flex justify-between items-center">
                                                    <span>Sipariş #{order.order_id.toString().slice(-6)}:</span>
                                                    <span className="font-medium text-green-700">
                                                      {order.quantity} {item.unit} - {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-2 ml-3">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              router.push(`/dashboard/suppliers/${supplier.id}`)
                                            }}
                                            className="text-gray-700 border-gray-200 hover:bg-gray-50 text-xs"
                                          >
                                            Detay
                                          </Button>
                                          
                                          {/* Kısmi sipariş butonları - her zaman aktif (kalan miktar varsa) */}
                                          <Button
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setSelectedSupplier(supplier)
                                              setCurrentMaterialForAssignment({
                                                id: item.id,
                                                name: item.item_name,
                                                unit: item.unit
                                              })
                                              setOrderDetails({
                                                deliveryDate: '',
                                                amount: '',
                                                currency: 'TRY',
                                                quantity: '',
                                                documents: [],
                                                documentPreviewUrls: []
                                              })
                                              setIsCreateOrderModalOpen(true)
                                            }}
                                            disabled={item.quantity <= 0}
                                            className={`text-xs ${
                                              item.quantity <= 0 
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                : supplierOrders.length > 0
                                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                  : 'bg-green-600 hover:bg-green-700 text-white'
                                            }`}
                                          >
                                            <Package className="h-3 w-3 mr-1" />
                                            {item.quantity <= 0 
                                              ? 'Tamamlandı' 
                                              : supplierOrders.length > 0 
                                                ? 'Ek Sipariş' 
                                                : 'Sipariş Ver'
                                            }
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                            
                            {/* Ek Tedarikçi Ekleme Butonu */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCurrentMaterialForAssignment({
                                    id: item.id,
                                    name: item.item_name,
                                    unit: item.unit
                                  })
                                  setIsAssignSupplierModalOpen(true)
                                }}
                                className="w-full h-10 border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Başka Tedarikçi Ekle
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="mb-3">
                              <p className="text-sm text-gray-600 mb-2">Bu malzeme için henüz tedarikçi atanmamış</p>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
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
                        
                        {/* Tamamı Sipariş Verilen Malzeme için Sipariş Özeti */}
                        {item.quantity <= 0 && (() => {
                          // Bu malzeme için tüm siparişleri topla
                          const localOrders = Object.values(localOrderTracking)
                            .filter((order: any) => order.material_item_id === item.id)
                          
                          const dbOrders = Array.isArray(materialOrders) 
                            ? materialOrders.filter((order: any) => order.material_item_id === item.id)
                            : []
                          
                          // Birleştir ve duplicate'ları önle
                          const allOrders = [...localOrders]
                          dbOrders.forEach((dbOrder: any) => {
                            const exists = localOrders.some((localOrder: any) => 
                              localOrder.order_id === dbOrder.id
                            )
                            if (!exists) {
                              allOrders.push({
                                supplier_id: dbOrder.supplier_id,
                                delivery_date: dbOrder.delivery_date,
                                order_id: dbOrder.id,
                                supplier_name: dbOrder.suppliers?.name || 'Bilinmeyen Tedarikçi',
                                quantity: dbOrder.quantity || 0
                              })
                            }
                          })
                          
                          if (allOrders.length === 0) return null
                          
                          return (
                            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Check className="h-5 w-5 text-green-600" />
                                <h6 className="text-sm font-semibold text-green-800">Sipariş Özeti - Tamamlandı</h6>
                              </div>
                              
                              <div className="space-y-3">
                                {allOrders.map((order: any, idx: number) => (
                                  <div key={`summary_${order.order_id}_${idx}`} className="bg-white rounded-lg p-3 border border-green-200">
                                    <div className="flex items-start gap-3">
                                      {/* Malzeme Görseli */}
                                      <div className="flex-shrink-0">
                                        {item.image_urls && item.image_urls.length > 0 ? (
                                          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-green-200 shadow-sm">
                                            <img
                                              src={item.image_urls[0]}
                                              alt={item.item_name}
                                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                              onClick={() => {
                                                setCurrentImageGallery({
                                                  images: item.image_urls,
                                                  itemName: item.item_name,
                                                  currentIndex: 0
                                                })
                                                setIsImageGalleryOpen(true)
                                              }}
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                target.parentElement!.innerHTML = `
                                                  <div class="w-full h-full flex items-center justify-center bg-gray-200">
                                                    <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                    </svg>
                                                  </div>
                                                `;
                                              }}
                                            />
                                          </div>
                                        ) : (
                                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center border border-green-200">
                                            <Package className="w-4 h-4 text-green-600" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex-1">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <span className="text-gray-600">Tedarikçi:</span>
                                            <p className="font-semibold text-green-900">{order.supplier_name}</p>
                                          </div>
                                          <div>
                                            <span className="text-gray-600">Miktar:</span>
                                            <p className="font-semibold text-green-900">{order.quantity} {item.unit}</p>
                                          </div>
                                          <div>
                                            <span className="text-gray-600">Teslimat Tarihi:</span>
                                            <p className="font-semibold text-green-900">
                                              {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                            </p>
                                          </div>
                                          <div>
                                            <span className="text-gray-600">Sipariş No:</span>
                                            <p className="font-mono text-xs text-green-800 bg-green-100 px-2 py-1 rounded">
                                              #{order.order_id.toString().slice(-8)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Toplam Özet */}
                                <div className="border-t border-green-200 pt-3 mt-3 bg-green-100 rounded-lg p-3 -mx-1">
                                  <h6 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Toplam Özet</h6>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white rounded-lg p-2 text-center">
                                      <div className="text-xs text-green-600 font-medium">Toplam Miktar</div>
                                      <div className="text-lg font-bold text-green-900">
                                        {allOrders.reduce((total, order) => total + (order.quantity || 0), 0)}
                                      </div>
                                      <div className="text-xs text-green-700">{item.unit}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 text-center">
                                      <div className="text-xs text-green-600 font-medium">Sipariş Sayısı</div>
                                      <div className="text-lg font-bold text-green-900">{allOrders.length}</div>
                                      <div className="text-xs text-green-700">adet</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })
                )
              })()}
            </div>
            
            {/* Genel Bilgilendirme - Sadece aktif malzemeler varsa göster */}
            {(() => {
              const activeItems = request.purchase_request_items.filter(item => {
                if (item.quantity > 0) return true
                if (item.quantity === 0) {
                  const hasOrders = Array.isArray(materialOrders) 
                    ? materialOrders.some(order => order.material_item_id === item.id)
                    : false
                  const hasLocalOrders = Object.values(localOrderTracking).some((order: any) => 
                    order.material_item_id === item.id
                  )
                  return !hasOrders && !hasLocalOrders
                }
                return false
              })
              return activeItems.length > 0
            })() && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs">i</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">
                      Malzeme Tedarikçi Sistemi
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Her malzeme için ayrı tedarikçi atayabilir ve direkt sipariş oluşturabilirsiniz. Bir malzeme için birden fazla tedarikçiden kısmi sipariş verebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sipariş Özeti - Kalıcı Alan */}
      {(() => {
        // Tüm siparişleri topla (hem local hem de DB'den)
        const allLocalOrders = Object.values(localOrderTracking)
        const allDbOrders = Array.isArray(materialOrders) ? materialOrders : []
        
        // Birleştir ve duplicate'ları önle
        const combinedOrders = [...allLocalOrders]
        allDbOrders.forEach((dbOrder: any) => {
          const exists = allLocalOrders.some((localOrder: any) => 
            localOrder.order_id === dbOrder.id
          )
          if (!exists) {
            combinedOrders.push({
              supplier_id: dbOrder.supplier_id,
              material_item_id: dbOrder.material_item_id,
              delivery_date: dbOrder.delivery_date,
              order_id: dbOrder.id,
              supplier_name: dbOrder.suppliers?.name || 'Bilinmeyen Tedarikçi',
              quantity: dbOrder.quantity || 0,
              amount: dbOrder.amount || 0,
              currency: dbOrder.currency || 'TRY',
              created_at: dbOrder.created_at
            })
          }
        })

        // Bu talep için olan siparişleri filtrele
        const requestOrders = combinedOrders.filter((order: any) => 
          order.material_item_id && 
          request?.purchase_request_items?.some((item: any) => item.id === order.material_item_id)
        )

        if (requestOrders.length === 0) return null

        return (
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    Sipariş Özeti
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Bu talep için verilen {requestOrders.length} sipariş
                  </p>
                </div>
                <div className="ml-auto">
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                    {requestOrders.length} Sipariş
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requestOrders
                  .sort((a: any, b: any) => new Date(b.created_at || b.delivery_date).getTime() - new Date(a.created_at || a.delivery_date).getTime())
                  .map((order: any, index: number) => {
                    // Malzeme bilgisini bul
                    const materialItem = request?.purchase_request_items?.find(
                      (item: any) => item.id === order.material_item_id
                    )
                    
                    return (
                      <div key={`${order.order_id}_${index}`} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-4">
                          {/* Malzeme Görseli */}
                          <div className="flex-shrink-0">
                            {materialItem?.image_urls && materialItem.image_urls.length > 0 ? (
                              <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <img
                                  src={materialItem.image_urls[0]}
                                  alt={materialItem.item_name}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                  onClick={() => {
                                    setCurrentImageGallery({
                                      images: materialItem.image_urls,
                                      itemName: materialItem.item_name,
                                      currentIndex: 0
                                    })
                                    setIsImageGalleryOpen(true)
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement!.innerHTML = `
                                      <div class="w-full h-full flex items-center justify-center bg-gray-200">
                                        <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                        </svg>
                                      </div>
                                    `;
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            
                            {materialItem?.image_urls && materialItem.image_urls.length > 1 && (
                              <div 
                                className="text-xs text-gray-500 text-center mt-1 cursor-pointer hover:text-gray-700 transition-colors"
                                onClick={() => {
                                  setCurrentImageGallery({
                                    images: materialItem.image_urls,
                                    itemName: materialItem.item_name,
                                    currentIndex: 0
                                  })
                                  setIsImageGalleryOpen(true)
                                }}
                              >
                                +{materialItem.image_urls.length - 1} resim
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900">
                                {order.supplier_name}
                              </h4>
                              <Badge variant="outline" className="bg-white border-gray-300 text-gray-700 text-xs">
                                Sipariş Verildi
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600 font-medium block">Malzeme:</span>
                                <p className="text-gray-900 font-semibold truncate" title={materialItem?.item_name}>
                                  {materialItem?.item_name || 'Bilinmeyen Malzeme'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium block">Miktar:</span>
                                <p className="text-gray-900 font-semibold">
                                  {order.quantity} {materialItem?.unit || ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium block">Teslimat:</span>
                                <p className="text-gray-900 font-semibold">
                                  {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium block">Sipariş No:</span>
                                <p className="text-gray-900 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                  #{order.order_id.toString().slice(-8)}
                                </p>
                              </div>
                            </div>
                            
                            {order.amount > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <span className="text-gray-600 font-medium text-sm">Tutar: </span>
                                <span className="text-gray-900 font-bold">
                                  {getCurrencySymbol(order.currency)}{Number(order.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xs text-gray-600 mb-1">
                              {order.created_at ? 
                                new Date(order.created_at).toLocaleDateString('tr-TR') : 
                                'Bugün'
                              }
                            </div>
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">
                              ✓ Aktif
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                
                {/* Toplam Özet */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Genel Özet
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-600 font-medium mb-1">Toplam Sipariş</div>
                      <div className="text-lg font-bold text-gray-900">{requestOrders.length}</div>
                      <div className="text-xs text-gray-500">adet</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-600 font-medium mb-1">Tedarikçi Sayısı</div>
                      <div className="text-lg font-bold text-gray-900">
                        {new Set(requestOrders.map((order: any) => order.supplier_id)).size}
                      </div>
                      <div className="text-xs text-gray-500">firma</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-600 font-medium mb-1">Malzeme Çeşidi</div>
                      <div className="text-lg font-bold text-gray-900">
                        {new Set(requestOrders.map((order: any) => order.material_item_id)).size}
                      </div>
                      <div className="text-xs text-gray-500">kalem</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
                      <div className="text-xs text-gray-600 font-medium mb-1">Toplam Tutar</div>
                      <div className="text-lg font-bold text-gray-900">
                        {(() => {
                          const totalAmount = requestOrders.reduce((sum: number, order: any) => 
                            sum + (order.amount || 0), 0
                          )
                          return totalAmount > 0 ? 
                            `${getCurrencySymbol('TRY')}${totalAmount.toLocaleString('tr-TR')}` : 
                            'Belirsiz'
                        })()}
                      </div>
                      <div className="text-xs text-gray-500">TRY</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Mevcut Teklifler */}
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
                  <Button
                    onClick={() => openOfferModal(offer)}
                    variant="outline"
                    className="w-full h-10 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 font-medium rounded-lg"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Teklifi İncele
                  </Button>
                  
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

      {/* Teklif Girişi Formu */}
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
                              <div className="w-full h-full flex flex-col items-center justify-center">
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

      {/* Modals */}
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
                      quantity: '',
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
              {/* Malzeme Bilgisi */}
              {currentMaterialForAssignment && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Malzeme Bilgileri</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Malzeme Adı:</span>
                      <p className="font-medium text-gray-900">{currentMaterialForAssignment.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">
                        {currentMaterialForAssignment?.isReturnReorder ? 
                          (currentMaterialForAssignment?.supplierSpecific ? 'Bu Tedarikçiden İade Edilen:' : 'İade Edilen Miktar:') : 
                          'Talep Edilen Miktar:'
                        }
                      </span>
                      <p className="font-medium text-gray-900">
                        {(() => {
                          if (currentMaterialForAssignment?.isReturnReorder) {
                            if (currentMaterialForAssignment?.supplierSpecific && currentMaterialForAssignment?.targetSupplierId) {
                              // Tedarikçi özel iade için: sadece o tedarikçiden iade edilen miktarı göster
                              const supplierReturnedQuantity = Array.isArray(materialOrders) 
                                ? materialOrders
                                    .filter((order: any) => 
                                      order.material_item_id === currentMaterialForAssignment.id && 
                                      order.supplier_id === currentMaterialForAssignment.targetSupplierId &&
                                      (order.returned_quantity || 0) > 0
                                    )
                                    .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                                : 0
                              
                              const alreadyReordered = Array.isArray(materialOrders) 
                                ? materialOrders
                                    .filter((order: any) => 
                                      order.material_item_id === currentMaterialForAssignment.id &&
                                      order.supplier_id === currentMaterialForAssignment.targetSupplierId &&
                                      order.is_return_reorder === true
                                    )
                                    .reduce((sum: number, order: any) => sum + (order.quantity || 0), 0)
                                : 0
                              
                              return `${supplierReturnedQuantity} ${currentMaterialForAssignment.unit} (Kalan: ${Math.max(0, supplierReturnedQuantity - alreadyReordered)} ${currentMaterialForAssignment.unit})`
                            } else {
                              // Genel iade için: tüm iade edilen miktarı göster
                              const returnedQuantity = Array.isArray(materialOrders) 
                                ? materialOrders
                                    .filter((order: any) => 
                                      order.material_item_id === currentMaterialForAssignment.id && 
                                      (order.returned_quantity || 0) > 0
                                    )
                                    .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                                : 0
                              return `${returnedQuantity} ${currentMaterialForAssignment.unit}`
                            }
                          } else {
                            // Normal sipariş için: purchase_request_items tablosundan quantity al
                            const quantity = request?.purchase_request_items?.find(item => item.id === currentMaterialForAssignment.id)?.quantity || 0
                            return `${quantity} ${currentMaterialForAssignment.unit}`
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sipariş Miktarı *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(() => {
                      if (!currentMaterialForAssignment) return undefined
                      
                      if (currentMaterialForAssignment.isReturnReorder) {
                        // İade yeniden siparişi için: orders tablosundan returned_quantity toplamını al
                        const returnedQuantity = Array.isArray(materialOrders) 
                          ? materialOrders
                              .filter((order: any) => 
                                order.material_item_id === currentMaterialForAssignment.id && 
                                (order.returned_quantity || 0) > 0
                              )
                              .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                          : 0
                        return returnedQuantity
                      } else {
                        // Normal sipariş için: purchase_request_items tablosundan quantity al
                        return request?.purchase_request_items?.find(item => item.id === currentMaterialForAssignment.id)?.quantity || 0
                      }
                    })()}
                    value={orderDetails.quantity}
                    onChange={(e) => setOrderDetails({
                      ...orderDetails,
                      quantity: e.target.value
                    })}
                    placeholder="Sipariş miktarını girin"
                    className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 pr-16"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {currentMaterialForAssignment?.unit}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maksimum: {(() => {
                    if (!currentMaterialForAssignment) return 0
                    
                    if (currentMaterialForAssignment.isReturnReorder) {
                      if (currentMaterialForAssignment.supplierSpecific && currentMaterialForAssignment.targetSupplierId) {
                        // Tedarikçi özel iade için: sadece o tedarikçiden iade edilen miktarı göster
                        const supplierReturnedQuantity = Array.isArray(materialOrders) 
                          ? materialOrders
                              .filter((order: any) => 
                                order.material_item_id === currentMaterialForAssignment.id && 
                                order.supplier_id === currentMaterialForAssignment.targetSupplierId &&
                                (order.returned_quantity || 0) > 0
                              )
                              .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                          : 0
                        
                        const alreadyReordered = Array.isArray(materialOrders) 
                          ? materialOrders
                              .filter((order: any) => 
                                order.material_item_id === currentMaterialForAssignment.id &&
                                order.supplier_id === currentMaterialForAssignment.targetSupplierId &&
                                order.is_return_reorder === true
                              )
                              .reduce((sum: number, order: any) => sum + (order.quantity || 0), 0)
                          : 0
                        
                        return Math.max(0, supplierReturnedQuantity - alreadyReordered)
                      } else {
                        // Genel iade için: tüm iade edilen miktarı göster
                        return Array.isArray(materialOrders) 
                          ? materialOrders
                              .filter((order: any) => 
                                order.material_item_id === currentMaterialForAssignment.id && 
                                (order.returned_quantity || 0) > 0
                              )
                              .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                          : 0
                      }
                    } else {
                      // Normal sipariş için
                      return request?.purchase_request_items?.find(item => item.id === currentMaterialForAssignment.id)?.quantity || 0
                    }
                  })()} {currentMaterialForAssignment?.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teslimat Tarihi *
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
                    quantity: '',
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

                    if (!orderDetails.deliveryDate) {
                      showToast('Lütfen teslimat tarihini seçin.', 'error')
                      return
                    }

                    if (!orderDetails.quantity || parseFloat(orderDetails.quantity) <= 0) {
                      showToast('Lütfen geçerli bir sipariş miktarı girin.', 'error')
                      return
                    }

                    const orderQuantity = parseFloat(orderDetails.quantity)
                    
                    // Max quantity kontrolü - iade yeniden siparişi için farklı logic
                    const maxQuantity = (() => {
                      if (currentMaterialForAssignment?.isReturnReorder) {
                        if (currentMaterialForAssignment?.supplierSpecific && currentMaterialForAssignment?.targetSupplierId) {
                          // Tedarikçi özel iade yeniden siparişi için: sadece o tedarikçiden iade edilen miktarı al
                          const supplierReturnedQuantity = Array.isArray(materialOrders) 
                            ? materialOrders
                                .filter((order: any) => 
                                  order.material_item_id === currentMaterialForAssignment.id && 
                                  order.supplier_id === currentMaterialForAssignment.targetSupplierId &&
                                  (order.returned_quantity || 0) > 0
                                )
                                .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                            : 0
                          
                          // Daha önce yeniden sipariş verilen miktarı çıkar
                          const alreadyReordered = Array.isArray(materialOrders) 
                            ? materialOrders
                                .filter((order: any) => 
                                  order.material_item_id === currentMaterialForAssignment.id &&
                                  order.supplier_id === currentMaterialForAssignment.targetSupplierId &&
                                  order.is_return_reorder === true
                                )
                                .reduce((sum: number, order: any) => sum + (order.quantity || 0), 0)
                            : 0
                          
                          return Math.max(0, supplierReturnedQuantity - alreadyReordered)
                        } else {
                          // Genel iade yeniden siparişi için: orders tablosundan returned_quantity toplamını al
                          return Array.isArray(materialOrders) 
                            ? materialOrders
                                .filter((order: any) => 
                                  order.material_item_id === currentMaterialForAssignment.id && 
                                  (order.returned_quantity || 0) > 0
                                )
                                .reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
                            : 0
                        }
                      } else {
                        // Normal sipariş için: purchase_request_items tablosundan quantity al
                        const currentItem = request?.purchase_request_items?.find(item => item.id === currentMaterialForAssignment?.id)
                        return currentItem?.quantity || 0
                      }
                    })()

                    if (orderQuantity > maxQuantity) {
                      const quantityType = currentMaterialForAssignment?.isReturnReorder ? 'iade edilen miktarı' : 'talep edilen miktarı'
                      showToast(`Sipariş miktarı ${quantityType} (${maxQuantity}) aşamaz.`, 'error')
                      return
                    }

                    const uploadedUrls: string[] = []

                    console.log('📦 Sipariş kaydı oluşturuluyor...')
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
                    
                    if (sessionError || !session?.user?.id) {
                      throw new Error('Aktif bir oturum bulunamadı. Lütfen tekrar giriş yapın.')
                    }

                    orderData = {
                      purchase_request_id: request.id,
                      supplier_id: selectedSupplier.id,
                      delivery_date: orderDetails.deliveryDate,
                      amount: 0,
                      currency: orderDetails.currency,
                      document_urls: uploadedUrls,
                      user_id: session.user.id,
                      material_item_id: currentMaterialForAssignment?.id || null,
                      quantity: orderQuantity,  // Sipariş miktarını kaydet
                      is_return_reorder: currentMaterialForAssignment?.isReturnReorder || false, // İade yeniden siparişi flag'i
                      status: 'pending' // Explicit status ekle
                    }

                    const { data: order, error: orderError } = await supabase
                      .from('orders')
                      .insert(orderData)
                      .select()
                      .single()

                    if (orderError) {
                      throw new Error(`Sipariş oluşturma hatası: ${orderError.message}`)
                    }

                    console.log('✅ Sipariş oluşturuldu:', order)

                    // Malzemeden sipariş edilen miktarı çıkar
                    if (currentMaterialForAssignment && orderQuantity > 0) {
                      const newQuantity = Math.max(0, maxQuantity - orderQuantity)
                      console.log('📊 Miktar güncelleniyor:', {
                        materialId: currentMaterialForAssignment.id,
                        oldQuantity: maxQuantity,
                        orderQuantity: orderQuantity,
                        newQuantity: newQuantity
                      })

                      // Önce RPC function ile güvenli güncelleme dene
                      const { error: rpcError } = await supabase
                        .rpc('update_purchase_request_item_quantity', {
                          item_id: currentMaterialForAssignment.id,
                          new_quantity: newQuantity
                        })

                      if (rpcError) {
                        console.log('⚠️ RPC başarısız, direkt update deneniyor:', rpcError)
                        
                        // RPC başarısızsa direkt update dene
                        const { error: updateError } = await supabase
                          .from('purchase_request_items')
                          .update({ 
                            quantity: newQuantity,
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', currentMaterialForAssignment.id)

                        if (updateError) {
                          console.error('⚠️ Miktar güncellenirken hata:', updateError)
                          showToast('Sipariş oluşturuldu ancak miktar güncellenemedi.', 'info')
                        } else {
                          console.log('✅ Malzeme miktarı güncellendi (direkt):', newQuantity)
                        }
                      } else {
                        console.log('✅ Malzeme miktarı güncellendi (RPC):', newQuantity)
                      }
                    }

                    // Local tracking'e sipariş bilgisini ekle
                    if (currentMaterialForAssignment) {
                      const orderInfo = {
                        supplier_id: selectedSupplier.id,
                        material_item_id: currentMaterialForAssignment.id,
                        delivery_date: orderDetails.deliveryDate,
                        order_id: order.id,
                        supplier_name: selectedSupplier.name,
                        quantity: orderQuantity
                      }
                      
                      const materialBasedKey = `${currentMaterialForAssignment.id}_${selectedSupplier.id}_${Date.now()}`
                      
                      setLocalOrderTracking(prev => ({
                        ...prev,
                        [materialBasedKey]: orderInfo
                      }))
                      
                      console.log('✅ Local tracking güncellendi:', {
                        materialBasedKey: materialBasedKey,
                        materialName: currentMaterialForAssignment.name,
                        orderId: order.id
                      })
                    } else {
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
                    }

                    // Talep durumunu güncelleme - otomatik trigger halleder veya manuel kontrol

                    showToast('Sipariş başarıyla oluşturuldu!', 'success')
                    
                    setIsCreateOrderModalOpen(false)
                    setSelectedSupplier(null)
                    setCurrentMaterialForAssignment(null)
                    setOrderDetails({
                      deliveryDate: '',
                      amount: '',
                      currency: 'TRY',
                      quantity: '',
                      documents: [],
                      documentPreviewUrls: []
                    })

                    await onRefresh()

                  } catch (error: any) {
                    console.error('❌ Sipariş oluşturma hatası:', error)
                    showToast(
                      error?.message || 'Sipariş oluşturulurken bir hata oluştu.',
                      'error'
                    )
                  }
                }}
                disabled={!orderDetails.deliveryDate || !orderDetails.quantity || parseFloat(orderDetails.quantity) <= 0}
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

            <div className="p-6 space-y-6">
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
                            />
                          )}
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
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 -m-6 mt-6 rounded-b-2xl">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={closeOfferModal}
                    className="px-6"
                  >
                    Kapat
                  </Button>
                  {!selectedOffer.is_selected && request?.status !== 'approved' && (
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

            <div className="p-6 space-y-6">
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
          clearMaterialSelection() // Çoklu seçimi temizle
        }}
        itemName={currentMaterialForAssignment?.name || firstItem?.item_name || ''}
        itemUnit={currentMaterialForAssignment?.unit || firstItem?.unit}
        materialClass={request?.material_class || undefined}
        materialGroup={request?.material_group || undefined}
        selectedMaterials={selectedMaterials.size > 0 ? selectedMaterials : undefined}
        materialItems={selectedMaterials.size > 0 ? request?.purchase_request_items : undefined}
        isBulkOrder={currentMaterialForAssignment?.isBulkOrder || false}
        onBulkOrderWithSupplier={async (supplier) => {
          console.log('🔄 Toplu sipariş için tedarikçi seçildi:', supplier.name)
          
          // Önce tedarikçi atamasını yap
          if (selectedMaterials.size > 0 && request?.purchase_request_items) {
            const selectedMaterialsData = request.purchase_request_items.filter(
              item => selectedMaterials.has(item.id)
            )

            try {
              setAssigningSupplier(true)
              
              // Her malzeme için tedarikçi ataması yap
              for (const material of selectedMaterialsData) {
                // Önce bu tedarikçi-ürün ilişkisi zaten var mı kontrol et
                const materialData = material as any // Type assertion for extended properties
                const { data: existingAssignment } = await supabase
                  .from('supplier_materials')
                  .select('id')
                  .eq('supplier_id', supplier.id)
                  .eq('material_item', material.item_name)
                  .eq('material_class', materialData.material_class || 'Genel')
                  .eq('material_group', materialData.material_group || 'Diğer')
                  .single()

                if (!existingAssignment) {
                  // Yeni atama oluştur
                  const insertData = {
                    supplier_id: supplier.id,
                    material_item: material.item_name,
                    material_class: materialData.material_class || 'Genel',
                    material_group: materialData.material_group || 'Diğer'
                  }

                  await supabase
                    .from('supplier_materials')
                    .insert(insertData)
                }
              }

              console.log('✅ Tedarikçi atamaları tamamlandı')
              
              // Modal'ı kapat
              setIsAssignSupplierModalOpen(false)
              setCurrentMaterialForAssignment(null)
              
              // Sipariş modalını aç
              openBulkOrderModal(supplier, selectedMaterialsData)
              
            } catch (error: any) {
              console.error('❌ Tedarikçi atama hatası:', error)
              showToast(`Hata: ${error.message}`, 'error')
            } finally {
              setAssigningSupplier(false)
            }
          }
        }}
        onSuccess={() => {
          clearMaterialSelection() // Başarılı atama sonrası seçimi temizle
          onRefresh()
        }}
      />

      {/* PDF Preview Modal */}
      {isPDFModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Malzeme Teklif Formu</h2>
                <p className="text-gray-500 mt-1">
                  {currentPDFData?.material.item_name} - PDF Önizleme
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setIsPDFModalOpen(false)}
                className="w-10 h-10 p-0 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div className="bg-white rounded-lg shadow-sm max-w-3xl mx-auto">
                <iframe
                  srcDoc={pdfHtmlContent}
                  className="w-full h-[600px] border-0 rounded-lg"
                  title="PDF Preview"
                />
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleShareWhatsApp}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp'ta Paylaş
                </Button>
                
                <Button
                  onClick={handleDownloadPDF}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  PDF İndir
                </Button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-xs text-gray-500">
                  PDF'i tedarikçilere gönderebilir veya indirebilirsiniz
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resim Galerisi Modal */}
      {isImageGalleryOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 text-white">
              <div>
                <h2 className="text-xl font-semibold">{currentImageGallery.itemName}</h2>
                <p className="text-sm text-gray-300">
                  {currentImageGallery.currentIndex + 1} / {currentImageGallery.images.length}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setIsImageGalleryOpen(false)}
                className="w-10 h-10 p-0 rounded-full text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Ana Resim */}
            <div className="flex-1 flex items-center justify-center relative">
              <img
                src={currentImageGallery.images[currentImageGallery.currentIndex]}
                alt={`${currentImageGallery.itemName} - ${currentImageGallery.currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />

              {/* Navigasyon Okları */}
              {currentImageGallery.images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const newIndex = currentImageGallery.currentIndex === 0 
                        ? currentImageGallery.images.length - 1 
                        : currentImageGallery.currentIndex - 1
                      setCurrentImageGallery(prev => ({...prev, currentIndex: newIndex}))
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 p-0 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const newIndex = currentImageGallery.currentIndex === currentImageGallery.images.length - 1 
                        ? 0 
                        : currentImageGallery.currentIndex + 1
                      setCurrentImageGallery(prev => ({...prev, currentIndex: newIndex}))
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 p-0 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
            </div>

            {/* Küçük Resim Galerisi */}
            {currentImageGallery.images.length > 1 && (
              <div className="mt-4 flex justify-center gap-2 overflow-x-auto pb-2">
                {currentImageGallery.images.map((imageUrl, index) => (
                  <div
                    key={index}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all duration-200 flex-shrink-0 ${
                      index === currentImageGallery.currentIndex 
                        ? 'border-white shadow-lg' 
                        : 'border-gray-500 opacity-70 hover:opacity-100'
                    }`}
                    onClick={() => setCurrentImageGallery(prev => ({...prev, currentIndex: index}))}
                  >
                    <img
                      src={imageUrl}
                      alt={`Küçük resim ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Bulk Supplier Assignment Button */}
      {selectedMaterials.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-black rounded-2xl shadow-2xl border border-gray-800 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedMaterials.size} malzeme seçildi
                  </p>
                  <p className="text-xs text-gray-300">
                    Toplu tedarikçi ataması yapabilirsiniz
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearMaterialSelection}
                  className="text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
                >
                  İptal
                </Button>
                <Button
                  onClick={handleBulkSupplierAssignment}
                  className="bg-white hover:bg-gray-100 text-black px-6 py-2 rounded-xl font-medium shadow-lg"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Tedarikçi Ata
                </Button>
                <Button
                  onClick={handleBulkOrderClick}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-medium shadow-lg"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Toplu Sipariş Ver
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toplu Sipariş Modal */}
      {isBulkOrderModalOpen && bulkOrderSupplier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Toplu Sipariş Oluştur</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Tedarikçi: {bulkOrderSupplier.name} • {selectedMaterials.size} malzeme
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsBulkOrderModalOpen(false)
                    setBulkOrderSupplier(null)
                    setBulkOrderDetails({})
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="space-y-4">
                {(() => {
                  const selectedMaterialsData = request?.purchase_request_items?.filter(
                    item => selectedMaterials.has(item.id)
                  ) || []

                  return selectedMaterialsData.map((material, index) => (
                    <div key={material.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start gap-4">
                        {/* Malzeme Görseli */}
                        {material.image_urls && material.image_urls.length > 0 && (
                          <div className="flex-shrink-0">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              <img
                                src={material.image_urls[0]}
                                alt={material.item_name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="flex-1">
                          {/* Malzeme Bilgileri */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <h4 className="font-semibold text-gray-900">{material.item_name}</h4>
                          </div>

                          {material.brand && (
                            <p className="text-sm text-gray-600 mb-2">Marka: {material.brand}</p>
                          )}

                          {/* Miktar ve Teslimat Tarihi */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sipariş Miktarı *
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={material.quantity}
                                  value={bulkOrderDetails[material.id]?.quantity || ''}
                                  onChange={(e) => updateBulkOrderDetail(material.id, 'quantity', e.target.value)}
                                  placeholder="Miktar"
                                  className="h-11 bg-white rounded-lg border-gray-300 pr-16"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                  {material.unit}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Kalan: {material.quantity} {material.unit}
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Teslimat Tarihi *
                              </label>
                              <Input
                                type="date"
                                value={bulkOrderDetails[material.id]?.deliveryDate || ''}
                                onChange={(e) => updateBulkOrderDetail(material.id, 'deliveryDate', e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="h-11 bg-white rounded-lg border-gray-300"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkOrderModalOpen(false)
                  setBulkOrderSupplier(null)
                  setBulkOrderDetails({})
                }}
              >
                İptal
              </Button>
              <Button
                onClick={handleBulkOrderSubmit}
                disabled={(() => {
                  // Tüm malzemeler için miktar ve teslimat tarihi girilmiş mi kontrol et
                  const selectedMaterialsData = request?.purchase_request_items?.filter(
                    item => selectedMaterials.has(item.id)
                  ) || []

                  return selectedMaterialsData.some(material => {
                    const details = bulkOrderDetails[material.id]
                    return !details?.quantity || !details?.deliveryDate || parseFloat(details.quantity) <= 0
                  })
                })()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Package className="h-4 w-4 mr-2" />
                Siparişleri Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
