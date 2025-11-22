'use client'

import { X, Upload, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface InvoicePhotoUploadProps {
  photos: string[]
  onPhotoAdd: (files: FileList) => void
  onPhotoRemove: (index: number) => void
  onPhotoClick?: (index: number) => void
  isUploading?: boolean
  label?: string
  inputId: string
  description?: string
}

export function InvoicePhotoUpload({
  photos,
  onPhotoAdd,
  onPhotoRemove,
  onPhotoClick,
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
              <div key={index} className="relative group">
                <img
                  src={photo}
                  alt={`Fatura ${index + 1}`}
                  className="w-full h-20 object-cover rounded border cursor-pointer hover:border-gray-400 transition-colors"
                  onClick={() => onPhotoClick?.(index)}
                />
                
                {/* Hover overlay - Büyütme ikonu */}
                {onPhotoClick && (
                  <div 
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded flex items-center justify-center cursor-pointer"
                    onClick={() => onPhotoClick(index)}
                  >
                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPhotoRemove(index)
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 z-10"
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









