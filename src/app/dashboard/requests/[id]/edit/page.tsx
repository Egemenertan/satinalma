'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { updatePurchaseRequest } from '@/lib/actions'
import { 
  Package, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  ArrowLeft,
  Save,
  FileText,
  Hash,
  Weight,
  Tag,
  Target,
  Settings,
  Camera,
  Image as ImageIcon,
  Upload,
  X,
  Wrench,
  Ruler,
  Truck,
  Package2,
  Zap,
  Sparkles,
  Grid3X3,
  List,
  Shield,
  Palette,
  Search,
  Loader2,
  TreePine,
  Trash2
} from 'lucide-react'

const steps = [
  { id: 1, title: 'Lokasyon Bilgileri', icon: Building2 },
  { id: 2, title: 'Malzeme Sınıfı', icon: Grid3X3 },
  { id: 3, title: 'Alt Kategori', icon: List },
  { id: 4, title: 'Malzeme Seçimi', icon: Package },
  { id: 5, title: 'Malzeme Detayları', icon: FileText },
  { id: 6, title: 'Kullanım & Zamanlama', icon: Target },
  { id: 7, title: 'Onay & Güncelleme', icon: CheckCircle2 }
]

// Helper fonksiyonlar (aynı)
const getIconForClass = (className: string) => {
  const iconMap: Record<string, string> = {
    'İş Araçları': 'Wrench',
    'Mimari Malzemeler': 'Ruler', 
    'Kaba İnşaat': 'Truck',
    'Mobilyasyon': 'Package2',
    'Mekanik': 'Settings',
    'Elektrik': 'Zap',
    'Temizlik': 'Sparkles',
    'İş Güvenliği': 'Shield',
    'Boyalar': 'Palette'
  }
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (className.toLowerCase().includes(key.toLowerCase())) {
      return icon
    }
  }
  return 'Package'
}

const getColorForClass = (className: string) => {
  const colorMap: Record<string, string> = {
    'İş Araçları': '#f59e0b',
    'Mimari Malzemeler': '#8b5cf6',
    'Kaba İnşaat': '#ef4444',
    'Mobilyasyon': '#06b6d4',
    'Mekanik': '#10b981',
    'Elektrik': '#f59e0b',
    'Temizlik': '#ec4899',
    'İş Güvenliği': '#6366f1',
    'Boyalar': '#84cc16'
  }
  
  for (const [key, color] of Object.entries(colorMap)) {
    if (className.toLowerCase().includes(key.toLowerCase())) {
      return color
    }
  }
  return '#6b7280'
}

const getIconForGroup = (groupName: string) => {
  const iconMap: Record<string, string> = {
    'elektrik': 'Zap',
    'electric': 'Zap',
    'sıva': 'Settings',
    'zemin': 'Package2',
    'aydınlatma': 'Sparkles',
    'kaplama': 'Package2',
    'genel': 'Package',
    'şantiye': 'Building2',
    'çevre': 'TreePine',
    'malzeme': 'Package'
  }
  
  const groupLower = groupName.toLowerCase()
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (groupLower.includes(key)) {
      return icon
    }
  }
  return 'Package'
}

const getColorForGroup = (groupName: string) => {
  return '#6b7280'
}

