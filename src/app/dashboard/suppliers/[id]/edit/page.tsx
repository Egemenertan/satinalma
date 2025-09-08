'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Building2, Mail, Phone, MapPin, Hash, Plus, X, Save, Package } from 'lucide-react'

// Material interfaces for all_materials table
interface MaterialClass {
  class: string
}

interface MaterialGroup {
  group: string
}

interface MaterialItemData {
  item_name: string
}

interface SelectedMaterial {
  id: string
  class: string
  group: string
  item: string
  display: string
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
  supplier_id: string
  material_class: string
  material_group: string
  material_item: string
  price_range_min?: number
  price_range_max?: number
  currency?: string
  delivery_time_days?: number
  minimum_order_quantity?: number
  is_preferred?: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export default function EditSupplierPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [loadingSupplier, setLoadingSupplier] = useState(true)
  
  // Material selection states
  const [materialClasses, setMaterialClasses] = useState<string[]>([])
  const [materialGroups, setMaterialGroups] = useState<string[]>([])
  const [materialItems, setMaterialItems] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([])
  const [existingMaterials, setExistingMaterials] = useState<SupplierMaterial[]>([])
  
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  
  const [formData, setFormData] = useState<{
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    tax_number: string;
    address: string;
    description: string;
  }>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    tax_number: '',
    address: '',
    description: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchSupplierDetails(),
        fetchMaterialClasses()
      ])
    }
    loadData()
  }, [params.id])

  const fetchSupplierDetails = async () => {
    try {
      setLoadingSupplier(true)
      
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
      
      // Form data'yı doldur
      setFormData({
        company_name: supplierData.name || '',
        contact_name: supplierData.contact_person || '',
        email: supplierData.email || '',
        phone: supplierData.phone || '',
        tax_number: supplierData.tax_number || '',
        address: supplierData.address || '',
        description: ''
      })

      // Mevcut malzemeleri çek
      const { data: materialsData, error: materialsError } = await supabase
        .from('supplier_materials')
        .select(`
          id,
          supplier_id,
          material_class,
          material_group,
          material_item,
          price_range_min,
          price_range_max,
          currency,
          delivery_time_days,
          minimum_order_quantity,
          is_preferred,
          notes,
          created_at,
          updated_at
        `)
        .eq('supplier_id', params.id)
        .order('created_at', { ascending: false })

      if (materialsError) {
        console.error('Tedarikçi malzemeleri çekilirken hata:', materialsError)
        setExistingMaterials([])
      } else {
        console.log('Mevcut malzemeler:', materialsData)
        setExistingMaterials(materialsData || [])
      }

    } catch (error: any) {
      console.error('Tedarikçi detayları yüklenirken hata:', error)
      showToast(error.message || 'Tedarikçi detayları yüklenirken bir hata oluştu.', 'error')
      router.push('/dashboard/suppliers')
    } finally {
      setLoadingSupplier(false)
    }
  }

  // Fetch distinct material classes
  const fetchMaterialClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('all_materials')
        .select('class')
        .not('class', 'is', null)
        .not('class', 'eq', '')

      if (error) throw error
      
      const uniqueClasses = Array.from(new Set(data?.map(item => item.class)))
        .filter(Boolean)
        .sort()
      
      setMaterialClasses(uniqueClasses)
    } catch (error) {
      console.error('Malzeme sınıfları yüklenirken hata:', error)
      showToast("Malzeme sınıfları yüklenirken bir hata oluştu.", "error")
    }
  }

  // Fetch groups for selected class
  const fetchMaterialGroups = async (materialClass: string) => {
    try {
      const { data, error } = await supabase
        .from('all_materials')
        .select('group')
        .eq('class', materialClass)
        .not('group', 'is', null)
        .not('group', 'eq', '')

      if (error) throw error
      
      const uniqueGroups = Array.from(new Set(data?.map(item => item.group)))
        .filter(Boolean)
        .sort()
      
      setMaterialGroups(uniqueGroups)
    } catch (error) {
      console.error('Malzeme grupları yüklenirken hata:', error)
      showToast("Malzeme grupları yüklenirken bir hata oluştu.", "error")
    }
  }

  // Fetch items for selected class and group
  const fetchMaterialItems = async (materialClass: string, materialGroup: string) => {
    try {
      const { data, error } = await supabase
        .from('all_materials')
        .select('item_name')
        .eq('class', materialClass)
        .eq('group', materialGroup)
        .not('item_name', 'is', null)
        .not('item_name', 'eq', '')

      if (error) throw error
      
      const uniqueItems = Array.from(new Set(data?.map(item => item.item_name)))
        .filter(Boolean)
        .sort()
      
      setMaterialItems(uniqueItems)
    } catch (error) {
      console.error('Malzeme öğeleri yüklenirken hata:', error)
      showToast("Malzeme öğeleri yüklenirken bir hata oluştu.", "error")
    }
  }

  // Handle material selection changes
  const handleClassChange = (value: string) => {
    setSelectedClass(value)
    setSelectedGroup('')
    setSelectedItem('')
    setSelectedItems([])
    setMaterialGroups([])
    setMaterialItems([])
    if (value) {
      fetchMaterialGroups(value)
    }
  }

  const handleGroupChange = (value: string) => {
    setSelectedGroup(value)
    setSelectedItem('')
    setSelectedItems([])
    setMaterialItems([])
    if (value && selectedClass) {
      fetchMaterialItems(selectedClass, value)
    }
  }

  const handleItemToggle = (item: string) => {
    setSelectedItems(prev => {
      if (prev.includes(item)) {
        return prev.filter(i => i !== item)
      } else {
        return [...prev, item]
      }
    })
  }

  const selectAllItems = () => {
    setSelectedItems([...materialItems])
  }

  const clearAllItems = () => {
    setSelectedItems([])
  }

  // Add selected materials
  const addMaterials = async () => {
    if (selectedClass && selectedGroup && selectedItems.length > 0) {
      try {
        // Önce mevcut malzemeleri kontrol et
        const existingCombinations = existingMaterials.map(m => `${m.material_class}-${m.material_group}-${m.material_item}`)
        
        const newMaterialsToAdd = selectedItems.filter(item => 
          !existingCombinations.includes(`${selectedClass}-${selectedGroup}-${item}`)
        )
        
        if (newMaterialsToAdd.length === 0) {
          showToast("Seçilen malzemeler zaten eklenmiş.", "error")
          return
        }

        // Veritabanına ekle
        const materialsToInsert = newMaterialsToAdd.map(item => ({
          supplier_id: params.id,
          material_class: selectedClass,
          material_group: selectedGroup,
          material_item: item,
          created_at: new Date().toISOString()
        }))

        const { error } = await supabase
          .from('supplier_materials')
          .insert(materialsToInsert)

        if (error) throw error

        showToast(`${newMaterialsToAdd.length} malzeme başarıyla eklendi.`, "success")
        
        // Mevcut malzemeleri yeniden yükle
        await fetchSupplierDetails()
        
        // Reset item selection but keep class and group
        setSelectedItems([])
        
      } catch (error) {
        console.error('Malzeme eklenirken hata:', error)
        showToast("Malzeme eklenirken bir hata oluştu.", "error")
      }
    }
  }

  // Remove existing material
  const removeExistingMaterial = async (materialId: string) => {
    try {
      const { error } = await supabase
        .from('supplier_materials')
        .delete()
        .eq('id', materialId)

      if (error) throw error

      showToast("Malzeme başarıyla kaldırıldı.", "success")
      
      // Mevcut malzemeleri yeniden yükle
      await fetchSupplierDetails()
      
    } catch (error) {
      console.error('Malzeme kaldırılırken hata:', error)
      showToast("Malzeme kaldırılırken bir hata oluştu.", "error")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Form verilerini kontrol et
      if (!formData.company_name || !formData.contact_name || !formData.email || !formData.phone || !formData.tax_number) {
        throw new Error('Lütfen tüm zorunlu alanları doldurun.')
      }

      // Eğer materyal seçimi yapılmış ama henüz eklenmemişse, otomatik olarak ekle
      if (selectedClass && selectedGroup && selectedItems.length > 0) {
        try {
          // Önce mevcut malzemeleri kontrol et
          const existingCombinations = existingMaterials.map(m => `${m.material_class}-${m.material_group}-${m.material_item}`)
          
          const newMaterialsToAdd = selectedItems.filter(item => 
            !existingCombinations.includes(`${selectedClass}-${selectedGroup}-${item}`)
          )
          
          if (newMaterialsToAdd.length > 0) {
            // Veritabanına ekle
            const materialsToInsert = newMaterialsToAdd.map(item => ({
              supplier_id: params.id,
              material_class: selectedClass,
              material_group: selectedGroup,
              material_item: item,
              created_at: new Date().toISOString()
            }))

            const { error: materialsError } = await supabase
              .from('supplier_materials')
              .insert(materialsToInsert)

            if (materialsError) {
              console.warn('Malzeme otomatik ekleme uyarısı:', materialsError)
            } else {
              console.log(`${newMaterialsToAdd.length} malzeme otomatik olarak eklendi`)
            }
          }
        } catch (materialError) {
          console.warn('Malzeme otomatik ekleme sırasında hata:', materialError)
          // Malzeme ekleme hatası ana işlemi durdurmaz
        }
      }

      // Tedarikçi bilgilerini güncelle
      const supplierDataToUpdate = {
        name: formData.company_name,
        contact_person: formData.contact_name,
        email: formData.email,
        phone: formData.phone,
        tax_number: formData.tax_number,
        address: formData.address,
        updated_at: new Date().toISOString()
      }

      console.log('Güncellenecek tedarikçi verileri:', supplierDataToUpdate)

      const { error: supplierError } = await supabase
        .from('suppliers')
        .update(supplierDataToUpdate)
        .eq('id', params.id)

      if (supplierError) {
        console.error('Tedarikçi güncelleme hatası:', supplierError)
        throw new Error(`Tedarikçi güncellenemedi: ${supplierError.message}`)
      }

      showToast("Tedarikçi başarıyla güncellendi.", "success")
      router.push(`/dashboard/suppliers/${params.id}`)
      router.refresh()
    } catch (error: any) {
      console.error('Tedarikçi güncellenirken hata:', error)
      showToast(error.message || "Tedarikçi güncellenirken bir hata oluştu.", "error")
    } finally {
      setLoading(false)
    }
  }

  if (loadingSupplier) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tedarikçi Bulunamadı</h2>
          <p className="text-gray-600 mb-4">İstediğiniz tedarikçi bilgilerine ulaşılamadı.</p>
          <Button onClick={() => router.back()}>Geri Dön</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Tedarikçi Düzenle</h1>
          <p className="text-gray-600 mt-2">
            <span className="font-medium text-gray-800">{supplier.name}</span> tedarikçisinin bilgilerini düzenleyin
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Geri Dön</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Tedarikçi Bilgileri */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-gray-600" />
              <span>Tedarikçi Bilgileri</span>
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">Tedarikçi firma bilgilerini düzenleyin</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-sm font-medium text-gray-700">
                  Firma Adı *
                </Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  placeholder="Firma adını girin"
                  className="h-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name" className="text-sm font-medium text-gray-700">
                  İletişim Kişisi *
                </Label>
                <Input
                  id="contact_name"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="İletişim kişisinin adı"
                  className="h-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <Mail className="h-4 w-4" />
                  <span>E-posta *</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  className="h-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <Phone className="h-4 w-4" />
                  <span>Telefon *</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+90 (5xx) xxx xx xx"
                  className="h-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_number" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <Hash className="h-4 w-4" />
                  <span>Vergi Numarası *</span>
                </Label>
                <Input
                  id="tax_number"
                  name="tax_number"
                  value={formData.tax_number}
                  onChange={handleChange}
                  placeholder="Vergi numarası"
                  className="h-10 border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>Adres *</span>
                </Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Tam adres bilgisi"
                  className="min-h-[80px] resize-none border-gray-200 focus:border-gray-400 focus:ring-gray-400"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mevcut Malzemeler */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-lg font-semibold text-gray-900">Mevcut Malzemeler</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Tedarikçinin mevcut malzeme kategorileri ({existingMaterials.length} adet)
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {existingMaterials.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Henüz malzeme eklenmemiş</p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {existingMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-sm text-gray-900 font-medium">
                        {material.material_class} → {material.material_group} → {material.material_item}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExistingMaterial(material.id)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Yeni Malzeme Ekleme */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-lg font-semibold text-gray-900">Yeni Malzeme Ekle</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Tedarikçiye yeni malzeme kategorileri ekleyin</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            <div className="bg-gray-50 rounded-lg p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Malzeme Sınıfı</Label>
                  <Select value={selectedClass} onValueChange={handleClassChange}>
                    <SelectTrigger className="w-full h-10 bg-white border-gray-200 focus:border-gray-400 focus:ring-gray-400">
                      <SelectValue placeholder="Sınıf seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-xl">
                      {materialClasses.map((materialClass) => (
                        <SelectItem key={materialClass} value={materialClass} className="hover:bg-gray-50/80 focus:bg-gray-100/80">
                          {materialClass}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Malzeme Grubu</Label>
                  <Select value={selectedGroup} onValueChange={handleGroupChange} disabled={!selectedClass}>
                    <SelectTrigger className="w-full h-10 bg-white border-gray-200 focus:border-gray-400 focus:ring-gray-400 disabled:bg-gray-50 disabled:border-gray-100">
                      <SelectValue placeholder="Grup seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-xl">
                      {materialGroups.map((group) => (
                        <SelectItem key={group} value={group} className="hover:bg-gray-50/80 focus:bg-gray-100/80">
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Malzeme Öğesi
                    {selectedItems.length > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600 text-xs">
                        {selectedItems.length} seçildi
                      </Badge>
                    )}
                  </Label>
                  {!selectedGroup ? (
                    <div className="w-full h-10 bg-gray-50 border border-gray-100 rounded-md flex items-center px-3 text-sm text-gray-400">
                      Önce grup seçin
                    </div>
                  ) : materialItems.length === 0 ? (
                    <div className="w-full h-10 bg-gray-50 border border-gray-100 rounded-md flex items-center px-3 text-sm text-gray-400">
                      Malzeme yükleniyor...
                    </div>
                  ) : (
                    <div className="w-full bg-white border border-gray-200 rounded-md">
                      {/* Select All / Clear All Controls */}
                      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/50">
                        <span className="text-xs text-gray-600 font-medium">
                          {materialItems.length} öğe mevcut
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={selectAllItems}
                            disabled={selectedItems.length === materialItems.length}
                            className="text-xs text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            Tümünü Seç
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={clearAllItems}
                            disabled={selectedItems.length === 0}
                            className="text-xs text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            Temizle
                          </button>
                        </div>
                      </div>
                      
                      {/* Items List */}
                      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                        {materialItems.map((item) => (
                          <label
                            key={item}
                            className={`flex items-center space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors ${
                              selectedItems.includes(item) ? 'bg-gray-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item)}
                              onChange={() => handleItemToggle(item)}
                              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                            />
                            <span className="text-sm text-gray-900 flex-1">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  onClick={addMaterials}
                  disabled={!selectedClass || !selectedGroup || selectedItems.length === 0}
                  className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {selectedItems.length > 0 
                      ? `${selectedItems.length} Malzeme Ekle` 
                      : 'Malzeme Ekle'
                    }
                  </span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-8 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>İptal</span>
          </Button>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {existingMaterials.length > 0 ? `${existingMaterials.length} malzeme kategorisi mevcut` : 'Henüz malzeme yok'}
            </span>
            <Button
              type="submit"
              disabled={loading || !formData.company_name || !formData.contact_name || !formData.email || !formData.phone || !formData.tax_number || !formData.address}
              className={`flex items-center space-x-2 min-w-[140px] font-medium transition-all duration-200 ${
                loading || !formData.company_name || !formData.contact_name || !formData.email || !formData.phone || !formData.tax_number || !formData.address
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-black hover:bg-gray-900 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              <Save className="h-4 w-4" />
              <span>{loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
