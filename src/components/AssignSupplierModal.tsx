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
  onSuccess?: () => void
}

export default function AssignSupplierModal({
  isOpen,
  onClose,
  itemName,
  itemUnit = 'adet',
  onSuccess
}: AssignSupplierModalProps) {
  const router = useRouter()
  const { showToast } = useToast()
  
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [assigningSupplier, setAssigningSupplier] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal açıldığında tedarikçileri yükle ve search'i temizle
  useEffect(() => {
    if (isOpen) {
      fetchAllSuppliers()
      setSearchQuery('') // Search'i temizle
    }
  }, [isOpen])

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

  const fetchAllSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      console.log('🔍 Tüm tedarikçiler yükleniyor...')
      
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
        .eq('is_approved', true) // Sadece onaylı tedarikçiler
        .order('name')

      if (error) {
        console.error('❌ Tedarikçiler yüklenirken hata:', error)
        throw error
      }

      console.log('✅ Tedarikçiler yüklendi:', suppliers?.length || 0)
      setAllSuppliers(suppliers || [])
      
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      showToast('Tedarikçiler yüklenirken bir hata oluştu.', 'error')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const assignMaterialToSupplier = async (supplierId: string, supplierName: string) => {
    if (!itemName) {
      showToast('Ürün bilgisi bulunamadı.', 'error')
      return
    }

    try {
      setAssigningSupplier(true)
      console.log('🔄 Ürün tedarikçiye atanıyor...', { 
        supplierId, 
        supplierName,
        itemName 
      })

      // Önce bu ürün için material_item var mı kontrol et
      let { data: materialItem, error: itemError } = await supabase
        .from('material_items')
        .select('id')
        .ilike('name', itemName) // Case-insensitive arama
        .single()

      // Eğer material_item yoksa oluştur
      if (itemError || !materialItem) {
        console.log('📦 Material item bulunamadı, yeni oluşturuluyor...', itemName)
        
        // Varsayılan kategori ve alt kategori ID'lerini al
        const { data: defaultCategory } = await supabase
          .from('material_categories')
          .select('id')
          .limit(1)
          .single()

        if (defaultCategory) {
          const { data: defaultSubcategory } = await supabase
            .from('material_subcategories')
            .select('id')
            .eq('category_id', defaultCategory.id)
            .limit(1)
            .single()

          if (defaultSubcategory) {
            const { data: newMaterialItem, error: createError } = await supabase
              .from('material_items')
              .insert({
                name: itemName,
                unit: itemUnit,
                subcategory_id: defaultSubcategory.id
              })
              .select('id')
              .single()

            if (createError) {
              console.error('❌ Material item oluşturma hatası:', createError)
              throw new Error(`Material item oluşturulamadı: ${createError.message}`)
            }

            materialItem = newMaterialItem
            console.log('✅ Yeni material item oluşturuldu:', materialItem)
          }
        }
      }

      if (!materialItem) {
        throw new Error('Material item oluşturulamadı veya bulunamadı')
      }

      // Önce bu tedarikçi-ürün ilişkisi zaten var mı kontrol et
      const { data: existingAssignment } = await supabase
        .from('supplier_materials')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('material_item_id', materialItem.id)
        .single()

      if (existingAssignment) {
        showToast(`${supplierName} zaten bu ürün için kayıtlı.`, 'info')
        onClose()
        return
      }

      // Yeni atama oluştur
      const { error: assignError } = await supabase
        .from('supplier_materials')
        .insert({
          supplier_id: supplierId,
          material_item_id: materialItem.id
        })

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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Tedarikçiye Ürün Ata</h2>
              <p className="text-gray-500 mt-1">
                "{itemName}" ürününü bir tedarikçiye atayın
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSuppliers.map((supplier) => (
                  <div 
                    key={supplier.id}
                    className="bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 relative group"
                  >
                    {/* Tedarikçi Bilgileri */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-lg mb-1">
                            {supplier.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {supplier.contact_person}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium text-yellow-700">
                            {supplier.rating}/5
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{supplier.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{supplier.address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Durum Badge */}
                    <div className="mb-4">
                      <Badge className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Onaylı Tedarikçi
                      </Badge>
                    </div>

                    {/* Aksiyon Butonları */}
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                        className="w-full text-gray-700 border-gray-200 hover:bg-gray-50"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Detayları Gör
                      </Button>
                      
                      <Button
                        onClick={() => assignMaterialToSupplier(supplier.id, supplier.name)}
                        disabled={assigningSupplier}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg h-10 disabled:opacity-50"
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
                    </div>
                  </div>
                  ))}
                </div>
              )}

              {/* Alt Bilgi */}
              <div className="mt-8 bg-blue-50 rounded-xl p-4">
               
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
              onClick={() => router.push('/dashboard/suppliers/create')}
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
