'use client'

import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ChevronRight,
  Camera,
  Upload,
  X,
  Plus,
  Minus
} from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { MaterialDetailModalProps, CartItem } from '../types'
import { createEmptyCartItem } from '../types'

const COMMON_UNITS = [
  'Adet',
  'Kg',
  'Gram',
  'Ton',
  'Litre',
  'M',
  'M²',
  'M³',
  'Cm',
  'Mm',
  'Paket',
  'Kutu',
  'Koli',
  'Çuval',
  'Top',
  'Rulo',
  'Palet',
  'Bağ',
  'Torba',
  'Bidon',
  'Varil',
  'Takım',
  'Set',
] as const

export function MaterialDetailModal({
  open,
  onOpenChange,
  item,
  materialClass,
  materialGroup,
  onAddToCart,
  editItem,
  onUpdateItem
}: MaterialDetailModalProps) {
  const isEditing = !!editItem
  const [showCalendar, setShowCalendar] = useState(false)
  const [showCustomUnit, setShowCustomUnit] = useState(false)
  const [customUnitValue, setCustomUnitValue] = useState('')
  
  const [formData, setFormData] = useState<Partial<CartItem>>({
    quantity: '',
    unit: '',
    delivery_date: '',
    purpose: '',
    brand: '',
    specifications: '',
    uploaded_images: [],
    image_preview_urls: []
  })

  useEffect(() => {
    if (editItem) {
      const isCustomUnit = editItem.unit && !COMMON_UNITS.includes(editItem.unit as typeof COMMON_UNITS[number])
      setShowCustomUnit(isCustomUnit)
      setCustomUnitValue(isCustomUnit ? editItem.unit : '')
      setFormData({
        quantity: editItem.quantity,
        unit: editItem.unit,
        delivery_date: editItem.delivery_date,
        purpose: editItem.purpose,
        brand: editItem.brand,
        specifications: editItem.specifications,
        uploaded_images: editItem.uploaded_images || [],
        image_preview_urls: editItem.image_preview_urls || []
      })
    } else {
      setShowCustomUnit(false)
      setCustomUnitValue('')
      setFormData({
        quantity: '1',
        unit: '',
        delivery_date: '',
        purpose: '',
        brand: '',
        specifications: '',
        uploaded_images: [],
        image_preview_urls: []
      })
    }
  }, [editItem, open])

  const handleUnitSelect = (value: string) => {
    if (value === 'other') {
      setShowCustomUnit(true)
      setFormData(prev => ({ ...prev, unit: '' }))
    } else {
      setShowCustomUnit(false)
      setCustomUnitValue('')
      setFormData(prev => ({ ...prev, unit: value }))
    }
  }

  const handleCustomUnitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[0-9]/g, '')
    setCustomUnitValue(value)
    setFormData(prev => ({ ...prev, unit: value }))
  }

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return

    const currentImages = formData.uploaded_images || []
    const newFiles = Array.from(files).slice(0, 3 - currentImages.length)
    const newPreviewUrls: string[] = []

    newFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        newPreviewUrls.push(previewUrl)
      }
    })

    setFormData(prev => ({
      ...prev,
      uploaded_images: [...currentImages, ...newFiles],
      image_preview_urls: [...(prev.image_preview_urls || []), ...newPreviewUrls]
    }))
  }

  const removeImage = (index: number) => {
    const imageUrls = formData.image_preview_urls || []
    if (imageUrls[index]) {
      URL.revokeObjectURL(imageUrls[index])
    }
    
    setFormData(prev => ({
      ...prev,
      uploaded_images: (prev.uploaded_images || []).filter((_, i) => i !== index),
      image_preview_urls: (prev.image_preview_urls || []).filter((_, i) => i !== index)
    }))
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

  const incrementQuantity = () => {
    const current = parseInt(formData.quantity || '0')
    setFormData(prev => ({ ...prev, quantity: String(current + 1) }))
  }

  const decrementQuantity = () => {
    const current = parseInt(formData.quantity || '0')
    if (current > 1) {
      setFormData(prev => ({ ...prev, quantity: String(current - 1) }))
    }
  }

  const isFormValid = () => {
    return formData.quantity && formData.unit && formData.delivery_date && formData.purpose
  }

  const handleSubmit = () => {
    if (!isFormValid() || !item) return

    if (isEditing && editItem && onUpdateItem) {
      const updatedItem: CartItem = {
        ...editItem,
        quantity: formData.quantity || '',
        unit: formData.unit || '',
        delivery_date: formData.delivery_date || '',
        purpose: formData.purpose || '',
        brand: formData.brand || '',
        specifications: formData.specifications || '',
        uploaded_images: formData.uploaded_images || [],
        image_preview_urls: formData.image_preview_urls || []
      }
      onUpdateItem(updatedItem)
    } else {
      const newCartItem = createEmptyCartItem(item, materialClass, materialGroup)
      const cartItem: CartItem = {
        ...newCartItem,
        quantity: formData.quantity || '',
        unit: formData.unit || '',
        delivery_date: formData.delivery_date || '',
        purpose: formData.purpose || '',
        brand: formData.brand || '',
        specifications: formData.specifications || '',
        uploaded_images: formData.uploaded_images || [],
        image_preview_urls: formData.image_preview_urls || []
      }
      onAddToCart(cartItem)
    }

    onOpenChange(false)
  }

  if (!item) return null

  return (
    <>
    {/* Takvim Modal */}
    <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
      <DialogContent className="max-w-sm bg-white p-0 gap-0 rounded-3xl border-0 shadow-2xl">
        <DialogHeader className="p-5 pb-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="text-blue-500 font-medium text-base"
            >
              Iptal
            </button>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Tarih Sec
            </DialogTitle>
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="text-blue-500 font-semibold text-base"
            >
              Tamam
            </button>
          </div>
        </DialogHeader>
        
        <div className="p-4">
          <CalendarComponent
            mode="single"
            selected={formData.delivery_date ? new Date(formData.delivery_date) : undefined}
            onSelect={(date) => {
              if (date) {
                setFormData(prev => ({ ...prev, delivery_date: format(date, 'yyyy-MM-dd') }))
                setShowCalendar(false)
              }
            }}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            locale={tr}
            className="w-full"
            classNames={{
              months: "w-full",
              month: "w-full space-y-4",
              caption: "flex justify-center pt-1 relative items-center mb-4",
              caption_label: "text-lg font-semibold text-gray-900",
              nav: "space-x-1 flex items-center",
              nav_button: "h-10 w-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-gray-500 rounded-md w-full font-medium text-sm py-2",
              row: "flex w-full mt-1",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 w-full aspect-square",
              day: "h-12 w-12 mx-auto p-0 font-medium rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center text-base",
              day_range_end: "day-range-end",
              day_selected: "!bg-gray-900 !text-white hover:!bg-gray-800 focus:!bg-gray-900 !font-semibold",
              day_today: "bg-blue-50 text-blue-600 font-semibold",
              day_outside: "text-gray-300 opacity-50",
              day_disabled: "text-gray-300 opacity-50 cursor-not-allowed",
              day_hidden: "invisible",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>

    {/* Ana Modal */}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white p-0 gap-0 rounded-3xl border-0 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                <span className="text-2xl font-light text-gray-400">
                  {item.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900 tracking-tight">
              {item.name}
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {materialClass} {materialGroup && `/ ${materialGroup}`}
            </p>
          </div>
        </DialogHeader>

        {/* Form Content */}
        <div className="px-6 pb-6 space-y-6">
          {/* Miktar Seçici - Apple Style */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
              Miktar <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={decrementQuantity}
                className="w-12 h-12 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Minus className="w-5 h-5 text-gray-600" />
              </button>
              
              <div className="flex-1 text-center">
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="text-center text-3xl font-light border-0 bg-transparent focus:ring-0 h-auto py-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              
              <button
                type="button"
                onClick={incrementQuantity}
                className="w-12 h-12 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Form Fields - Grouped */}
          <div className="bg-gray-50 rounded-2xl divide-y divide-gray-200/60">
            {/* Birim */}
            <div className="p-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Birim <span className="text-red-500">*</span>
              </Label>
              <Select
                value={showCustomUnit ? 'other' : (formData.unit || '')}
                onValueChange={handleUnitSelect}
              >
                <SelectTrigger className="border-0 bg-transparent p-0 h-auto text-base font-medium text-gray-900 focus:ring-0 shadow-none">
                  <SelectValue placeholder="Birim seçin..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {COMMON_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                  <SelectItem value="other" className="text-blue-600 font-medium">
                    Diğer (Özel birim girin)
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {showCustomUnit && (
                <div className="mt-3">
                  <Input
                    value={customUnitValue}
                    onChange={handleCustomUnitChange}
                    placeholder="Özel birim yazın (rakam girilemez)..."
                    className="border border-gray-200 rounded-xl px-3 py-2 text-base font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  {customUnitValue && /[0-9]/.test(customUnitValue) && (
                    <p className="text-xs text-red-500 mt-1">Birim alanına rakam girilemez</p>
                  )}
                </div>
              )}
            </div>

            {/* Teslimat Tarihi */}
            <div className="p-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Teslimat Tarihi <span className="text-red-500">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="w-full text-left flex items-center justify-between"
              >
                <span className={`text-base font-medium ${formData.delivery_date ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formData.delivery_date 
                    ? format(new Date(formData.delivery_date), 'd MMMM yyyy', { locale: tr })
                    : 'Tarih secin'
                  }
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Kullanım Amacı */}
            <div className="p-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Kullanim Amaci <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="Nerede kullanilacak?"
                className="border-0 bg-transparent p-0 h-auto text-base font-medium text-gray-900 placeholder:text-gray-400 focus:ring-0"
              />
            </div>
          </div>

          {/* Opsiyonel Alanlar */}
          <div className="bg-gray-50 rounded-2xl divide-y divide-gray-200/60">
            <div className="p-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Marka (opsiyonel)
              </Label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Tercih edilen marka"
                className="border-0 bg-transparent p-0 h-auto text-base font-medium text-gray-900 placeholder:text-gray-400 focus:ring-0"
              />
            </div>

            <div className="p-4">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                Notlar (opsiyonel)
              </Label>
              <Textarea
                value={formData.specifications}
                onChange={(e) => setFormData(prev => ({ ...prev, specifications: e.target.value }))}
                placeholder="Teknik detaylar, ozellikler..."
                className="border-0 bg-transparent p-0 min-h-[60px] text-base font-medium text-gray-900 placeholder:text-gray-400 focus:ring-0 resize-none"
              />
            </div>
          </div>

          {/* Fotoğraf Yükleme */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
              Fotograflar (opsiyonel)
            </Label>
            
            {(formData.image_preview_urls?.length || 0) > 0 ? (
              <div className="flex gap-2 mb-3">
                {(formData.image_preview_urls || []).map((url, index) => (
                  <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                    <img
                      src={url}
                      alt={`Fotograf ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {(formData.uploaded_images?.length || 0) < 3 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={triggerCameraCapture}
                  className="flex-1 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-sm font-medium">Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={triggerGallerySelect}
                  className="flex-1 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Galeri</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-0">
          <div className="w-full space-y-3">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className={`w-full h-14 rounded-2xl text-base font-semibold transition-all ${
                isFormValid() 
                  ? 'bg-gray-900 hover:bg-gray-800 text-white shadow-lg active:scale-[0.98]' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isEditing ? 'Guncelle' : 'Sepete Ekle'}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full h-12 rounded-2xl text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              Vazgec
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
