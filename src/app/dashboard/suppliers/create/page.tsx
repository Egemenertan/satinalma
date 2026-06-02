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
import { ArrowLeft, Building2, Mail, Phone, MapPin, Hash, Plus, X } from 'lucide-react'

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

export default function CreateSupplierPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  
  // Material selection states
  const [materialClasses, setMaterialClasses] = useState<string[]>([])
  const [materialGroups, setMaterialGroups] = useState<string[]>([])
  const [materialItems, setMaterialItems] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([])
  
  // Otomatik seçim kontrolü için - useRef kullanarak çift çalışmayı engelle
  const autoSelectionProcessed = useRef(false)
  
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

  // Erişim kontrolü
  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Kullanıcının site_id'sini kontrol et
      const { data: profile } = await supabase
        .from('profiles')
        .select('site_id')
        .eq('id', user.id)
        .single()

      const restrictedSiteId = 'f7f3d36e-0c31-4e9a-8883-94c39330660b'
      
      if (profile?.site_id) {
        const siteIds = Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id]
        
        // Eğer kullanıcı kısıtlanmış site ID'sine aitse erişimi engelle
        if (siteIds.includes(restrictedSiteId)) {
          router.push('/dashboard')
          return
        }
      }

      setHasAccess(true)
      setIsCheckingAccess(false)
    }

    checkAccess()
  }, [router])

  useEffect(() => {
    fetchMaterialClasses()
  }, [])

  // URL'den gelen önceden seçili malzeme için otomatik seçim
  useEffect(() => {
    const preselectedItem = searchParams.get('preselectedItem')
    
    if (preselectedItem && !autoSelectionProcessed.current && materialClasses.length > 0) {
      console.log('🎯 Önceden seçili malzeme bulundu:', preselectedItem)
      autoSelectionProcessed.current = true // İşlemi sadece bir kez yap
      findAndSelectMaterial(preselectedItem)
    }
  }, [materialClasses, searchParams]) // dependencies'i geri ekledik ama useRef sayesinde çift çalışmayacak

  // Malzemeyi bulup otomatik seç
  const findAndSelectMaterial = async (itemName: string) => {
    try {
      console.log('🔍 Malzeme aranıyor:', itemName)
      
      // all_materials tablosunda bu item_name'i ara
      const { data: materialData, error } = await supabase
        .from('all_materials')
        .select('class, group, item_name')
        .ilike('item_name', itemName) // Case-insensitive search
        .limit(1)
        .single()

      if (error || !materialData) {
        console.log('⚠️ Malzeme all_materials tablosunda bulunamadı:', itemName)
        // Malzeme bulunamadıysa kullanıcıyı bilgilendir (sadece bir kez)
        showToast(`"${itemName}" malzemesi için otomatik kategori seçimi yapılamadı. Manuel olarak seçebilirsiniz.`, 'info')
        return
      }

      console.log('✅ Malzeme bulundu:', materialData)

      // Önce class'ı seç
      setSelectedClass(materialData.class)
      
      // Groups'ları yükle
      await fetchMaterialGroups(materialData.class)
      
      // Biraz bekle groups yüklensin
      setTimeout(async () => {
        // Group'u seç
        setSelectedGroup(materialData.group)
        
        // Items'ları yükle
        await fetchMaterialItems(materialData.class, materialData.group)
        
        // Biraz daha bekle items yüklensin
        setTimeout(() => {
          // Item'ı seç
          setSelectedItems([materialData.item_name])
          
          console.log('🎯 Malzeme otomatik olarak seçildi:', {
            class: materialData.class,
            group: materialData.group,
            item: materialData.item_name
          })
          
          // Bilgilendirme mesajı - sadece işlem tamamlandığında göster
          showToast(`"${itemName}" malzemesi otomatik olarak seçildi.`, 'success')
        }, 500)
      }, 500)

    } catch (error) {
      console.error('❌ Malzeme arama hatası:', error)
      showToast(`Malzeme aranırken bir hata oluştu.`, 'error')
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
  const addMaterials = () => {
    if (selectedClass && selectedGroup && selectedItems.length > 0) {
      const newMaterials: SelectedMaterial[] = selectedItems.map(item => ({
        id: `${Date.now()}-${item}`,
        class: selectedClass,
        group: selectedGroup,
        item: item,
        display: `${selectedClass} > ${selectedGroup} > ${item}`
      }))
      
      // Filter out already existing materials
      const existingCombinations = selectedMaterials.map(m => `${m.class}-${m.group}-${m.item}`)
      const uniqueNewMaterials = newMaterials.filter(newMat => 
        !existingCombinations.includes(`${newMat.class}-${newMat.group}-${newMat.item}`)
      )
      
      if (uniqueNewMaterials.length > 0) {
        setSelectedMaterials([...selectedMaterials, ...uniqueNewMaterials])
        // Reset item selection but keep class and group
        setSelectedItems([])
        showToast(`${uniqueNewMaterials.length} malzeme eklendi.`, "success")
      } else {
        showToast("Seçilen malzemeler zaten eklenmiş.", "error")
      }
    }
  }

  // Remove material
  const removeMaterial = (id: string) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.id !== id))
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
        const newMaterials: SelectedMaterial[] = selectedItems.map(item => ({
          id: `${Date.now()}-${item}`,
          class: selectedClass,
          group: selectedGroup,
          item: item,
          display: `${selectedClass} > ${selectedGroup} > ${item}`
        }))
        
        // Mevcut malzemelerle çakışan olanları filtrele
        const existingCombinations = selectedMaterials.map(m => `${m.class}-${m.group}-${m.item}`)
        const uniqueNewMaterials = newMaterials.filter(newMat => 
          !existingCombinations.includes(`${newMat.class}-${newMat.group}-${newMat.item}`)
        )
        
        if (uniqueNewMaterials.length > 0) {
          setSelectedMaterials(prev => [...prev, ...uniqueNewMaterials])
          console.log(`${uniqueNewMaterials.length} malzeme otomatik olarak eklendi`)
        }
      }

      // Tedarikçi verilerini hazırla
      const supplierDataToInsert = {
        name: formData.company_name,
        contact_person: formData.contact_name,
        email: formData.email,
        phone: formData.phone,
        tax_number: formData.tax_number,
        address: formData.address,
        is_approved: false,
        rating: 0,
        code: `SUP${Date.now()}`, // Generate a simple code
        created_at: new Date().toISOString()
      }

      console.log('Eklenecek tedarikçi verileri:', supplierDataToInsert)

      // Önce tedarikçiyi oluştur
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .insert([supplierDataToInsert])
        .select()

      if (supplierError) {
        console.error('Tedarikçi oluşturma hatası:', supplierError)
        throw new Error(`Tedarikçi oluşturulamadı: ${supplierError.message}`)
      }

      if (!supplierData || supplierData.length === 0) {
        throw new Error('Tedarikçi oluşturuldu fakat veri dönmedi')
      }

      console.log('Oluşturulan tedarikçi:', supplierData[0])

      // Güncellenmiş selectedMaterials listesini kullanarak malzemeleri tedarikçi ile ilişkilendir
      const finalSelectedMaterials = [...selectedMaterials]
      
      if (finalSelectedMaterials.length > 0) {
        const supplierMaterials = finalSelectedMaterials.map(material => ({
          supplier_id: supplierData[0].id,
          material_class: material.class,
          material_group: material.group,
          material_item: material.item,
          created_at: new Date().toISOString()
        }))

        console.log('Eklenecek malzeme ilişkileri:', supplierMaterials)

        // Note: This assumes supplier_materials table supports these columns
        // If not, we may need to create a different approach
        const { error: materialsError } = await supabase
          .from('supplier_materials')
          .insert(supplierMaterials)

        if (materialsError) {
          console.warn('Malzeme ilişkilendirme uyarısı:', materialsError)
          // Don't fail the entire operation for this
        }
      }

      showToast("Tedarikçi başarıyla oluşturuldu.", "success")
      router.push('/dashboard/suppliers')
      router.refresh()
    } catch (error: any) {
      console.error('Tedarikçi oluşturulurken hata:', error)
      showToast(error.message || "Tedarikçi oluşturulurken bir hata oluştu.", "error")
    } finally {
      setLoading(false)
    }
  }

  // Erişim kontrolü - yükleniyor
  if (isCheckingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  // Erişim yok
  if (!hasAccess) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Yeni Tedarikçi Oluştur</h1>
          {searchParams.get('preselectedItem') ? (
            <p className="text-gray-600 mt-2">
              "<span className="font-medium text-gray-800">{searchParams.get('preselectedItem')}</span>" malzemesi için yeni tedarikçi oluşturun
            </p>
          ) : (
            <p className="text-gray-600 mt-2">Yeni bir tedarikçi kaydı oluşturun ve malzeme kategorilerini atayın</p>
          )}
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
            <p className="text-sm text-gray-500 mt-1">Tedarikçi firma bilgilerini girin</p>
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

        {/* Malzeme Seçimi */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-lg font-semibold text-gray-900">Malzeme Kategorileri</CardTitle>
            {searchParams.get('preselectedItem') ? (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  🎯 "<span className="font-medium">{searchParams.get('preselectedItem')}</span>" malzemesi otomatik olarak seçilmiştir. 
                  İsterseniz başka malzeme kategorileri de ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Tedarikçinin sağladığı malzeme kategorilerini seçin</p>
            )}
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            {/* Material Selection Section */}
            <div className="bg-gray-50 rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-900">Malzeme Ekle</h3>
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  {selectedMaterials.length} seçildi
                </Badge>
              </div>
              
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

            {/* Selected Materials */}
            {selectedMaterials.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Seçilen Malzemeler</Label>
                  <Badge variant="outline" className="text-xs">
                    {selectedMaterials.length} kategori
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto">
                  {selectedMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-sm text-gray-900 font-medium">{material.display}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMaterial(material.id)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              {selectedMaterials.length > 0 ? `${selectedMaterials.length} malzeme kategorisi seçildi` : 'Malzeme kategorisi opsiyoneldir'}
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
              <span>{loading ? 'Kaydediliyor...' : 'Tedarikçi Oluştur'}</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
