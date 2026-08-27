'use client'

import { useCallback, useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface QuoteUploadItem {
  id: string
  file: File
  name: string
}

interface UploadDropzoneProps {
  items: QuoteUploadItem[]
  onItemsChange: (items: QuoteUploadItem[]) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

function createUploadItem(file: File): QuoteUploadItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    name: file.name,
  }
}

export function UploadDropzone({ items, onItemsChange, disabled }: UploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const incomingArray = Array.from(incoming)
      const pdfFiles = incomingArray.filter((f) => f.type === 'application/pdf')

      if (pdfFiles.length === 0) {
        setError('Lütfen sadece PDF dosyası seçin')
        return
      }

      const oversized = pdfFiles.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) {
        setError('Bazı dosyalar 20MB sınırını aşıyor')
        return
      }

      setError(null)
      onItemsChange([...items, ...pdfFiles.map(createUploadItem)])
    },
    [items, onItemsChange]
  )

  const updateName = (id: string, name: string) => {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, name } : item)))
  }

  const removeItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragActive(true)
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragActive(false)
          if (!disabled && e.dataTransfer.files) addFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
          isDragActive ? 'border-[#00c46a] bg-[#ecfdf5]' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            isDragActive ? 'bg-[#d1f5e8]' : 'bg-gray-100'
          )}
        >
          <Upload className={cn('w-6 h-6', isDragActive ? 'text-[#009f56]' : 'text-gray-500')} />
        </div>
        <p className="text-sm font-medium text-gray-700">Teklif PDF'lerini buraya sürükleyip bırakın</p>
        <p className="text-xs text-gray-400">veya bilgisayarınızdan seçin · birden fazla dosya yükleyebilirsiniz</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 transition-colors hover:border-gray-300"
            >
              <div className="flex items-center gap-2 sm:w-8 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-xs font-semibold text-gray-400 sm:hidden">Teklif {index + 1}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <label htmlFor={`qc-offer-name-${item.id}`} className="text-xs font-medium text-gray-500">
                  Tedarikçi / teklif adı
                </label>
                <Input
                  id={`qc-offer-name-${item.id}`}
                  value={item.name}
                  onChange={(e) => updateName(item.id, e.target.value)}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Örn. ABC Yapı Malzemeleri Teklifi"
                  className="h-9 w-full rounded-lg bg-white border-gray-200 placeholder:text-gray-300 focus-visible:border-gray-400 focus-visible:ring-gray-200"
                />
                <p className="text-[11px] text-gray-400 truncate">
                  {item.file.name} · {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(item.id)
                  }}
                  className="flex-shrink-0 self-end sm:self-center p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                  aria-label="Dosyayı kaldır"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
