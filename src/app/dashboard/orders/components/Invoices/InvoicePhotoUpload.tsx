'use client'

import { X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface InvoicePhotoUploadProps {
  photos: string[]
  onPhotoAdd: (files: FileList) => void
  onPhotoRemove: (index: number) => void
  isUploading?: boolean
  label?: string
  inputId: string
  description?: string
}

export function InvoicePhotoUpload({
  photos,
  onPhotoAdd,
  onPhotoRemove,
  isUploading = false,
  label = "Fatura Fotoğrafları",
  inputId,
  description,
}: InvoicePhotoUploadProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {description && (
          <span className="text-xs text-gray-500 ml-2">
            {description}
          </span>
        )}
      </Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={isUploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Dosya Seç
        </Button>
      </div>
      
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onPhotoAdd(e.target.files)
            e.target.value = '' // Reset input
          }
        }}
      />

      {/* Yüklenen Fotoğrafları Göster */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <Label>Yüklenen Fotoğraflar ({photos.length})</Label>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                <img
                  src={photo}
                  alt={`Fatura ${index + 1}`}
                  className="w-full h-20 object-cover rounded border"
                />
                <button
                  onClick={() => onPhotoRemove(index)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}






