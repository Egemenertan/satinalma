'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  X, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  CheckCircle, 
  FileText, 
  Package, 
  Plus, 
  AlertCircle,
  Search
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

const supabase = createClient()

interface Supplier {
  id: string
  name: string
  contact_person: string
  email: string
  phone: string
  address: string
  is_approved: boolean
  rating: number
}

interface AssignSupplierModalProps {
  isOpen: boolean
  onClose: () => void
  itemName: string
  itemUnit?: string
  materialClass?: string
  materialGroup?: string
  onSuccess?: () => void
  selectedMaterials?: Set<string> // Çoklu malzeme seçimi için
  materialItems?: any[] // Malzeme detayları için
  isBulkOrder?: boolean // Toplu sipariş modu için
  onBulkOrderWithSupplier?: (supplier: any) => void // Toplu sipariş callback
}

export default function AssignSupplierModal({
  isOpen,
  onClose,
  itemName,
  itemUnit = 'adet',
  materialClass,
  materialGroup,
  onSuccess,
  selectedMaterials,
  materialItems,
  isBulkOrder = false,
  onBulkOrderWithSupplier
}: AssignSupplierModalProps) {
  const router = useRouter()
  const { showToast } = useToast()
  
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [assigningSupplier, setAssigningSupplier] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [materialData, setMaterialData] = useState<{
    material_class?: string
    material_group?: string
  } | null>(null)
  const [loadingMaterial, setLoadingMaterial] = useState(true)

  // Modal açıldığında tedarikçileri yükle ve search'i temizle
  useEffect(() => {
    if (isOpen) {
      console.log('🚀 Modal açıldı, tedarikçiler ve malzeme bilgileri yüklenecek...')
      fetchAllSuppliers()
      fetchMaterialData()
      setSearchQuery('') // Search'i temizle
    }
  }, [isOpen, itemName])

  // ESC tuşu ile modal kapatma
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Tedarikçileri filtrele
  const filteredSuppliers = allSuppliers.filter(supplier => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.contact_person.toLowerCase().includes(query) ||
      supplier.email.toLowerCase().includes(query) ||
      supplier.phone.includes(query)
    )
  })

  // Modal açıldığında body scroll'unu engelle
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const fetchMaterialData = async () => {
    try {
      setLoadingMaterial(true)
      console.log('🔍 All_materials tablosundan malzeme bilgileri çekiliyor...', { itemName })
      
      const { data: materials, error } = await supabase
        .from('all_materials')
        .select(`
          class,
          group,
          item_name
        `)
        .eq('item_name', itemName)
        .limit(1)
      
      if (error) {
        console.error('❌ All_materials sorgu hatası:', error)
        throw error
      }
      
      if (materials && materials.length > 0) {
        const material = materials[0]
        console.log('✅ All_materials\'dan çekilen ham veri:', material)
        
        // Kolon isimlerini map et
        const mappedMaterial = {
          material_class: material.class,
          material_group: material.group
        }
        
        console.log('✅ Map edilmiş veri:', mappedMaterial)
        setMaterialData(mappedMaterial)
      } else {
        console.log('⚠️ All_materials\'da malzeme bulunamadı:', itemName)
        // Fallback - prop'lardan gelen değerleri kullan
        setMaterialData({
          material_class: materialClass,
          material_group: materialGroup
        })
      }
      
    } catch (error) {
      console.error('❌ Material data fetch hatası:', error)
      // Hata durumunda prop'lardan gelen değerleri kullan
      setMaterialData({
        material_class: materialClass,
        material_group: materialGroup
      })
    } finally {
      setLoadingMaterial(false)
    }
  }

  const fetchAllSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      console.log('🔍 Tüm tedarikçiler yükleniyor...')
      
      // Supabase bağlantısını test et
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('🔐 Mevcut kullanıcı:', user?.email || 'Bulunamadı', userError ? `Hata: ${userError.message}` : '✅')
      
      // Basit bir test sorgusu
      console.log('🔍 Basit test sorgusu yapılıyor...')
      const { count, error: countError } = await supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
      
      console.log('📊 Suppliers tablosu count:', count, countError ? `Hata: ${countError.message}` : '✅')
      
      // İlk olarak tüm tedarikçileri çekelim (debugging için)
      console.log('🔍 Tüm tedarikçiler çekiliyor...')
      const { data: allSuppliersDebug, error: debugError } = await supabase
        .from('suppliers')
        .select('id, name, is_approved')
      
      console.log('🔍 Debug sorgu sonucu:', {
        data: allSuppliersDebug,
        error: debugError,
        count: allSuppliersDebug?.length || 0
      })
      
      if (debugError) {
        console.error('❌ Debug sorgu hatası:', {
          message: debugError.message,
          details: debugError.details,
          hint: debugError.hint,
          code: debugError.code
        })
      }
      
      console.log('🔍 Debug - Onaylı tedarikçiler:', allSuppliersDebug?.filter(s => s.is_approved === true) || [])
      
      // Ana sorguyu çalıştır - TÜM tedarikçileri getir
      console.log('🔍 Ana sorgu çalıştırılıyor...')
      const { data: suppliers, error } = await supabase
        .from('suppliers')
        .select(`
          id,
          name,
          contact_person,
          email,
          phone,
          address,
          is_approved,
          rating
        `)
        .neq('kind', 'subcontractor')
        .order('name')

      if (error) {
        console.error('❌ Ana sorgu hatası:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      console.log('✅ Ana sorgu başarılı. Tedarikçi sayısı:', suppliers?.length || 0)
      console.log('📋 Tedarikçi detayları:', suppliers?.map(s => ({
        id: s.id,
        name: s.name,
        is_approved: s.is_approved,
        contact_person: s.contact_person
      })) || [])
      
      // Rating null ise 0 yap
      const processedSuppliers = (suppliers || []).map(supplier => ({
        ...supplier,
        rating: supplier.rating || 0
      }))
      
      console.log('✅ İşlenmiş tedarikçiler state\'e set ediliyor:', processedSuppliers.length)
      console.log('📋 State\'e kaydedilecek tedarikçiler:', processedSuppliers.map(s => ({
        id: s.id,
        name: s.name,
        is_approved: s.is_approved,
        contact_person: s.contact_person,
        email: s.email,
        phone: s.phone
      })))
      setAllSuppliers(processedSuppliers)
      
    } catch (error: any) {
      console.error('❌ fetchAllSuppliers genel hatası:', {
        error,
        type: typeof error,
        message: error?.message || 'Bilinmeyen hata',
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })
      showToast(`Tedarikçiler yüklenirken bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`, 'error')
    } finally {
      console.log('🏁 fetchAllSuppliers tamamlandı')
      setLoadingSuppliers(false)
    }
  }

  const assignMaterialToSupplier = async (supplierId: string, supplierName: string) => {
    // Çoklu malzeme ataması varsa
    if (selectedMaterials && selectedMaterials.size > 0 && materialItems) {
      return await assignMultipleMaterialsToSupplier(supplierId, supplierName)
    }

    if (!itemName) {
      showToast('Ürün bilgisi bulunamadı.', 'error')
      return
    }

    // All_materials tablosundan çekilen güncel veriler
    const currentMaterialClass = materialData?.material_class || materialClass
    const currentMaterialGroup = materialData?.material_group || materialGroup
    
    console.log('ℹ️ Material bilgisi:', { 
      fromAllMaterials: materialData,
      fromProps: { materialClass, materialGroup },
      using: { currentMaterialClass, currentMaterialGroup },
      defaults: { 
        finalClass: currentMaterialClass || 'Genel', 
        finalGroup: currentMaterialGroup || 'Diğer' 
      },
      itemName 
    })

    try {
      setAssigningSupplier(true)
      console.log('🔄 Ürün tedarikçiye atanıyor...', { 
        supplierId, 
        supplierName,
        itemName,
        currentMaterialClass,
        currentMaterialGroup
      })

      console.log('📦 Tedarikçi-malzeme ataması yapılıyor:', {
        supplierId,
        supplierName,
        itemName,
        currentMaterialClass,
        currentMaterialGroup
      })

      // Önce bu tedarikçi-ürün ilişkisi zaten var mı kontrol et
      let existingQuery = supabase
        .from('supplier_materials')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('material_item', itemName)
      
      // Material class ve group ile existing assignment kontrolü
      const queryMaterialClass = currentMaterialClass || 'Genel'
      const queryMaterialGroup = currentMaterialGroup || 'Diğer'
      
      existingQuery = existingQuery
        .eq('material_class', queryMaterialClass)
        .eq('material_group', queryMaterialGroup)
      
      const { data: existingAssignment } = await existingQuery.single()

      if (existingAssignment) {
        showToast(`${supplierName} zaten bu ürün için kayıtlı.`, 'info')
        onClose()
        return
      }

      // Yeni atama oluştur - sadece supplier_materials şemasına uygun kolonlar
      const insertData: any = {
        supplier_id: supplierId,
        material_item: itemName,
        material_class: currentMaterialClass || 'Genel',
        material_group: currentMaterialGroup || 'Diğer'
      }
      
      console.log('💾 Supplier materials şemasına uygun insert verisi:', insertData)

      const { error: assignError } = await supabase
        .from('supplier_materials')
        .insert(insertData)

      if (assignError) {
        console.error('❌ Tedarikçi atama hatası:', assignError)
        throw new Error(`Tedarikçi ataması yapılamadı: ${assignError.message}`)
      }

      console.log('✅ Ürün tedarikçiye başarıyla atandı')
      showToast(`${itemName} ürünü ${supplierName} tedarikçisine başarıyla atandı!`, 'success')
      
      // Modal'ı kapat ve callback çağır
      onClose()
      if (onSuccess) {
        onSuccess()
      }
      
    } catch (error: any) {
      console.error('Error assigning material to supplier:', error)
      showToast(error.message || 'Ürün atanırken bir hata oluştu.', 'error')
    } finally {
      setAssigningSupplier(false)
    }
  }

  // Çoklu malzeme atama fonksiyonu
  const assignMultipleMaterialsToSupplier = async (supplierId: string, supplierName: string) => {
    if (!selectedMaterials || !materialItems || selectedMaterials.size === 0) {
      showToast('Seçili malzeme bulunamadı.', 'error')
      return
    }

    try {
      setAssigningSupplier(true)
      console.log('🔄 Çoklu malzeme tedarikçiye atanıyor...', { 
        supplierId, 
        supplierName,
        selectedCount: selectedMaterials.size
      })

      const selectedMaterialItems = materialItems.filter(item => 
        selectedMaterials.has(item.id)
      )

      let successCount = 0
      let skipCount = 0
      const errors: string[] = []

      // Her malzeme için atama yap
      for (const material of selectedMaterialItems) {
        try {
          // Önce bu tedarikçi-ürün ilişkisi zaten var mı kontrol et
          const { data: existingAssignment } = await supabase
            .from('supplier_materials')
            .select('id')
            .eq('supplier_id', supplierId)
            .eq('material_item', material.item_name)
            .eq('material_class', material.material_class || 'Genel')
            .eq('material_group', material.material_group || 'Diğer')
            .single()

          if (existingAssignment) {
            console.log(`⚠️ ${material.item_name} zaten bu tedarikçiye atanmış, atlanıyor`)
            skipCount++
            continue
          }

          // Yeni atama oluştur
          const insertData = {
            supplier_id: supplierId,
            material_item: material.item_name,
            material_class: material.material_class || 'Genel',
            material_group: material.material_group || 'Diğer'
          }

          const { error: assignError } = await supabase
            .from('supplier_materials')
            .insert(insertData)

          if (assignError) {
            console.error(`❌ ${material.item_name} atama hatası:`, assignError)
            errors.push(`${material.item_name}: ${assignError.message}`)
          } else {
            console.log(`✅ ${material.item_name} başarıyla atandı`)
            successCount++
          }
        } catch (error: any) {
          console.error(`❌ ${material.item_name} atama hatası:`, error)
          errors.push(`${material.item_name}: ${error.message}`)
        }
      }

      // Sonuç mesajı
      if (successCount > 0) {
        showToast(
          `${successCount} malzeme ${supplierName} tedarikçisine başarıyla atandı!` +
          (skipCount > 0 ? ` (${skipCount} malzeme zaten atanmıştı)` : '') +
          (errors.length > 0 ? ` (${errors.length} hatada hata oluştu)` : ''),
          'success'
        )
      }

      if (errors.length > 0 && successCount === 0) {
        showToast(`Hiçbir malzeme atanamadı. İlk hata: ${errors[0]}`, 'error')
      }

      // Modal'ı kapat ve callback çağır
      if (successCount > 0) {
        onClose()
        if (onSuccess) {
          onSuccess()
        }
      }

    } catch (error: any) {
      console.error('Çoklu malzeme atama hatası:', error)
      showToast(error.message || 'Malzemeler atanırken bir hata oluştu.', 'error')
    } finally {
      setAssigningSupplier(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-white/20">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-lg border-b border-gray-200/50 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedMaterials && selectedMaterials.size > 1 
                    ? 'Toplu Tedarikçi Ataması' 
                    : 'Tedarikçiye Ürün Ata'
                  }
                </h2>
                <p className="text-gray-500 mt-1">
                  {selectedMaterials && selectedMaterials.size > 1 
                    ? `${selectedMaterials.size} malzeme için tedarikçi ataması yapın` 
                    : `"${itemName}" ürününü bir tedarikçiye atayın`
                  }
                </p>
               
              </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-10 h-10 p-0 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {loadingSuppliers ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                </div>
                <p className="text-gray-600 font-medium">Tedarikçiler yükleniyor...</p>
                <p className="text-gray-400 text-sm mt-2">Bu işlem birkaç saniye sürebilir</p>
              </div>
            </div>
          ) : allSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Tedarikçi Bulunamadı</h3>
              <p className="text-gray-600 mb-6">Sistemde onaylı tedarikçi bulunmuyor.</p>
              <Button 
                onClick={() => router.push('/dashboard/suppliers')}
                className="bg-gray-800 hover:bg-gray-900 rounded-xl px-6 py-3 font-medium"
              >
                Tedarikçi Ekle
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-6">
               

                {/* Search Bar */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Tedarikçi ara... (şirket adı, kişi, email, telefon)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-400 transition-all duration-200"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center h-12 w-12 hover:bg-transparent"
                    >
                      <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Tedarikçi Listesi */}
              {filteredSuppliers.length === 0 && searchQuery ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Arama Sonucu Bulunamadı</h3>
                  <p className="text-gray-600 mb-4">
                    "<span className="font-medium">{searchQuery}</span>" araması için sonuç bulunamadı.
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    className="mx-auto"
                  >
                    Aramayı Temizle
                  </Button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    {/* Tablo Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                        <div className="col-span-3">Tedarikçi</div>
                        <div className="col-span-2">İletişim</div>
                        <div className="col-span-3">Email</div>
                        <div className="col-span-2">Durum</div>
                        <div className="col-span-2 text-center">İşlemler</div>
                      </div>
                    </div>
                    
                    {/* Tablo Body */}
                    <div className="divide-y divide-gray-200">
                      {filteredSuppliers.map((supplier, index) => (
                        <div 
                          key={supplier.id}
                          className={`px-6 py-4 hover:bg-white/60 transition-all duration-200 ${
                            index % 2 === 0 ? 'bg-white/40 backdrop-blur-sm' : 'bg-gray-50/30 backdrop-blur-sm'
                          }`}
                        >
                          <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Tedarikçi Bilgileri */}
                            <div className="col-span-3">
                              <div className="flex items-center gap-3">
                               
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm">
                                    {supplier.name}
                                  </h4>
                                  <p className="text-xs text-gray-600">
                                    {supplier.contact_person}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* İletişim */}
                            <div className="col-span-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Phone className="w-3 h-3" />
                                  <span className="truncate">{supplier.phone}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  <span className="text-xs text-gray-600">
                                    {supplier.rating}/5
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Email */}
                            <div className="col-span-3">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{supplier.email}</span>
                              </div>
                            </div>

                            {/* Durum */}
                            <div className="col-span-2">
                              <Badge className={`text-xs ${
                                supplier.is_approved 
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-green-50 text-green-700 border-green-300'
                              }`}>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {supplier.is_approved ? 'Onaylı' : 'Beklemede'}
                              </Badge>
                            </div>

                            {/* İşlemler */}
                            <div className="col-span-2">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                                  className="h-8 px-3 text-xs border-gray-200 hover:bg-gray-50"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Detay
                                </Button>
                                
                                {isBulkOrder ? (
                                  <Button
                                    onClick={() => {
                                      // Tedarikçi atama + sipariş modalı aç
                                      if (onBulkOrderWithSupplier) {
                                        onBulkOrderWithSupplier(supplier)
                                      }
                                    }}
                                    disabled={assigningSupplier}
                                    size="sm"
                                    className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                                  >
                                    {assigningSupplier ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                        İşleniyor
                                      </>
                                    ) : (
                                      <>
                                        <Package className="w-3 h-3 mr-1" />
                                        Toplu Sipariş Ver
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => assignMaterialToSupplier(supplier.id, supplier.name)}
                                    disabled={assigningSupplier}
                                    size="sm"
                                    className="h-8 px-7 text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                                  >
                                    {assigningSupplier ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                        Atanıyor
                                      </>
                                    ) : (
                                      <>
                                        
                                        Ata
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden divide-y divide-gray-200">
                    {filteredSuppliers.map((supplier, index) => (
                      <div 
                        key={supplier.id}
                        className="p-4 hover:bg-white/60 transition-all duration-200 bg-white/30 backdrop-blur-sm"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-base">
                                {supplier.name}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {supplier.contact_person}
                              </p>
                            </div>
                          </div>
                          <Badge className={`text-xs ${
                            supplier.is_approved 
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {supplier.is_approved ? 'Onaylı' : 'Beklemede'}
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{supplier.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{supplier.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span>{supplier.rating}/5 değerlendirme</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                            className="flex-1 h-9 text-sm border-gray-200 hover:bg-gray-50"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Detayları Gör
                          </Button>
                          
                          {isBulkOrder ? (
                            <Button
                              onClick={() => {
                                // Tedarikçi atama + sipariş modalı aç
                                if (onBulkOrderWithSupplier) {
                                  onBulkOrderWithSupplier(supplier)
                                }
                              }}
                              disabled={assigningSupplier}
                              size="sm"
                              className="flex-1 h-9 text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                            >
                              {assigningSupplier ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  İşleniyor...
                                </>
                              ) : (
                                <>
                                  <Package className="w-4 h-4 mr-2" />
                                  Toplu Sipariş Ver
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => assignMaterialToSupplier(supplier.id, supplier.name)}
                              disabled={assigningSupplier}
                              size="sm"
                              className="flex-1 h-9 text-sm bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
                            >
                              {assigningSupplier ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Atanıyor...
                                </>
                              ) : (
                                <>
                                  <Package className="w-4 h-4 mr-2" />
                                  Bu Tedarikçiye Ata
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tablo Footer - Toplam Sayı */}
                  <div className="bg-gray-50 px-4 lg:px-6 py-3 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-sm text-gray-600">
                        Toplam {filteredSuppliers.length} tedarikçi 
                        {searchQuery && ` (${allSuppliers.length} tedarikçi arasından filtrelendi)`}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-500">Onaylı: {filteredSuppliers.filter(s => s.is_approved).length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-xs text-gray-500">Beklemede: {filteredSuppliers.filter(s => !s.is_approved).length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alt Bilgi */}
              {/* Debug Bilgileri */}
              <div className="mt-6 bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-800 mb-3">Malzeme Bilgileri</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sınıf:</span>
                    <p className="font-medium text-gray-900">{materialClass || 'Belirtilmemiş'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Grup:</span>
                    <p className="font-medium text-gray-900">{materialGroup || 'Belirtilmemiş'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Ürün:</span>
                    <p className="font-medium text-gray-900">{itemName}</p>
                  </div>
                </div>
              </div>

              {/* Alt Bilgi */}
              <div className="mt-4 bg-blue-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-800 mb-1">Tedarikçi Ataması Hakkında</h4>
                    <p className="text-sm text-blue-700">
                      Bir ürünü tedarikçiye atadığınızda, gelecekte bu ürün için otomatik teklif alabilirsiniz. 
                      Tedarikçi ataması yapılan ürünler için manuel teklif girişi yapılamaz.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={assigningSupplier}
              className="px-6"
            >
              Kapat
            </Button>
            <Button
              onClick={() => {
                // Malzeme bilgisini URL parametresi olarak ekle
                const params = new URLSearchParams({
                  preselectedItem: itemName,
                  unit: itemUnit
                })
                router.push(`/dashboard/suppliers/create?${params.toString()}`)
              }}
              className="px-6 bg-gray-900 hover:bg-black text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Yeni Tedarikçi Ekle
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
