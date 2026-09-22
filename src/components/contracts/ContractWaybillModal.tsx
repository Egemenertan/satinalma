'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { formatContractQty, type RequestContractBinding } from '@/lib/contracts'
import { confirmContractDelivery } from '@/services/contracts.service'
import { Camera, Upload, X } from 'lucide-react'

interface ContractWaybillModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  binding: RequestContractBinding | null
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function ContractWaybillModal({
  open,
  onOpenChange,
  binding,
  onSuccess,
  showToast,
}: ContractWaybillModalProps) {
  const supabase = createClient()
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const maxQty = binding
    ? Math.min(binding.remaining_for_request, binding.overview.remaining_quantity)
    : 0

  const reset = () => {
    setQuantity('')
    setNotes('')
    setPhotos([])
    setPreviews([])
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files)
    setPhotos((prev) => [...prev, ...next])
    setPreviews((prev) => [...prev, ...next.map((file) => URL.createObjectURL(file))])
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = []
    for (const file of photos) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `contract_deliveries/${binding?.contract_item_id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('satinalma').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('satinalma').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  const handleSubmit = async () => {
    if (!binding) return
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      showToast('Geçerli bir miktar girin', 'error')
      return
    }
    if (qty > maxQty) {
      showToast(`En fazla ${formatContractQty(maxQty, binding.overview.unit)} yükleyebilirsiniz`, 'error')
      return
    }
    if (photos.length === 0) {
      showToast('En az 1 irsaliye fotoğrafı yükleyin', 'error')
      return
    }

    setSaving(true)
    try {
      const urls = await uploadPhotos()
      const result = await confirmContractDelivery({
        contractItemId: binding.contract_item_id,
        purchaseRequestItemId: binding.request_item_id,
        deliveredQuantity: qty,
        waybillPhotos: urls,
        notes,
      })
      if (!result.success) {
        throw new Error(result.error)
      }
      showToast(
        `${formatContractQty(qty, binding.overview.unit)} irsaliye kaydedildi. Sözleşme kalanı: ${formatContractQty(result.remaining_quantity || 0, binding.overview.unit)}`,
        'success'
      )
      reset()
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'İrsaliye kaydedilemedi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md bg-white rounded-3xl">
        <DialogHeader>
          <DialogTitle>İrsaliye Yükle</DialogTitle>
        </DialogHeader>
        {binding && (
          <div className="space-y-4">
            <p className="text-sm text-elegant-gray-600">
              {binding.contract.supplier_name} · {binding.overview.material_item}
            </p>
            <p className="text-xs text-elegant-gray-500">
              Bu talep kalanı {formatContractQty(binding.remaining_for_request, binding.overview.unit)} ·
              sözleşme kalanı {formatContractQty(binding.overview.remaining_quantity, binding.overview.unit)}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teslim miktarı</label>
              <Input
                type="number"
                min="0"
                step="0.001"
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`En fazla ${maxQty}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Not (opsiyonel)</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">İrsaliye fotoğrafları</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.multiple = true
                    input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files)
                    input.click()
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Dosya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.capture = 'environment'
                    input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files)
                    input.click()
                  }}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Kamera
                </Button>
              </div>
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((src, index) => (
                    <div key={src} className="relative">
                      <img src={src} alt="" className="h-20 w-full rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full rounded-2xl bg-black text-white hover:bg-gray-900"
            >
              {saving ? 'Kaydediliyor...' : 'İrsaliyeyi Kaydet'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
