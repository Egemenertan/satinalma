'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/components/ui/toast'
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
  X
} from 'lucide-react'



const steps = [
  { id: 1, title: 'Şantiye Bilgileri', icon: Building2 },
  { id: 2, title: 'Malzeme Detayları', icon: Package },
  { id: 3, title: 'Kullanım & Zamanlama', icon: Target },
  { id: 4, title: 'Teknik Özellikler', icon: Settings },
  { id: 5, title: 'Onay & Gönderim', icon: CheckCircle2 }
]

export default function CreatePurchaseRequestPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const supabaseClient = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [sites, setSites] = useState([])
  const [userSite, setUserSite] = useState(null)
  const [siteImages, setSiteImages] = useState({})
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    construction_site: '',
    construction_site_id: '',
    material_name: '',
    unit: '',
    quantity: '',
    brand: '',
    purpose: '',
    required_date: '',
    specifications: ''
  })
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])

  // Cleanup URL objects when component unmounts
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  // Şantiyeleri ve kullanıcı bilgilerini çek
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Şantiyeleri çek
        const { data: sitesData, error: sitesError } = await supabaseClient
          .from('sites')
          .select('id, name')
          .order('name')

        if (sitesError) {
          console.error('Şantiyeler yüklenirken hata:', sitesError)
        } else {
          setSites(sitesData || [])
          
          // Şantiye resimlerini storage'dan çek
          if (sitesData && sitesData.length > 0) {
            const imageUrls = {}
            
            // Proje isimleri ve dosya adları eşleştirmesi
            const imageMapping = {
              'courtyard': 'courtyard.webp',
              'la casalia': 'lacasalia.webp',
              'la isla': 'laisla.webp',
              'natulux': 'natulux.webp',
              'querencia': 'querencia.webp',
              'four seasons life 3': 'fourseosonlife3.webp',
              'fourseasons': 'fourseosonlife3.webp'
            }
            
            for (const site of sitesData) {
              try {
                // Şantiye adını küçük harfe çevir ve eşleşme ara
                const siteName = site.name.toLowerCase()
                let imageFileName = null
                
                // Exact match veya partial match ara
                for (const [key, fileName] of Object.entries(imageMapping)) {
                  if (siteName.includes(key) || key.includes(siteName)) {
                    imageFileName = fileName
                    break
                  }
                }
                
                if (imageFileName) {
                  const { data: imageData } = supabaseClient.storage
                    .from('satinalma')
                    .getPublicUrl(imageFileName)
                  
                  if (imageData.publicUrl) {
                    imageUrls[site.name] = imageData.publicUrl
                  }
                }
              } catch (error) {
                console.error(`${site.name} için resim yüklenirken hata:`, error)
              }
            }
            setSiteImages(imageUrls)
          }
        }

        // Kullanıcının şantiye bilgisini çek
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (user) {
          const { data: profileData, error: profileError } = await supabaseClient
            .from('profiles')
            .select('construction_site_id')
            .eq('id', user.id)
            .single()

          if (profileError) {
            console.error('Kullanıcı profili yüklenirken hata:', profileError)
          } else if (profileData?.construction_site_id) {
            // Kullanıcının şantiye bilgisini ayrı sorgu ile çek
            const { data: siteData, error: siteError } = await supabaseClient
              .from('sites')
              .select('id, name')
              .eq('id', profileData.construction_site_id)
              .single()

            if (!siteError && siteData) {
              // Kullanıcının şantiyesi var, otomatik seç ve step 1'i atla
              setUserSite(siteData)
              setFormData(prev => ({
                ...prev,
                construction_site: siteData.name,
                construction_site_id: siteData.id
              }))
              setCurrentStep(2) // Step 1'i atla
            }
          }
        }
      } catch (error) {
        console.error('Veri yüklenirken hata:', error)
      }
    }

    fetchData()
  }, [supabaseClient])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files).slice(0, 3 - uploadedImages.length) // Max 3 resim
    const newPreviewUrls: string[] = []

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
      }
    })

    setUploadedImages(prev => [...prev, ...newFiles])
    setImagePreviewUrls(prev => [...prev, ...newPreviewUrls])
  }

  const removeImage = (index: number) => {
    // Clean up URL object
    URL.revokeObjectURL(imagePreviewUrls[index])
    
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const triggerCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Arka kamera
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

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.construction_site || userSite // Kullanıcının şantiyesi varsa geçerli
      case 2:
        return formData.material_name && formData.unit && formData.quantity
      case 3:
        return formData.purpose
      case 4:
        return true // Teknik özellikler opsiyonel
      case 5:
        return isFormValid()
      default:
        return false
    }
  }

  const isFormValid = () => {
    return (formData.construction_site || userSite) && 
           formData.material_name && 
           formData.unit && 
           formData.quantity && 
           formData.purpose
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isFormValid()) {
      showToast('Lütfen zorunlu alanları doldurun', 'error')
      return
    }

    setLoading(true)
    
    try {
      // Server action'ı kullan
      const { createPurchaseRequest } = await import('@/lib/actions')
      
      const result = await createPurchaseRequest({
        material: formData.material_name,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        description: formData.specifications || formData.purpose,
        purpose: formData.purpose,
        site_id: formData.construction_site_id || userSite?.id,
        site_name: formData.construction_site || userSite?.name,
        brand: formData.brand
      })

      if (!result.success) {
        showToast(`Hata: ${result.error}`, 'error')
        return
      }

      showToast('Talep başarıyla oluşturuldu!', 'success')
      
      // Requests sayfasına yönlendir
      router.push('/dashboard/requests')
      
    } catch (error) {
      console.error('Talep oluşturma hatası:', error)
      showToast('Talep oluşturulurken bir hata oluştu.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 backdrop-blur-lg ">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 lg:w-5 h-4 lg:h-5 text-black" />
                Şantiye Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 lg:space-y-4">
              {userSite ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <Label className="text-sm font-medium text-green-800 flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4" />
                    Kayıtlı Şantiyeniz
                  </Label>
                  <p className="text-lg font-semibold text-green-900">{userSite.name}</p>
                  <p className="text-sm text-green-700 mt-1">Bu talep otomatik olarak şantiyenize atanacaktır.</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sites.map((site) => {
                      const hasImage = siteImages[site.name]
                      return (
                        <button
                          key={site.id}
                          type="button"
                          onClick={() => {
                            handleInputChange('construction_site', site.name)
                            handleInputChange('construction_site_id', site.id)
                            // Otomatik olarak bir sonraki adıma geç
                            setTimeout(() => {
                              setCurrentStep(2)
                            }, 300)
                          }}
                          className={`
                            aspect-square p-4 rounded-2xl transition-all duration-200 text-sm font-medium relative overflow-hidden
                            ${formData.construction_site === site.name 
                              ? 'shadow-lg ring-4 ring-black/20' 
                              : 'hover:shadow-md'
                            }
                          `}
                          style={{
                            backgroundImage: hasImage ? `url(${siteImages[site.name]})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: hasImage ? 'transparent' : (formData.construction_site === site.name ? '#000000' : 'rgba(255, 255, 255, 0.6)')
                          }}
                        >
                          {/* Resim varsa overlay ekle */}
                          {hasImage && (
                            <div className={`absolute inset-0 transition-all duration-200 ${
                              formData.construction_site === site.name 
                                ? 'bg-black/40' 
                                : 'bg-black/20 hover:bg-black/30'
                            }`} />
                          )}
                          
                          {/* Alt kısım gradient karartma */}
                          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                          
                          {/* İsim alt kısımda */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                            <span className={`text-center leading-tight font-light block text-lg ${
                              hasImage ? 'text-white' : 
                              (formData.construction_site === site.name ? 'text-white' : 'text-gray-700')
                            }`}>
                              {site.name}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 backdrop-blur-lg ">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <Package className="w-4 lg:w-5 h-4 lg:h-5 text-green-600" />
                Malzeme Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    Malzeme Adı *
                  </Label>
                  <Input
                    value={formData.material_name}
                    onChange={(e) => handleInputChange('material_name', e.target.value)}
                    placeholder="Malzeme adını giriniz..."
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4" />
                    Marka
                  </Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="Marka/üretici..."
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
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
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="0"
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                    <Weight className="w-4 h-4" />
                    Birim *
                  </Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    placeholder="kg, m³, adet, m²..."
                    className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
                  />
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Malzeme Fotoğrafları (Opsiyonel)
                </Label>
                
                {/* Upload Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Camera Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerCameraCapture}
                    disabled={uploadedImages.length >= 3}
                    className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Kamera</span>
                  </Button>

                  {/* Gallery Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerGallerySelect}
                    disabled={uploadedImages.length >= 3}
                    className="h-12 bg-white/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Galeri</span>
                  </Button>
                </div>

                {/* Image Previews */}
                {imagePreviewUrls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Yüklenen Fotoğraflar:</p>
                    <div className="grid grid-cols-3 gap-3">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {uploadedImages.length}/3 fotoğraf yüklendi
                    </p>
                  </div>
                )}

                {/* Upload Instructions */}
                {uploadedImages.length === 0 && (
                  <div className="text-center py-4 px-4 bg-gray-50/50 rounded-xl">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Malzeme fotoğrafları ekleyerek talebinizi detaylandırabilirsiniz
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Maksimum 3 fotoğraf yükleyebilirsiniz
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 backdrop-blur-lg ">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <Target className="w-4 lg:w-5 h-4 lg:h-5 text-purple-600" />
                Kullanım ve Zamanlama
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 lg:space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4" />
                  Kullanım Amacı *
                </Label>
                <Input
                  value={formData.purpose}
                  onChange={(e) => handleInputChange('purpose', e.target.value)}
                  placeholder="Bu malzeme nerede ve nasıl kullanılacak?"
                                      className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  Ne Zaman Gerekli?
                </Label>
                <Input
                  type="date"
                  value={formData.required_date}
                  onChange={(e) => handleInputChange('required_date', e.target.value)}
                                      className="h-10 lg:h-12 rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 backdrop-blur-lg ">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <Settings className="w-4 lg:w-5 h-4 lg:h-5 text-orange-600" />
                Teknik Detaylar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Teknik Özellikler ve Açıklamalar
                </Label>
                                  <Textarea
                    value={formData.specifications}
                    onChange={(e) => handleInputChange('specifications', e.target.value)}
                    placeholder="Teknik özellikler, kalite standartları, özel notlar..."
                    className="min-h-[100px] lg:min-h-[120px] resize-none rounded-lg lg:rounded-xl border-gray-200 focus:border-black focus:ring-black/20 text-sm lg:text-base"
                  />
              </div>
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="rounded-xl lg:rounded-2xl bg-white/20 backdrop-blur-lg ">
            <CardHeader className="pb-3 lg:pb-4">
              <CardTitle className="text-base lg:text-lg font-medium text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 lg:w-5 h-4 lg:h-5 text-green-600" />
                Talep Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Şantiye</Label>
                  <p className="text-base lg:text-lg font-semibold text-gray-900">{userSite?.name || formData.construction_site}</p>
                </div>
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Malzeme</Label>
                  <p className="text-base lg:text-lg font-semibold text-gray-900">{formData.material_name}</p>
                </div>
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Miktar</Label>
                  <p className="text-base lg:text-lg font-semibold text-gray-900">{formData.quantity} {formData.unit}</p>
                </div>
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Kullanım Amacı</Label>
                  <p className="text-base lg:text-lg font-semibold text-gray-900">{formData.purpose}</p>
                </div>
              </div>
              {formData.brand && (
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Marka</Label>
                  <p className="text-base lg:text-lg font-semibold text-gray-900">{formData.brand}</p>
                </div>
              )}
              {formData.required_date && (
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Gerekli Tarih</Label>
                  <p className="text-base lg:text-lg font-semibold text-gray-900">{new Date(formData.required_date).toLocaleDateString('tr-TR')}</p>
                </div>
              )}
              {formData.specifications && (
                <div className="bg-white/30 backdrop-blur-lg  rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600">Teknik Özellikler</Label>
                  <p className="text-gray-900">{formData.specifications}</p>
                </div>
              )}

              {/* Uploaded Images Summary */}
              {uploadedImages.length > 0 && (
                <div className="bg-white/30 backdrop-blur-lg rounded-lg lg:rounded-xl p-3 lg:p-4">
                  <Label className="text-xs lg:text-sm font-medium text-gray-600 mb-3 block">Malzeme Fotoğrafları</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {uploadedImages.length} fotoğraf eklenmiş
                  </p>
                </div>
              )}
              
              {/* Gönder Butonu */}
              <div className="mt-6 lg:mt-8 pt-4 border-t border-white/30">
                <Button 
                  type="submit" 
                  disabled={loading || !isFormValid()}
                  className="w-full h-12 lg:h-14 px-6 lg:px-8 rounded-lg lg:rounded-xl font-medium bg-black hover:bg-gray-900 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-base lg:text-lg"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-3" />
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-3" />
                      Talebi Gönder
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-white">
    <div className="px-4 lg:px-6 pb-4 space-y-4 lg:space-y-8">
      {/* Header */}
      <div className="pt-4 lg:pt-0">
        <div>
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-gray-900">Yeni Satın Alma Talebi</h1>
            <p className="text-gray-600 mt-1 lg:mt-2 text-sm lg:text-lg font-light">Malzeme ve hizmet taleplerini oluşturun</p>
          </div>
          <div className="mt-3 lg:mt-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleBack}
              className="bg-white/20 backdrop-blur-lg hover:bg-white/30 rounded-lg lg:rounded-xl text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri Dön
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/20 backdrop-blur-lg rounded-xl lg:rounded-2xl p-3 lg:p-6">
        <div className="mb-3 lg:mb-4">
          <h3 className="text-base lg:text-lg font-semibold text-gray-900">Adım {currentStep} / {steps.length}</h3>
        </div>



        {/* Current Step Title */}
        <div className="text-center">
          <h4 className="text-lg lg:text-xl font-bold text-gray-900">{steps[currentStep - 1]?.title}</h4>
          <div className="lg:hidden text-sm text-gray-600 mt-1">
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
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-8">
            {/* Step Content */}
            <div className="min-h-[250px] lg:min-h-[400px]">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="bg-white/20 backdrop-blur-lg rounded-xl lg:rounded-2xl p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0">
                <div className="flex items-center gap-3 order-2 lg:order-1">
                  {currentStep > 1 && (
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      className="h-10 lg:h-12 px-4 lg:px-6 rounded-lg lg:rounded-xl font-medium bg-white/30 border-white/40 hover:bg-white/50 text-sm lg:text-base flex-1 lg:flex-none"
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
                      className="h-10 lg:h-12 px-6 lg:px-8 rounded-lg lg:rounded-xl font-medium bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base flex-1 lg:flex-none"
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
    </div>
  )
}
