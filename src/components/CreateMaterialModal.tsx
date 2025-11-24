'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

interface MaterialClass {
  id: number
  name: string
  description: string
  icon: string
  color: string
}

interface MaterialGroup {
  id: number
  name: string
  description: string
  icon: string
  color: string
}

interface CreateMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialClass?: string
  initialGroup?: string
  onMaterialCreated?: (material: { class: string; group: string; item_name: string }) => void
}

export function CreateMaterialModal({
  open,
  onOpenChange,
  initialClass = '',
  initialGroup = '',
  onMaterialCreated
}: CreateMaterialModalProps) {
  const { showToast } = useToast()
  const supabase = createClient()
  
  const [materialClasses, setMaterialClasses] = useState<MaterialClass[]>([])
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
  const [isCreating, setIsCreating] = useState(false)
  
  const [formData, setFormData] = useState({
    class: initialClass,
    group: initialGroup,
    item_name: ''
  })

  // Malzeme sınıflarını yükle
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        // Genel Merkez Ofisi kullanıcısı kontrolü
        const { data: genelMerkezSite } = await supabase
          .from('sites')
          .select('id')
          .eq('name', 'Genel Merkez Ofisi')
          .single()

        const { data: { user } } = await supabase.auth.getUser()
        let isGenelMerkezUser = false

        if (user && genelMerkezSite) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('site_id')
            .eq('id', user.id)
            .single()

          if (profileData?.site_id && Array.isArray(profileData.site_id)) {
            isGenelMerkezUser = profileData.site_id.includes(genelMerkezSite.id)
          }
        }

        let classQuery = supabase
          .from('all_materials')
          .select('class')
          .not('class', 'is', null)
          .not('class', 'eq', '')
          .order('class')

        // Genel Merkez Ofisi kullanıcıları için tüm ofis kategorileri
        if (isGenelMerkezUser) {
          console.log('🔒 Genel Merkez Ofisi kullanıcısı - Tüm ofis kategorileri gösteriliyor')
          classQuery = classQuery.in('class', [
            'Kırtasiye Malzemeleri',
            'Reklam Ürünleri',
            'Ofis Ekipmanları',
            'Promosyon Ürünleri',
            'Mutfak Malzemeleri',
            'Hijyen ve Temizlik'
          ])
        }

        const { data: classesData, error } = await classQuery

        if (!error && classesData) {
          const classNames = classesData
            .map(item => item.class)
            .filter(cls => typeof cls === 'string' && cls.trim() !== '')
          
          const uniqueClasses = Array.from(new Set(classNames))
            .filter(Boolean)
            .sort()
            .map((className, index) => ({
              id: index + 1,
              name: className,
              description: `${className} kategorisindeki malzemeler`,
              icon: 'Package',
              color: '#6b7280'
            }))
          
          setMaterialClasses(uniqueClasses)
        }
      } catch (error) {
        console.error('Sınıflar yüklenirken hata:', error)
      }
    }

    if (open) {
      fetchClasses()
    }
  }, [open, supabase])

  // Sınıf değiştiğinde grupları yükle
  useEffect(() => {
    const fetchGroups = async () => {
      if (!formData.class) {
        setMaterialGroups([])
        return
      }

      try {
        const { data: groupsData, error } = await supabase
          .from('all_materials')
          .select('group')
          .eq('class', formData.class)
          .not('group', 'is', null)
          .not('group', 'eq', '')
          .order('group')

        if (!error && groupsData) {
          const groupNames = groupsData
            .map(item => item.group)
            .filter(grp => typeof grp === 'string' && grp.trim() !== '')
          
          const uniqueGroupNames = Array.from(new Set(groupNames))
            .filter(Boolean)
            .sort()
          
          const uniqueGroups = uniqueGroupNames.map((groupName, index) => ({
            id: index + 1,
            name: groupName,
            description: `${groupName} grubu malzemeler`,
            icon: 'Package',
            color: '#6b7280'
          }))
          
          setMaterialGroups(uniqueGroups)
        }
      } catch (error) {
        console.error('Gruplar yüklenirken hata:', error)
      }
    }

    fetchGroups()
  }, [formData.class, supabase])

  // Initial değerler değiştiğinde form'u güncelle
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      class: initialClass,
      group: initialGroup
    }))
  }, [initialClass, initialGroup])

  const handleCreate = async () => {
    if (!formData.class || !formData.group || !formData.item_name) {
      showToast('Lütfen tüm alanları doldurun', 'error')
      return
    }

    setIsCreating(true)

    try {
      // Malzemeyi all_materials tablosuna ekle
      const { error } = await supabase
        .from('all_materials')
        .insert({
          class: formData.class,
          group: formData.group,
          item_name: formData.item_name
        })

      if (error) throw error

      showToast('Malzeme başarıyla oluşturuldu', 'success')

      // Callback'i çağır
      if (onMaterialCreated) {
        onMaterialCreated(formData)
      }

      // Formu sıfırla ve kapat
      setFormData({
        class: initialClass,
        group: initialGroup,
        item_name: ''
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Malzeme oluşturulurken hata:', error)
      showToast('Malzeme oluşturulurken bir hata oluştu', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-white border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <DialogHeader className="space-y-3 pb-6 border-b border-gray-100">
           
            <DialogTitle className="text-2xl font-semibold text-gray-900">
              Yeni Malzeme Ekle
            </DialogTitle>
            <p className="text-sm text-gray-500 font-normal">
              Aradığınız malzemeyi sisteme ekleyin
            </p>
          </DialogHeader>
          
          {/* Form */}
          <div className="space-y-5 py-6">
            {/* Class Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">
                Malzeme Sınıfı
              </Label>
              <Select 
                value={formData.class} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, class: value, group: '' }))}
              >
                <SelectTrigger className="w-full h-12 bg-gray-50 border-0 rounded-xl hover:bg-gray-100 transition-all duration-200 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 text-sm">
                  <SelectValue placeholder="Sınıf seçin..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl">
                  {materialClasses.map((cls) => (
                    <SelectItem 
                      key={cls.id} 
                      value={cls.name}
                      className="hover:bg-gray-50 focus:bg-gray-50 rounded-lg transition-colors"
                    >
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">
                Malzeme Grubu
              </Label>
              <Select 
                value={formData.group} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, group: value }))}
                disabled={!formData.class}
              >
                <SelectTrigger className={`w-full h-12 bg-gray-50 border-0 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 text-sm ${
                  !formData.class 
                    ? 'opacity-40 cursor-not-allowed' 
                    : 'hover:bg-gray-100'
                }`}>
                  <SelectValue placeholder="Grup seçin..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl">
                  {materialGroups.length === 0 ? (
                    <SelectItem value="no-groups" disabled>
                      Grup bulunamadı
                    </SelectItem>
                  ) : (
                    materialGroups.map((group) => (
                      <SelectItem 
                        key={group.id} 
                        value={group.name}
                        className="hover:bg-gray-50 focus:bg-gray-50 rounded-lg transition-colors"
                      >
                        {group.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {!formData.class && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-gray-400" />
                  Önce bir sınıf seçin
                </p>
              )}
            </div>

            {/* Item Name Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">
                Malzeme Adı
              </Label>
              <Input
                value={formData.item_name}
                onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                className="w-full h-12 bg-gray-50 border-0 rounded-xl hover:bg-gray-100 transition-all duration-200 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="pt-6 border-t border-gray-100 gap-3 flex-row">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
              className="flex-1 h-12 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-200 font-medium"
            >
              İptal
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={isCreating || !formData.class || !formData.group || !formData.item_name}
              className="flex-1 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Oluşturuluyor
                </>
              ) : (
                'Oluştur'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}


