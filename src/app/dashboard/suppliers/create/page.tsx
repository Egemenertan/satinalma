'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { MaterialCategory, MaterialSubcategory, MaterialItem } from '@/types/materials'

export default function CreateSupplierPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [subcategories, setSubcategories] = useState<MaterialSubcategory[]>([])
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [formData, setFormData] = useState<{
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    tax_number: string;
    tax_office: string;
    address: string;
    description: string;
  }>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    tax_number: '',
    tax_office: '',
    address: '',
    description: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('material_categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data)
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error)
      showToast("Kategoriler yüklenirken bir hata oluştu.", "error")
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
      setSubcategories(data)
    } catch (error) {
      console.error('Alt kategoriler yüklenirken hata:', error)
      showToast("Alt kategoriler yüklenirken bir hata oluştu.", "error")
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
      setMaterialItems(data)
    } catch (error) {
      console.error('Malzemeler yüklenirken hata:', error)
      showToast("Malzemeler yüklenirken bir hata oluştu.", "error")
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

      // Seçilen malzemeleri tedarikçi ile ilişkilendir
      if (selectedMaterials.length > 0) {
        const supplierMaterials = selectedMaterials.map(materialId => ({
          supplier_id: supplierData[0].id,
          material_item_id: materialId,
          created_at: new Date().toISOString()
        }))

        console.log('Eklenecek malzeme ilişkileri:', supplierMaterials)

        const { error: materialsError } = await supabase
          .from('supplier_materials')
          .insert(supplierMaterials)

        if (materialsError) {
          console.error('Malzeme ilişkilendirme hatası:', materialsError)
          throw new Error(`Malzemeler ilişkilendirilemedi: ${materialsError.message}`)
        }
      }

      showToast("Tedarikçi ve malzemeleri başarıyla oluşturuldu.", "success")
      router.push('/dashboard/suppliers')
      router.refresh()
    } catch (error: any) {
      console.error('Tedarikçi oluşturulurken hata:', error)
      showToast(error.message || "Tedarikçi oluşturulurken bir hata oluştu.", "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Yeni Tedarikçi Oluştur</h1>
          <p className="text-gray-600 mt-2">Yeni bir tedarikçi kaydı oluşturun</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          Geri Dön
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && "Tedarikçi Bilgileri"}
            {currentStep === 2 && "Malzeme Kategorisi Seçimi"}
            {currentStep === 3 && "Alt Kategori Seçimi"}
            {currentStep === 4 && "Malzeme Seçimi"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Adım 1: Tedarikçi Bilgileri */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Firma Adı *</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_name">İletişim Kişisi *</Label>
                  <Input
                    id="contact_name"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-posta *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_number">Vergi Numarası *</Label>
                  <Input
                    id="tax_number"
                    name="tax_number"
                    value={formData.tax_number}
                    onChange={handleChange}
                    required
                  />
                </div>

                

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Adres *</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                
              </div>
            )}

            {/* Adım 2: Malzeme Kategorisi Seçimi */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Malzeme Kategorisi</Label>
                  <Select 
                    onValueChange={(value) => {
                      fetchSubcategories(value)
                      setSubcategories([])
                      setMaterialItems([])
                    }}
                  >
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
              </div>
            )}

            {/* Adım 3: Alt Kategori Seçimi */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Alt Kategori</Label>
                  <Select 
                    onValueChange={(value) => {
                      fetchMaterialItems(value)
                      setMaterialItems([])
                    }}
                  >
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
              </div>
            )}

            {/* Adım 4: Malzeme Seçimi */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Malzemeler</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {materialItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={item.id}
                          checked={selectedMaterials.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMaterials([...selectedMaterials, item.id])
                            } else {
                              setSelectedMaterials(selectedMaterials.filter(id => id !== item.id))
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={item.id}>{item.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (currentStep === 1) {
                    router.back()
                  } else {
                    setCurrentStep(currentStep - 1)
                  }
                }}
                disabled={loading}
              >
                {currentStep === 1 ? 'İptal' : 'Geri'}
              </Button>

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={loading || (currentStep === 1 && !formData.company_name)}
                >
                  İleri
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || selectedMaterials.length === 0}
                >
                  {loading ? 'Kaydediliyor...' : 'Tedarikçi Oluştur'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
