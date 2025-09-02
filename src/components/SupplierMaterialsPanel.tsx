'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { 
  X, 
  ArrowLeft, 
  ArrowRight,
  Package, 
  Building2,
  Star,
  Phone,
  Mail,
  MapPin,
  Check,
  ChevronRight,
  Search,
  Plus,
  Minus,
  Save
} from 'lucide-react'

interface MaterialCategory {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
}

interface MaterialSubcategory {
  id: string
  category_id: string
  name: string
  description?: string
}

interface MaterialItem {
  id: string
  subcategory_id: string
  name: string
  description?: string
  unit?: string
  is_active: boolean
}

interface SupplierMaterial {
  id?: string
  material_category_id?: string
  material_subcategory_id?: string
  material_item_id?: string
  price_range_min?: number
  price_range_max?: number
  delivery_time_days: number
  minimum_order_amount?: number
  notes?: string
  is_preferred: boolean
  // Joined data
  category_name?: string
  subcategory_name?: string
  item_name?: string
}

interface Supplier {
  id: string
  name: string
  code?: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  tax_number?: string
  payment_terms: number
  rating: number
  total_orders: number
  is_approved: boolean
  last_order_date?: string
  created_at: string
}

interface SupplierMaterialsPanelProps {
  supplier: Supplier | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

type Step = 'category' | 'subcategory' | 'items' | 'details'

export function SupplierMaterialsPanel({ supplier, isOpen, onClose, onUpdate }: SupplierMaterialsPanelProps) {
  const [currentStep, setCurrentStep] = useState<Step>('category')
  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [subcategories, setSubcategories] = useState<MaterialSubcategory[]>([])
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([])
  const [supplierMaterials, setSupplierMaterials] = useState<SupplierMaterial[]>([])
  
  // Selection state
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<MaterialSubcategory | null>(null)
  const [selectedItems, setSelectedItems] = useState<MaterialItem[]>([])
  
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    if (isOpen && supplier) {
      fetchCategories()
      fetchSupplierMaterials()
    }
    if (!isOpen) {
      resetState()
    }
  }, [isOpen, supplier])

  const resetState = () => {
    setCurrentStep('category')
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    setSelectedItems([])
    setSearchTerm('')
  }

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('material_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      showToast('Kategoriler yüklenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchSubcategories = async (categoryId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('material_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('name')

      if (error) throw error
      setSubcategories(data || [])
    } catch (error) {
      console.error('Error fetching subcategories:', error)
      showToast('Alt kategoriler yüklenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchMaterialItems = async (subcategoryId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('material_items')
        .select('*')
        .eq('subcategory_id', subcategoryId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setMaterialItems(data || [])
    } catch (error) {
      console.error('Error fetching material items:', error)
      showToast('Malzemeler yüklenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchSupplierMaterials = async () => {
    if (!supplier) return
    
    try {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select(`
          *,
          material_categories!supplier_materials_material_category_id_fkey(name),
          material_subcategories!supplier_materials_material_subcategory_id_fkey(name),
          material_items!supplier_materials_material_item_id_fkey(name)
        `)
        .eq('supplier_id', supplier.id)

      if (error) throw error
      
      const processedMaterials = (data || []).map(material => ({
        ...material,
        category_name: material.material_categories?.name,
        subcategory_name: material.material_subcategories?.name,
        item_name: material.material_items?.name
      }))

      setSupplierMaterials(processedMaterials)
    } catch (error) {
      console.error('Error fetching supplier materials:', error)
    }
  }

  const handleCategorySelect = (category: MaterialCategory) => {
    setSelectedCategory(category)
    setSelectedSubcategory(null)
    setSelectedItems([])
    fetchSubcategories(category.id)
    setCurrentStep('subcategory')
  }

  const handleSubcategorySelect = (subcategory: MaterialSubcategory) => {
    setSelectedSubcategory(subcategory)
    setSelectedItems([])
    fetchMaterialItems(subcategory.id)
    setCurrentStep('items')
  }

  const handleItemToggle = (item: MaterialItem, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, item])
    } else {
      setSelectedItems(prev => prev.filter(i => i.id !== item.id))
    }
  }

  const saveSelectedMaterials = async () => {
    if (!supplier || !selectedCategory || !selectedSubcategory || selectedItems.length === 0) {
      showToast('Lütfen tüm seçimleri yapın', 'error')
      return
    }

    try {
      setLoading(true)
      
      // Her seçili malzeme için kayıt oluştur
      const materialRecords = selectedItems.map(item => ({
        supplier_id: supplier.id,
        material_category_id: selectedCategory.id,
        material_subcategory_id: selectedSubcategory.id,
        material_item_id: item.id,
        delivery_time_days: 7,
        is_preferred: false
      }))

      const { error } = await supabase
        .from('supplier_materials')
        .insert(materialRecords)

      if (error) throw error

      showToast(`${selectedItems.length} malzeme başarıyla eklendi!`, 'success')
      fetchSupplierMaterials()
      setCurrentStep('details')
      
    } catch (error) {
      console.error('Error saving materials:', error)
      showToast('Malzemeler kaydedilirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    switch (currentStep) {
      case 'subcategory':
        setCurrentStep('category')
        setSelectedCategory(null)
        break
      case 'items':
        setCurrentStep('subcategory')
        setSelectedSubcategory(null)
        setSelectedItems([])
        break
      case 'details':
        setCurrentStep('category')
        resetState()
        break
    }
  }

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredSubcategories = subcategories.filter(sub => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredItems = materialItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStepTitle = () => {
    switch (currentStep) {
      case 'category':
        return 'Kategori Seçin'
      case 'subcategory':
        return `${selectedCategory?.name} > Alt Kategori Seçin`
      case 'items':
        return `${selectedCategory?.name} > ${selectedSubcategory?.name} > Malzeme Seçin`
      case 'details':
        return 'Seçili Malzemeler'
      default:
        return 'Malzeme Yönetimi'
    }
  }

  if (!supplier) return null

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-1/2 bg-white shadow-2xl z-50 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        flex flex-col
      `}>
        {/* Header */}
        <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{supplier.name}</h2>
                <p className="text-sm text-gray-600">Malzeme Yönetimi</p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Step Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{getStepTitle()}</h3>
              {currentStep !== 'category' && (
                <Button 
                  variant="ghost" 
                  onClick={handleBack}
                  className="text-sm text-blue-600 hover:text-blue-700 p-0 h-auto"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Geri
                </Button>
              )}
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${currentStep === 'category' ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${currentStep === 'subcategory' ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${currentStep === 'items' ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${currentStep === 'details' ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
          </div>
        </div>

        {/* Search */}
        {currentStep !== 'details' && (
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Category Selection */}
              {currentStep === 'category' && (
                <div className="space-y-3">
                  {filteredCategories.map((category) => (
                    <Card 
                      key={category.id}
                      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300"
                      onClick={() => handleCategorySelect(category)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{category.name}</h3>
                            {category.description && (
                              <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Subcategory Selection */}
              {currentStep === 'subcategory' && (
                <div className="space-y-3">
                  {filteredSubcategories.map((subcategory) => (
                    <Card 
                      key={subcategory.id}
                      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300"
                      onClick={() => handleSubcategorySelect(subcategory)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{subcategory.name}</h3>
                            {subcategory.description && (
                              <p className="text-sm text-gray-600 mt-1">{subcategory.description}</p>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Material Items Selection */}
              {currentStep === 'items' && (
                <div className="space-y-3">
                  {selectedItems.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-800 font-medium">
                          {selectedItems.length} malzeme seçildi
                        </span>
                        <Button 
                          onClick={saveSelectedMaterials}
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={loading}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  )}

                  {filteredItems.map((item) => {
                    const isSelected = selectedItems.some(selected => selected.id === item.id)
                    const alreadyExists = supplierMaterials.some(sm => sm.material_item_id === item.id)
                    
                    return (
                      <Card 
                        key={item.id}
                        className={`cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : alreadyExists
                            ? 'border-green-200 bg-green-50'
                            : 'hover:border-gray-300'
                        }`}
                        onClick={() => !alreadyExists && handleItemToggle(item, !isSelected)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={isSelected || alreadyExists}
                                disabled={alreadyExists}
                                onChange={() => {}}
                              />
                              <div>
                                <h3 className={`font-semibold ${alreadyExists ? 'text-green-700' : 'text-gray-900'}`}>
                                  {item.name}
                                </h3>
                                {item.description && (
                                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                )}
                                {item.unit && (
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    {item.unit}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {alreadyExists && (
                              <Check className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {/* Details/Summary */}
              {currentStep === 'details' && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800">Malzemeler Başarıyla Eklendi!</span>
                    </div>
                    <p className="text-green-700 text-sm">
                      Seçili malzemeler tedarikçi profiline kaydedildi. 
                      Artık talep oluştururken bu tedarikçi bu malzemeler için öneri olarak görünecek.
                    </p>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Tedarikçi Malzemeleri
                        <Badge variant="secondary">{supplierMaterials.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {supplierMaterials.map((material) => (
                          <div 
                            key={material.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <div className="font-medium text-gray-900">
                                {material.item_name || material.subcategory_name || material.category_name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {material.category_name}
                                {material.subcategory_name && ` > ${material.subcategory_name}`}
                              </div>
                            </div>
                            {material.is_preferred && (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                <Star className="w-3 h-3 mr-1" />
                                Tercih Edilen
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep('category')}
                      className="flex-1"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Daha Fazla Ekle
                    </Button>
                    <Button 
                      onClick={onClose}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      Tamamla
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
