'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Save, Package, Building2, Calendar, DollarSign, Truck, FileText, Check, AlertCircle, X, Camera, Upload, ImageIcon } from 'lucide-react'
import { addOffers, updateSiteExpenses } from '@/lib/actions'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'

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

  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [existingOffers, setExistingOffers] = useState<any[]>([])
  const [newOffers, setNewOffers] = useState<Offer[]>([
    { supplier_name: '', unit_price: 0, total_price: 0, delivery_days: 0, delivery_date: '', notes: '', currency: 'TRY', documents: [], documentPreviewUrls: [] }
  ])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (requestId) {
      fetchRequestData()
      fetchExistingOffers()
    }
  }, [requestId])

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
      if (e.key === 'Escape' && isModalOpen) {
        closeOfferModal()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isModalOpen])

  // Modal açıldığında body scroll'unu engelle
  useEffect(() => {
    if (isModalOpen) {
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
  }, [isModalOpen])

  const fetchRequestData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching request with ID:', requestId)
      
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          purchase_request_items(*),
          profiles!purchase_requests_requested_by_fkey(full_name, email)
        `)
        .eq('id', requestId)
        .single()
      
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

  const isValidOffer = (offer: Offer) => {
    return offer.supplier_name.trim() !== '' && 
           offer.unit_price > 0 && 
           offer.delivery_days >= 0 && 
           offer.documents.length > 0 // Döküman zorunlu
  }

  const uploadDocuments = async (offerIndex: number, documents: File[]) => {
    console.log('🚀 uploadDocuments called with:', { offerIndex, documentsCount: documents.length })
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

      await addOffers(requestId, offersWithDocuments)
      
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

  const handleApproveOffer = async (offerId: string) => {
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

      // Seçilen teklifi approved olarak işaretle
      await supabase
        .from('offers')
        .update({ 
          is_selected: true,
          selected_at: new Date().toISOString()
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

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-gray-900 text-white'
      case 'high': return 'bg-gray-800 text-white'
      case 'normal': return 'bg-gray-700 text-white'
      case 'low': return 'bg-gray-600 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-700 text-white'
      case 'awaiting_offers': return 'bg-gray-800 text-white'
      case 'approved': return 'bg-gray-900 text-white'
      default: return 'bg-gray-600 text-white'
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
    <div className="min-h-screen">
      {/* Apple-style Header */}
      <div className=" backdrop-blur-xl sticky top-0 z-10 border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Sol taraf - Geri butonu ve başlık */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/requests')}
                className="flex items-center gap-2 hover:bg-gray-100/80 rounded-full px-3 h-9 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">Geri</span>
              </Button>
              <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Teklif Girişi</h1>
                <p className="text-sm text-gray-500 font-medium">{request.request_number}</p>
              </div>
            </div>

            {/* Sağ taraf - Status badge'leri */}
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${getUrgencyColor(request.urgency_level)}`}>
                {request.urgency_level === 'critical' ? 'Kritik' : 
                 request.urgency_level === 'high' ? 'Yüksek' :
                 request.urgency_level === 'normal' ? 'Normal' : 'Düşük'}
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                {request.status === 'pending' ? 'Beklemede' :
                 request.status === 'awaiting_offers' ? 'Onay Bekliyor' : request.status}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Hamburger hizasında */}
      <div className="sm:hidden bg-white/80 backdrop-blur-xl border-b border-gray-100/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Teklif Detayı</h2>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6 lg:space-y-8">
          
          {/* Üst Bölüm - Talep Detayları ve Ürün Bilgileri Yan Yana */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            
            {/* Sol Panel - Talep Detayları */}
            <div className="space-y-6">
              {/* Şantiye Bilgisi - Sade */}
              <div className="mb-14">
                {/* Sadece şantiye adı, büyükçe */}
                {request.site_name ? (
                  <h2 className="text-6xl font-light text-gray-900">{request.site_name}</h2>
                ) : request.sites ? (
                  <h2 className="text-6xl font-bold text-gray-900">{request.sites.name}</h2>
                ) : request.construction_sites ? (
                  <h2 className="text-3xl font-bold text-gray-900">{request.construction_sites.name}</h2>
                ) : (
                  <h2 className="text-3xl font-bold text-gray-900">{request.department} Şantiyesi</h2>
                )}
              </div>

              {/* Talep Detayları */}
              <div className="rounded-2xl p-8 shadow-sm min-h-[300px] flex flex-col justify-between" style={{ backgroundColor: '#000000' }}>
                <div className="mb-8">
                  <h3 className="text-3xl font-light text-white mb-2">Talep Detayları</h3>
                  <p className="text-base text-white/80">Temel bilgiler</p>
                </div>
                
                <div className="space-y-8 flex-1">
                  <div>
                    <p className="text-base font-medium text-white/70 mb-3 uppercase tracking-wide">Başlık</p>
                    <p className="text-2xl text-white font-medium leading-relaxed">{request.title}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <p className="text-base font-medium text-white/70 mb-3 uppercase tracking-wide">Departman</p>
                      <p className="text-xl text-white font-medium">{request.department}</p>
                    </div>
                    <div>
                      <p className="text-base font-medium text-white/70 mb-3 uppercase tracking-wide">Talep Eden</p>
                      <p className="text-xl text-white font-medium">{request.profiles?.full_name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ Panel - Ürün Bilgileri */}
            <div className="space-y-6 ">
              {/* Ürün Bilgileri */}
              {item && (
                <div className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: '#EFE248' }}>
                  <div className="mb-6">
                    <h3 className="text-2xl font-light text-black">Ürün Bilgileri</h3>
                    <p className="text-sm text-black/70">Detaylar ve özellikler</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-black/60 mb-2 uppercase tracking-wide">Ürün Adı</p>
                      <p className="text-lg text-black font-medium">{item.item_name}</p>
                    </div>
                    
                    {item.brand && (
                      <div>
                        <p className="text-sm font-medium text-black/60 mb-2 uppercase tracking-wide">Marka</p>
                        <div className="inline-block bg-black/10 px-3 py-1.5 rounded-lg">
                          <p className="text-base text-black font-semibold">{item.brand}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Özellikler - Request'ten gelen */}
                    {request.description && (
                      <div>
                        <p className="text-sm font-medium text-black/60 mb-2 uppercase tracking-wide">Özellikler</p>
                        <div className="bg-black/5 rounded-lg p-3">
                          <p className="text-black/80 text-base leading-relaxed">{request.description}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Miktar Highlight */}
                    <div className="bg-black/5 rounded-2xl p-4">
                      <p className="text-sm font-medium text-black/70 mb-2 uppercase tracking-wide">Talep Edilen Miktar</p>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-normal text-black">{item.quantity}</div>
                        <div className="px-3 py-1 bg-black/10 rounded-full text-base font-medium text-black">
                          {item.unit}
                        </div>
                      </div>
                    </div>
                    
                    {item.specifications && (
                      <div>
                        <p className="text-sm font-medium text-black/60 mb-2 uppercase tracking-wide">Açıklama</p>
                        <p className="text-black/80 text-base leading-relaxed">{item.specifications}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mevcut Teklifler - Eğer varsa */}
          {existingOffers.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-900/10 rounded-xl flex items-center justify-center">
                  <Check className="h-5 w-5 text-gray-900" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Mevcut Teklifler</h3>
                  <p className="text-sm text-gray-500">{totalOffers}/3 teklif girildi</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {existingOffers.map((offer, index) => (
                  <div key={offer.id} className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-200 hover:shadow-md ${
                    offer.is_selected 
                      ? 'border-green-200 ring-1 ring-green-100' 
                      : 'border-gray-100'
                  }`}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-800">{index + 1}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-base">{offer.supplier_name}</h4>
                          {offer.is_selected && (
                            <Badge className="bg-green-50 text-green-700 text-xs mt-1 border border-green-200">
                              ✓ Seçildi
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="bg-yellow-100 px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-medium text-yellow-800">{offer.delivery_days} gün</span>
                      </div>
                    </div>
                    
                    {/* Fiyat Bilgileri */}
                    <div className="space-y-4">
                      <div className="border-t-2 border-gray-200 pt-4">
                        <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Birim Fiyat</div>
                        <div className="text-lg font-bold text-gray-900">{getCurrencySymbol(offer.currency || 'TRY')}{Number(offer.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Toplam Tutar</div>
                        <div className="text-xl font-bold text-gray-900">{getCurrencySymbol(offer.currency || 'TRY')}{Number(offer.total_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                    
                    {offer.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Notlar</div>
                        <p className="text-gray-700 text-sm leading-relaxed">{offer.notes}</p>
                      </div>
                    )}

                    {/* Döküman Önizlemeleri */}
                    {offer.document_urls && offer.document_urls.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Dökümanlar ({offer.document_urls.length})</div>
                        <div className="grid grid-cols-3 gap-3">
                          {offer.document_urls.slice(0, 3).map((url: string, docIndex: number) => (
                            <div 
                              key={docIndex} 
                              className="aspect-square bg-gray-50 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 border border-gray-100"
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
                                    // Resim yüklenemezse placeholder göster
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
                    <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                      {/* Teklifi İncele Butonu */}
                      <Button
                        onClick={() => openOfferModal(offer)}
                        variant="outline"
                        className="w-full h-10 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-xl transition-all duration-200 hover:border-gray-300"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Teklifi İncele
                      </Button>
                      
                      {/* Bunu Seç Butonu */}
                      <Button
                        onClick={() => handleApproveOffer(offer.id)}
                        disabled={approving === offer.id || request?.status === 'approved'}
                        className={`w-full h-11 font-semibold rounded-xl transition-all duration-200 ${
                          offer.is_selected 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-gray-900 hover:bg-black text-white'
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
                  </div>
                ))}
              </div>
              
              {totalOffers >= 3 && (
                <div className="mt-6 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                    <p className="text-gray-800 font-semibold">3 teklif tamamlandı - Onay bekliyor</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alt Bölüm - Teklif Girişi */}
          <div>
            <div className="bg-gradient-to-br from-white/80 to-gray-50/60 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-900/10 rounded-xl flex items-center justify-center">
                  <Plus className="h-5 w-5 text-gray-900" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Yeni Teklif Girişi</h3>
                  <p className="text-sm text-gray-500">Toplam 3 teklif girildikten sonra onay sürecine geçer</p>
                </div>
              </div>
              
              <div className="space-y-6">
                
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
                            <SelectContent>
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
            </div>
          </div>
        </div>
      </div>

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
                  {!selectedOffer.is_selected && request?.status !== 'approved' && (
                    <Button
                      onClick={() => {
                        handleApproveOffer(selectedOffer.id)
                        closeOfferModal()
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
    </div>
  )
}