'use client'

import { useRef } from 'react'
import { Camera, Receipt, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatNumberWithDots } from '@/app/dashboard/orders/utils/numberFormatting'

const CURRENCIES = ['TRY', 'USD', 'EUR'] as const
const MAX_INVOICE_PHOTOS = 8
const MAX_FILE_BYTES = 10 * 1024 * 1024

interface ExistingDeliveryInvoice {
  amount: number
  currency: string
  createdAt?: string | null
}

interface DeliveryInvoiceUploadProps {
  amount: string
  currency: string
  previewUrls: string[]
  disabled?: boolean
  existingInvoice?: ExistingDeliveryInvoice | null
  onAmountChange: (value: string) => void
  onCurrencyChange: (value: string) => void
  onFilesAdded: (files: File[]) => void
  onFileRemove: (index: number) => void
  onInvalid: (message: string) => void
}

export function DeliveryInvoiceUpload({
  amount,
  currency,
  previewUrls,
  disabled = false,
  existingInvoice = null,
  onAmountChange,
  onCurrencyChange,
  onFilesAdded,
  onFileRemove,
  onInvalid,
}: DeliveryInvoiceUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list)
    const room = MAX_INVOICE_PHOTOS - previewUrls.length
    if (room <= 0) {
      onInvalid(`En fazla ${MAX_INVOICE_PHOTOS} fatura fotoğrafı yükleyebilirsiniz`)
      return
    }

    const accepted: File[] = []
    for (const file of incoming) {
      if (accepted.length >= room) break
      if (!file.type.startsWith('image/')) {
        onInvalid('Fatura için sadece fotoğraf yükleyebilirsiniz')
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        onInvalid(`${file.name} çok büyük (en fazla 10MB)`)
        continue
      }
      accepted.push(file)
    }

    if (incoming.length > room) {
      onInvalid(`En fazla ${MAX_INVOICE_PHOTOS} fatura fotoğrafı yükleyebilirsiniz`)
    }
    if (accepted.length > 0) onFilesAdded(accepted)
  }

  const openCamera = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement
      if (target.files) acceptFiles(target.files)
    }
    input.click()
  }

  if (existingInvoice) {
    const createdLabel = existingInvoice.createdAt
      ? new Date(existingInvoice.createdAt).toLocaleDateString('tr-TR')
      : null
    const amountLabel = `${Number(existingInvoice.amount || 0).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${existingInvoice.currency || 'TRY'}`

    return (
      <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <Receipt className="h-4 w-4" />
            Fatura eklendi
          </div>
          {createdLabel && <span className="text-xs text-green-700">{createdLabel}</span>}
        </div>
        <p className="mt-2 text-sm text-green-900">{amountLabel}</p>
        <p className="mt-1 text-xs text-green-700">
          Bu siparişin faturası kayıtlı. Buradan yeniden fatura eklenemez.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div>
        <Label className="text-sm font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gray-700" />
          Fatura
          <span className="text-xs font-normal text-gray-500">(opsiyonel)</span>
        </Label>
        <p className="text-xs text-gray-500 mt-1">
          Yüklenen fatura, siparişler sayfasındaki fatura kaydına yazılır. Fatura eklerseniz irsaliye fotoğrafı zorunlu değildir.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div>
          <Label htmlFor="delivery-invoice-amount" className="text-xs text-gray-600">
            Tutar
          </Label>
          <Input
            id="delivery-invoice-amount"
            inputMode="decimal"
            value={amount}
            disabled={disabled}
            placeholder="0,00"
            onChange={(event) => onAmountChange(formatNumberWithDots(event.target.value))}
            className="mt-1 bg-white"
          />
        </div>
        <div>
          <Label htmlFor="delivery-invoice-currency" className="text-xs text-gray-600">
            Para birimi
          </Label>
          <select
            id="delivery-invoice-currency"
            value={currency}
            disabled={disabled}
            onChange={(event) => onCurrencyChange(event.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={openCamera}
          disabled={disabled || previewUrls.length >= MAX_INVOICE_PHOTOS}
          className="h-12 border-dashed bg-white"
        >
          <Camera className="w-4 h-4 mr-2" />
          Kamera
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || previewUrls.length >= MAX_INVOICE_PHOTOS}
          className="h-12 border-dashed bg-white"
        >
          <Upload className="w-4 h-4 mr-2" />
          Dosya Seç
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) acceptFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {previewUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previewUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-square">
              <img
                src={url}
                alt={`Fatura ${index + 1}`}
                className="w-full h-full object-cover rounded-2xl border border-gray-200"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onFileRemove(index)}
                className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 hover:bg-red-400 text-black rounded-full"
                title="Fatura fotoğrafını kaldır"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