export default function EditPurchaseRequestPage() {
  const router = useRouter()
  const params = useParams()
  
  // Request ID'yi güvenli şekilde parse et
  const rawId = params.id
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId
  
  // UUID validation helper
  const isValidUUID = (str: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
  }
  
  console.log('🆔 Request ID Debug:', {
    rawId,
    requestId,
    type: typeof requestId,
    isString: typeof requestId === 'string',
    isUUID: isValidUUID(requestId || ''),
    length: requestId?.length
  })
  
  const { showToast } = useToast()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [sites, setSites] = useState([])
  const [materialClasses, setMaterialClasses] = useState([])
  const [materialGroups, setMaterialGroups] = useState([])
  const [materialItems, setMaterialItems] = useState([])
  const [currentStep, setCurrentStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    class: string
    group: string
    item_name: string
    display_text: string
    score?: number
    highlightCount?: number
  }>>([])
  
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [formData, setFormData] = useState({
    construction_site: '',
    construction_site_id: '',
    material_class: '',
    material_group: '',
    purpose: '',
    required_date: '',
    specifications: ''
  })
  
  // Çoklu malzeme seçimi için state
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{
    id: string
    material_class: string
    material_group: string
    material_item_name: string
    material_name: string
    material_description: string
    unit: string
    quantity: string
    brand: string
    specifications: string
    purpose: string
    delivery_date: string
    image_urls: string[]
    uploaded_images: File[]
    image_preview_urls: string[]
  }>>([])
  
  const [currentMaterialIndex, setCurrentMaterialIndex] = useState(0)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Yeni malzeme oluşturma modal state'leri
  const [showCreateMaterialModal, setShowCreateMaterialModal] = useState(false)
  const [createMaterialData, setCreateMaterialData] = useState({
    class: '',
    group: '',
    item_name: ''
  })
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false)
  
  // User role for role-based edit permissions
  const [userRole, setUserRole] = useState<string>('')
  
  // Malzeme silme onayı için state'ler
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<number | null>(null)

  // Get user role for role-based permissions
  useEffect(() => {
    const getUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          setUserRole(profile?.role || '')
        }
      } catch (error) {
        console.error('User role alınırken hata:', error)
      }
    }
    
    getUserRole()
  }, [])

  // Cleanup URL objects when component unmounts
  useEffect(() => {
    return () => {
      selectedMaterials.forEach(material => {
        (material.image_preview_urls || []).forEach(url => URL.revokeObjectURL(url))
      })
    }
  }, [selectedMaterials])

  // Mevcut talebi yükle
  useEffect(() => {
    const loadExistingRequest = async () => {
      if (!requestId || !isValidUUID(requestId)) {
        console.error('❌ Request ID geçersiz:', { requestId, isUUID: isValidUUID(requestId || '') })
        showToast('Geçersiz talep ID', 'error')
        router.push('/dashboard/requests')
        return
      }
      
      console.log('🔍 Request ID:', requestId, 'Type:', typeof requestId)
      
      try {
        setInitialLoading(true)
        
        // Purchase request ve items'ları çek
        console.log('📡 Supabase sorgusu başlatılıyor, Request ID:', requestId)
        
        const { data: requestData, error: requestError } = await supabase
          .from('purchase_requests')
          .select(`
            *,
            sites (id, name),
            purchase_request_items (*)
          `)
          .eq('id', requestId)
          .single()

        console.log('📋 Supabase sorgu sonucu:', { requestData, requestError })

        if (requestError) {
          console.error('❌ Request yüklenirken hata:', requestError)
          showToast('Talep bilgileri yüklenemedi', 'error')
          return
        }

        if (!requestData) {
          showToast('Talep bulunamadı', 'error')
          router.push('/dashboard/requests')
          return
        }

        // Shipment verilerini çek - "depoda yok" malzemeleri filtrelemek için
        const { data: shipments, error: shipmentError } = await supabase
          .from('shipments')
          .select('purchase_request_item_id, shipped_quantity')
          .eq('purchase_request_id', requestId)

        console.log('📦 Shipment verileri:', { shipments, shipmentError })

        // "Depoda yok" olarak işaretlenmiş malzemelerin ID'lerini bul
        const unavailableItemIds = new Set<string>()
        if (shipments && !shipmentError) {
          shipments.forEach(shipment => {
            if (shipment.shipped_quantity === 0) {
              unavailableItemIds.add(shipment.purchase_request_item_id)
            }
          })
        }

        console.log('🚫 Depoda yok malzemeler:', Array.from(unavailableItemIds))

        // Form verilerini doldur
        setFormData({
          construction_site: requestData.sites?.name || '',
          construction_site_id: requestData.site_id || '',
          material_class: '', // İlk malzemeden alınacak
          material_group: '', // İlk malzemeden alınacak
          purpose: '', // Malzeme bazında
          required_date: '', // Malzeme bazında
          specifications: requestData.specifications || ''
        })

        // Malzemeleri dönüştür ve "depoda yok" olanları filtrele
        const allMaterials = requestData.purchase_request_items?.map((item: any) => ({
          id: item.id.toString(),
          material_class: item.material_class || '',
          material_group: item.material_group || '',
          material_item_name: item.material_item_name || item.item_name || '',
          material_name: item.item_name || item.material_item_name || '',
          material_description: item.specifications || '',
          unit: item.unit || '',
          quantity: item.quantity?.toString() || '',
          brand: item.brand || '',
          specifications: item.specifications || '',
          purpose: item.purpose || '',
          delivery_date: item.delivery_date || '',
          image_urls: item.image_urls || [],
          uploaded_images: [],
          image_preview_urls: []
        })) || []

        // "Depoda yok" malzemeleri filtrele
        const materials = allMaterials.filter(material => !unavailableItemIds.has(material.id))
        
        console.log('📊 Malzeme filtreleme:', {
          totalMaterials: allMaterials.length,
          unavailableCount: unavailableItemIds.size,
          editableMaterials: materials.length,
          filteredOutIds: Array.from(unavailableItemIds)
        })

        console.log('🔍 Malzeme adları debug:', materials.map(m => ({
          id: m.id,
          material_item_name: m.material_item_name,
          material_name: m.material_name,
          display_name: m.material_item_name || m.material_name || `Malzeme ${materials.indexOf(m) + 1}`
        })))

        // Eğer düzenlenebilir malzeme kalmadıysa kullanıcıyı bilgilendir
        if (materials.length === 0) {
          showToast('Bu talepteki tüm malzemeler "depoda yok" olarak işaretlenmiş. Düzenlenebilir malzeme bulunamadı.', 'info')
          router.push(`/dashboard/requests/${requestId}/offers`)
          return
        }

        setSelectedMaterials(materials)

        // İlk malzemeden sınıf ve grup bilgilerini al
        if (materials.length > 0) {
          const firstMaterial = materials[0]
          setFormData(prev => ({
            ...prev,
            material_class: firstMaterial.material_class,
            material_group: firstMaterial.material_group
          }))
        }

        // Şantiyeleri yükle
        await loadSites()
        
        // Malzeme sınıflarını yükle
        await loadMaterialClasses()

        // Eğer materyal varsa grup ve öğeleri de yükle
        if (materials.length > 0) {
          const firstMaterial = materials[0]
          if (firstMaterial.material_class) {
            await fetchMaterialGroups(firstMaterial.material_class)
          }
          if (firstMaterial.material_class && firstMaterial.material_group) {
            await fetchMaterialItems(firstMaterial.material_class, firstMaterial.material_group)
          }
        }

        // Düzenleme için doğrudan 5. adımdan başla
        setCurrentStep(5)

      } catch (error) {
        console.error('Talep yüklenirken hata:', error)
        showToast('Beklenmeyen bir hata oluştu', 'error')
      } finally {
        setInitialLoading(false)
      }
    }

    loadExistingRequest()
  }, [requestId, router, showToast])

  // Şantiyeleri yükle
  const loadSites = async () => {
    try {
      const { data: sitesData, error } = await supabase
        .from('sites')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Şantiyeler yüklenirken hata:', error)
      } else {
        setSites(sitesData || [])
      }
    } catch (error) {
      console.error('Şantiyeler yüklenirken hata:', error)
    }
  }

  // Malzeme sınıflarını yükle
  const loadMaterialClasses = async () => {
    try {
      const { data: classesData, error } = await supabase
        .from('all_materials')
        .select('class')
        .not('class', 'is', null)
        .not('class', 'eq', '')
        .order('class')

      if (error) {
        console.error('Malzeme sınıfları yüklenirken hata:', error)
      } else {
        const classNames = classesData
          ?.map(item => item.class)
          ?.filter(cls => typeof cls === 'string' && cls.trim() !== '') || []
          
        const uniqueClasses = Array.from(new Set(classNames))
          .filter(Boolean)
          .sort()
          .map((className, index) => ({
            id: index + 1,
            name: className,
            description: `${className} kategorisindeki malzemeler`,
            icon: getIconForClass(className),
            color: getColorForClass(className)
          }))
        
        setMaterialClasses(uniqueClasses || [])
      }
    } catch (error) {
      console.error('Malzeme sınıfları yüklenirken hata:', error)
    }
  }

  // Sınıf seçildiğinde grupları çek
  const fetchMaterialGroups = async (materialClass: string) => {
    try {
      const { data: groupsData, error } = await supabase
        .from('all_materials')
        .select('group')
        .eq('class', materialClass)
        .not('group', 'is', null)
        .not('group', 'eq', '')
        .order('group')

      if (error) {
        console.error('Malzeme grupları yüklenirken hata:', error)
      } else {
        const groupNames = groupsData
          ?.map(item => item.group)
          ?.filter(grp => typeof grp === 'string' && grp.trim() !== '') || []
          
        const uniqueGroupNames = Array.from(new Set(groupNames))
          .filter(Boolean)
          .sort()
          
        const uniqueGroups = uniqueGroupNames.map((groupName, index) => ({
          id: index + 1,
          name: groupName,
          description: `${groupName} grubu malzemeler`,
          icon: getIconForGroup(groupName),
          color: getColorForGroup(groupName)
        }))
        
        setMaterialGroups(uniqueGroups || [])
      }
    } catch (error) {
      console.error('Malzeme grupları yüklenirken hata:', error)
    }
  }

  // Grup seçildiğinde malzeme öğelerini çek
  const fetchMaterialItems = async (materialClass: string, materialGroup: string) => {
    try {
      const { data: itemsData, error } = await supabase
        .from('all_materials')
        .select('item_name')
        .eq('class', materialClass)
        .eq('group', materialGroup)
        .not('item_name', 'is', null)
        .not('item_name', 'eq', '')
        .order('item_name')

      if (error) {
        console.error('Malzeme öğeleri yüklenirken hata:', error)
      } else {
        const itemNames = itemsData
          ?.map(item => item.item_name)
          ?.filter(itm => typeof itm === 'string' && itm.trim() !== '') || []
          
        const uniqueItems = Array.from(new Set(itemNames))
          .filter(Boolean)
          .sort()
          .map((itemName, index) => {
            return {
              id: index + 1,
              name: itemName,
              description: `${materialGroup} grubundan ${itemName}`,
              unit: 'adet'
            }
          })
        
        setMaterialItems(uniqueItems || [])
      }
    } catch (error) {
      console.error('Malzeme öğeleri yüklenirken hata:', error)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files || selectedMaterials.length === 0) return

    const currentMaterial = selectedMaterials[currentMaterialIndex]
    const currentImages = currentMaterial.uploaded_images || []
    const newFiles = Array.from(files).slice(0, 3 - currentImages.length)
    const newPreviewUrls: string[] = []

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
      }
    })

    const updatedMaterials = [...selectedMaterials]
    updatedMaterials[currentMaterialIndex] = {
      ...updatedMaterials[currentMaterialIndex],
      uploaded_images: [...currentImages, ...newFiles],
      image_preview_urls: [...(currentMaterial.image_preview_urls || []), ...newPreviewUrls]
    }
    setSelectedMaterials(updatedMaterials)
  }

  const removeImage = (index: number) => {
    if (selectedMaterials.length === 0) return

    const currentMaterial = selectedMaterials[currentMaterialIndex]
    const imageUrls = currentMaterial.image_preview_urls || []
    
    if (imageUrls[index]) {
      URL.revokeObjectURL(imageUrls[index])
    }
    
    const updatedMaterials = [...selectedMaterials]
    updatedMaterials[currentMaterialIndex] = {
      ...updatedMaterials[currentMaterialIndex],
      uploaded_images: (currentMaterial.uploaded_images || []).filter((_, i) => i !== index),
      image_preview_urls: imageUrls.filter((_, i) => i !== index)
    }
    setSelectedMaterials(updatedMaterials)
  }

  const triggerCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleImageUpload(target.files)
    }
    input.click()
  }

  const triggerGallerySelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      handleImageUpload(target.files)
    }
    input.click()
  }

  // Malzeme silme onayı başlat
  const handleRemoveMaterial = (materialIndex: number) => {
    setMaterialToDelete(materialIndex)
    setShowDeleteConfirmModal(true)
  }

  // Malzeme silme onayı
  const confirmRemoveMaterial = () => {
    if (materialToDelete === null) return
    
    // En az 1 malzeme kalmalı
    if (selectedMaterials.length <= 1) {
      showToast('En az bir malzeme bulunmalıdır', 'error')
      setShowDeleteConfirmModal(false)
      setMaterialToDelete(null)
      return
    }

    const updatedMaterials = selectedMaterials.filter((_, index) => index !== materialToDelete)
    setSelectedMaterials(updatedMaterials)
    
    // Eğer silinen malzeme şu anda seçili olan ise, ilk malzemeye geç
    if (currentMaterialIndex === materialToDelete) {
      setCurrentMaterialIndex(0)
    } else if (currentMaterialIndex > materialToDelete) {
      // Eğer silinen malzeme öncekiyse, index'i bir azalt
      setCurrentMaterialIndex(currentMaterialIndex - 1)
    }
    
    showToast('Malzeme talepten kaldırıldı', 'success')
    setShowDeleteConfirmModal(false)
    setMaterialToDelete(null)
  }

  // Malzeme silme iptal
  const cancelRemoveMaterial = () => {
    setShowDeleteConfirmModal(false)
    setMaterialToDelete(null)
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.construction_site
      case 2:
      case 3:
      case 4:
        return true // Skip validation for these steps in edit mode
      case 5:
        return selectedMaterials.length > 0 && selectedMaterials.every(material => 
          material.unit && material.quantity && material.purpose
        )
      case 6:
        return true
      case 7:
        return isFormValid()
      default:
        return false
    }
  }

  const isFormValid = () => {
    return formData.construction_site && 
           selectedMaterials.length > 0 &&
           selectedMaterials.every(material => 
             material.unit && material.quantity && material.purpose
           )
  }

  const nextStep = () => {
    if (isStepValid(currentStep) && currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Client-side güncelleme fonksiyonu (fallback)
  const handleClientSideUpdate = async () => {
    try {
      console.log('🔧 Client-side güncelleme deneniyor...')
      
      if (!requestId || !isValidUUID(requestId)) {
        throw new Error('Geçersiz request ID')
      }

      // Role-based status validation
      const canEditByRole = (currentStatus: string, role: string) => {
        if (role === 'site_personnel') {
          return currentStatus === 'pending'
        }
        if (role === 'site_manager') {
          return ['pending', 'rejected', 'kısmen gönderildi', 'depoda mevcut değil'].includes(currentStatus)
        }
        if (role === 'admin') {
          return true
        }
        return ['pending', 'rejected'].includes(currentStatus)
      }

      // Get current request status for validation
      const { data: currentRequest } = await supabase
        .from('purchase_requests')
        .select('status')
        .eq('id', requestId)
        .single()

      if (currentRequest && !canEditByRole(currentRequest.status, userRole)) {
        throw new Error(`Bu durumda olan talepler düzenlenemez. Mevcut durum: ${currentRequest.status}, Rolünüz: ${userRole}`)
      }
      
      // Purchase request'i güncelle
      const { error: updateRequestError } = await supabase
        .from('purchase_requests')
        .update({
          specifications: formData.specifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateRequestError) {
        throw new Error(`Request güncellenemedi: ${updateRequestError.message}`)
      }

      // Mevcut items'ları sil
      const { error: deleteItemsError } = await supabase
        .from('purchase_request_items')
        .delete()
        .eq('purchase_request_id', requestId)

      if (deleteItemsError) {
        throw new Error(`Mevcut items silinemedi: ${deleteItemsError.message}`)
      }

      // Yeni items'ları ekle
      const itemsData = selectedMaterials.map(material => ({
        purchase_request_id: requestId,
        item_name: material.material_name,
        description: `${material.brand || ''} ${material.material_name}`.trim(),
        quantity: Math.round(parseFloat(material.quantity)),
        original_quantity: Math.round(parseFloat(material.quantity)),
        unit: material.unit,
        unit_price: 0,
        specifications: material.specifications || null,
        purpose: material.purpose || null,
        delivery_date: material.delivery_date || null,
        brand: material.brand || null,
        material_class: material.material_class || null,
        material_group: material.material_group || null,
        material_item_name: material.material_item_name || null,
        image_urls: material.image_urls || null
      }))

      const { error: insertItemsError } = await supabase
        .from('purchase_request_items')
        .insert(itemsData)

      if (insertItemsError) {
        throw new Error(`Yeni items eklenemedi: ${insertItemsError.message}`)
      }

      return { success: true, message: 'Talep başarıyla güncellendi!' }
    } catch (error) {
      console.error('Client-side güncelleme hatası:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFormValid()) {
      showToast('Lütfen zorunlu alanları doldurun', 'error')
      return
    }

    setLoading(true)
    
    try {
      // Malzemeleri hazırla
      const materialsData = selectedMaterials.map((material) => ({
        id: material.id, // UUID olarak gönder
        material_name: material.material_name,
        quantity: Math.round(parseFloat(material.quantity)),
        unit: material.unit,
        brand: material.brand,
        material_class: material.material_class,
        material_group: material.material_group,
        material_item_name: material.material_item_name,
        specifications: material.specifications,
        purpose: material.purpose,
        delivery_date: material.delivery_date,
        image_urls: material.image_urls // Mevcut resimler korunur
      }))

      // Güncelleme server action'ını çağır
      console.log('🔄 Update request çağrılıyor:', {
        requestId: requestId,
        requestIdType: typeof requestId,
        isValidUUID: isValidUUID(requestId),
        materialsCount: materialsData.length
      })
      
      // Güvenlik kontrolü
      if (!requestId || !isValidUUID(requestId)) {
        console.error('❌ Geçersiz Request ID:', { requestId, isUUID: isValidUUID(requestId || '') })
        showToast('Geçersiz talep ID', 'error')
        return
      }
      
      let result
      try {
        // Önce server action'ı dene
        result = await updatePurchaseRequest({
          requestId: requestId, // String UUID olarak gönder
          materials: materialsData,
          specifications: formData.specifications
        })
      } catch (serverError) {
        console.warn('Server action başarısız, client-side güncelleme deneniyor:', serverError)
        // Server action başarısız olursa client-side güncelleme yap
        result = await handleClientSideUpdate()
      }
      
      console.log('📥 Update result:', result)

      if (!result.success) {
        showToast(`Hata: ${result.error}`, 'error')
        return
      }

      showToast(result.message || 'Talep başarıyla güncellendi!', 'success')
      
      // Talep detay sayfasına yönlendir (offers sayfası talep detayını gösteriyor)
      router.push(`/dashboard/requests/${requestId}/offers`)
      
    } catch (error) {
      console.error('Talep güncelleme hatası:', error)
      showToast('Talep güncellenirken bir hata oluştu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.push(`/dashboard/requests/${requestId}/offers`)
  }

  // Loading durumu
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-600" />
          <p className="text-gray-600">Talep bilgileri yükleniyor...</p>
        </div>
      </div>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader>
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 lg:w-5 h-4 lg:h-5 text-blue-600" />
                Lokasyon Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 lg:p-6 space-y-3 lg:space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Mevcut Lokasyon</Label>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Seçili Lokasyon</span>
                  </div>
                  <p className="text-lg font-semibold text-blue-900">{formData.construction_site}</p>
                  <p className="text-sm text-blue-700 mt-1">Lokasyon değişikliği için yeni talep oluşturun.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 2:
      case 3:
      case 4:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 mb-4">Bu adım düzenleme için geçersiz. Malzeme detaylarına ilerleyin.</p>
              <Button 
                onClick={() => setCurrentStep(5)}
                className="bg-black hover:bg-gray-800 text-white"
              >
                Malzeme Detaylarına Git
              </Button>
            </CardContent>
          </Card>
        )

      case 5:
        if (selectedMaterials.length === 0) {
          return (
            <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
              <CardContent className="p-6 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz malzeme bulunamadı</h3>
                <p className="text-gray-600 mb-4">Bu talep için malzeme bilgileri yüklenemedi.</p>
              </CardContent>
            </Card>
          )
        }

        const currentMaterial = selectedMaterials[currentMaterialIndex]

        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader className="pb-0 lg:pb-0">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
               
                
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {currentMaterialIndex + 1} / {selectedMaterials.length}
                    </span>
                  </div>
                  
                  {/* Kaldır Butonu */}
                  {selectedMaterials.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(currentMaterialIndex)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
              
              {/* Malzeme Navigasyonu */}
              {selectedMaterials.length > 1 && (
                <div className="flex gap-2 mt-4 overflow-x-auto">
                  {selectedMaterials.map((material, index) => (
                    <div key={material.id} className="flex-shrink-0 relative group">
                      <button
                        onClick={() => setCurrentMaterialIndex(index)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all pr-8 ${
                          index === currentMaterialIndex
                            ? 'bg-orange-600 text-white'
                            : 'bg-white/50 text-gray-700 hover:bg-white/70'
                        }`}
                      >
                        {material.material_item_name || material.material_name || `Malzeme ${index + 1}`}
                      </button>
                      
                      {/* Mini Kaldır Butonu */}
                      {selectedMaterials.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveMaterial(index)
                          }}
                          className={`absolute top-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all opacity-0 group-hover:opacity-100 ${
                            index === currentMaterialIndex
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                          title="Malzemeyi kaldır"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="p-2 lg:p-6 space-y-4 lg:space-y-6">
              {/* Seçilen Malzeme Bilgisi */}
              <div className="bg-orange-50/50 border border-orange-200 rounded-3xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Düzenlenen Malzeme</span>
                </div>
                <h3 className="font-semibold text-gray-900">
                  {currentMaterial?.material_item_name || currentMaterial?.material_name || 'Malzeme Adı'}
                </h3>
                <p className="text-sm text-gray-600">
                  {currentMaterial?.material_group} → {currentMaterial?.material_class}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    Malzeme Adı
                  </Label>
                  <Input
                    value={currentMaterial?.material_name || ''}
                    readOnly
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed text-base lg:text-base"
                  />
                </div>
                
                {/* Kullanım Amacı */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" />
                    Kullanım Amacı *
                  </Label>
                  <Input
                    value={currentMaterial?.purpose || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        purpose: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="Bu malzeme nerede ve nasıl kullanılacak?"
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-base lg:text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4" />
                    Marka
                  </Label>
                  <Input
                    value={currentMaterial?.brand || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        brand: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="Marka/üretici..."
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-base lg:text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4" />
                    Miktar *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentMaterial?.quantity || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        quantity: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="0"
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-base lg:text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Weight className="w-4 h-4" />
                    Birim *
                  </Label>
                  <Input
                    value={currentMaterial?.unit || ''}
                    onChange={(e) => {
                      const updatedMaterials = [...selectedMaterials]
                      updatedMaterials[currentMaterialIndex] = {
                        ...updatedMaterials[currentMaterialIndex],
                        unit: e.target.value
                      }
                      setSelectedMaterials(updatedMaterials)
                    }}
                    placeholder="kg, m³, adet, m²..."
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-base lg:text-base"
                  />
                </div>
              </div>

              {/* Gerekli Teslimat Tarihi */}
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  Ne Zaman Gerekli?
                </Label>
                <Input
                  type="date"
                  value={currentMaterial?.delivery_date || ''}
                  onChange={(e) => {
                    const updatedMaterials = [...selectedMaterials]
                    updatedMaterials[currentMaterialIndex] = {
                      ...updatedMaterials[currentMaterialIndex],
                      delivery_date: e.target.value
                    }
                    setSelectedMaterials(updatedMaterials)
                  }}
                  className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-base lg:text-base"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Teknik Özellikler */}
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4" />
                  Teknik Özellikler
                </Label>
                <Textarea
                  value={currentMaterial?.specifications || ''}
                  onChange={(e) => {
                    const updatedMaterials = [...selectedMaterials]
                    updatedMaterials[currentMaterialIndex] = {
                      ...updatedMaterials[currentMaterialIndex],
                      specifications: e.target.value
                    }
                    setSelectedMaterials(updatedMaterials)
                  }}
                  placeholder="Bu malzeme için teknik özellikler, kalite standartları, özel notlar..."
                  className="min-h-[80px] resize-none rounded-lg border-gray-200 focus:border-black focus:ring-black/20 text-sm"
                />
              </div>

              {/* Mevcut Resimler */}
              {currentMaterial?.image_urls && currentMaterial.image_urls.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Mevcut Malzeme Fotoğrafları
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {currentMaterial.image_urls.map((url, index) => (
                      <div key={index} className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                        <img
                          src={url}
                          alt={`${currentMaterial.material_name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Malzeme Navigasyon Butonları */}
              {selectedMaterials.length > 1 && (
                <div className="flex justify-between pt-4 border-t border-white/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentMaterialIndex(Math.max(0, currentMaterialIndex - 1))}
                    disabled={currentMaterialIndex === 0}
                    className="bg-white/50 hover:bg-white/70"
                  >
                    Önceki Malzeme
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentMaterialIndex(Math.min(selectedMaterials.length - 1, currentMaterialIndex + 1))}
                    disabled={currentMaterialIndex === selectedMaterials.length - 1}
                    className="bg-white/50 hover:bg-white/70"
                  >
                    Sonraki Malzeme
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <Target className="w-4 lg:w-5 h-4 lg:h-5 text-purple-600" />
                Malzeme Kullanım Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 lg:p-6 space-y-4 lg:space-y-6">
              {/* Ek Notlar */}
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  Ek Notlar (Opsiyonel)
                </Label>
                <Textarea
                  value={formData.specifications}
                  onChange={(e) => handleInputChange('specifications', e.target.value)}
                  placeholder="Talep ile ilgili ek notlar, özel talimatlar..."
                  className="min-h-[80px] resize-none rounded-lg border-gray-200 focus:border-black focus:ring-black/20 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        )

      case 7:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 lg:w-5 h-4 lg:h-5 text-green-600" />
                Güncelleme Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 lg:p-6 space-y-4">
              {/* Güncellenecek Malzemeler */}
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Güncellenecek Malzemeler ({selectedMaterials.length})
                </Label>
                
                <div className="space-y-3">
                  {selectedMaterials.map((material, index) => (
                    <div key={material.id} className="bg-white/30 backdrop-blur-lg rounded-lg lg:rounded-xl p-4 border border-white/20">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                              #{index + 1}
                            </span>
                            <h4 className="font-semibold text-gray-900">{material.material_name}</h4>
                          </div>
                          <p className="text-sm text-gray-600">
                            {material.material_group} → {material.material_class}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {material.quantity} {material.unit}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {material.brand && (
                          <div>
                            <span className="text-gray-600">Marka:</span>
                            <span className="ml-2 font-medium text-gray-900">{material.brand}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Kullanım:</span>
                          <span className="ml-2 font-medium text-gray-900">{material.purpose}</span>
                        </div>
                      </div>
                      
                      {material.delivery_date && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <div className="text-xs text-gray-600 mb-1">Gerekli Teslimat Tarihi:</div>
                          <div className="text-sm text-gray-800 bg-white/20 rounded p-2">
                            {new Date(material.delivery_date).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      )}
                      
                      {material.specifications && (
                        <div className="mt-3 pt-3 border-t border-white/20">
                          <div className="text-xs text-gray-600 mb-1">Teknik Özellikler:</div>
                          <div className="text-sm text-gray-800 bg-white/20 rounded p-2">
                            {material.specifications}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Güncelle Butonu */}
              <div className="mt-6 lg:mt-8 pt-4 border-t border-white/30">
                <Button 
                  type="submit" 
                  disabled={loading || !isFormValid()}
                  className="w-full h-12 lg:h-14 px-6 lg:px-8 rounded-lg lg:rounded-xl font-medium bg-black hover:bg-gray-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-base lg:text-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-3" />
                      Güncelleniyor...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-3" />
                      Değişiklikleri Kaydet
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 lg:backdrop-blur-lg border-0">
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">Bu adım düzenleme için uygulanabilir değil.</p>
              <Button 
                onClick={() => setCurrentStep(5)}
                className="mt-4 bg-black hover:bg-gray-800 text-white"
              >
                Malzeme Detaylarına Git
              </Button>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="min-h-screen rounded-3xl bg-white">
      <div className="px-0 lg:px-2 xl:px-4 pb-4 space-y-1 lg:space-y-8">
        {/* Header */}
        <div className="pt-0 lg:pt-4">
          <div>
            <div>
              <h1 className="text-2xl lg:text-4xl font-normal text-gray-900">Satın Alma Talebi Düzenleme</h1>
              <p className="text-gray-600 mt-0 lg:mt-0 text-sm lg:text-lg font-light">Mevcut talep bilgilerini güncelleyin</p>
            </div>
            <div className="mt-3 lg:mt-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleBack}
                className="bg-white/20 backdrop-blur-lg hover:bg-white/30 rounded-lg lg:rounded-xl text-sm h-8 lg:h-auto px-2 lg:px-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri Dön
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white/20 rounded-xl lg:rounded-2xl">
          <div>
            <h3 className="text-base lg:text-lg font-semibold text-gray-900">Adım {currentStep} / {steps.length}</h3>
          </div>

          {/* Current Step Title */}
          <div className="text-center">
            <h4 className="text-lg lg:text-xl font-bold text-gray-900">{steps[currentStep - 1]?.title}</h4>
            <div className="lg:hidden text-sm text-gray-600">
              %{Math.round((currentStep / steps.length) * 100)} tamamlandı
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 lg:h-2 mt-2 lg:mt-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 lg:h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div>
          <div className="w-full">
            <form onSubmit={handleSubmit} className="space-y-1 lg:space-y-2">
              {/* Step Content */}
              <div className="min-h-[250px] lg:min-h-[400px]">
                {renderStepContent()}
              </div>

              {/* Navigation Buttons */}
              <div className="bg-white/20 lg:backdrop-blur-lg border-0 rounded-xl lg:rounded-2xl p-2 lg:p-6">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0">
                  <div className="flex items-center gap-3 order-2 lg:order-1">
                    {currentStep > 1 && (
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="h-8 lg:h-12 px-3 lg:px-6 rounded-lg lg:rounded-xl font-medium bg-white/30 border-white/40 hover:bg-white/50 text-sm lg:text-base flex-1 lg:flex-none"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Önceki
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 order-1 lg:order-2">
                    {currentStep < steps.length && (
                      <Button 
                        type="button"
                        onClick={nextStep}
                        disabled={!isStepValid(currentStep)}
                        className="h-8 lg:h-12 px-4 lg:px-8 rounded-lg lg:rounded-xl font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base flex-1 lg:flex-none"
                      >
                        İleri
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step Status */}
                <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-white/30">
                  <div className="flex items-center justify-center gap-2 text-xs lg:text-sm text-gray-600">
                    {isStepValid(currentStep) ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-green-700 font-medium">Bu adım tamamlandı</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 rounded-full" />
                        <span>Zorunlu alanları doldurun</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Malzeme Silme Onay Modalı */}
      <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <Trash2 className="w-5 h-5 text-red-600" />
              Malzemeyi Kaldır
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-900 mb-1">
                    Malzeme Silinecek
                  </h4>
                  {materialToDelete !== null && selectedMaterials[materialToDelete] && (
                    <p className="text-sm text-red-800">
                      "<strong>{selectedMaterials[materialToDelete].material_item_name}</strong>" 
                      malzemesi talepten tamamen kaldırılacaktır.
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Bu işlem geri alınamaz. Malzemeyi kaldırmak istediğinizden emin misiniz?
            </p>
            
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <strong>Not:</strong> Talep en az bir malzeme içermelidir. Son malzeme silinemez.
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={cancelRemoveMaterial}
              className="flex-1"
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={confirmRemoveMaterial}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Kaldır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
