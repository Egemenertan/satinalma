'use client'

/**
 * DocumentScanner Component - Apple Notes Style Document Scanning
 * 
 * Özellikler:
 * - Mobil cihazlarda kamera ile belge tarama
 * - Otomatik perspektif düzeltme
 * - Kontrast ve parlaklık iyileştirme
 * - Gürültü azaltma
 * - Silik yazıları netleştirme
 * - PDF formatında kaydetme
 * - Çoklu sayfa desteği
 */

import React, { useState, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, X, Check, RotateCw, ZoomIn, Download, FileText, Scan, Loader2 } from 'lucide-react'
import { processDocumentImage } from '@/lib/utils/documentProcessing'

interface DocumentScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanComplete: (files: File[]) => void
  maxPages?: number
  title?: string
  description?: string
}

interface ScannedPage {
  id: string
  originalImage: string
  processedImage: string
  blob: Blob
  timestamp: number
}

export default function DocumentScanner({
  isOpen,
  onClose,
  onScanComplete,
  maxPages = 10,
  title = 'Belge Tara',
  description = 'Belgeyi kamera ile tarayın, otomatik olarak iyileştirilecektir'
}: DocumentScannerProps) {
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [processingQuality, setProcessingQuality] = useState<'auto' | 'color' | 'grayscale' | 'bw'>('auto')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Kamerayı başlat
  const startCamera = useCallback(async () => {
    try {
      // Önce izin kontrolü yap
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tarayıcınız kamera erişimini desteklemiyor.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Arka kamera tercih et
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play() // Video'yu başlat
        streamRef.current = stream
        setIsCameraActive(true)
      }
    } catch (error: any) {
      console.error('Kamera başlatılamadı:', error)
      
      // Hata mesajını daha açıklayıcı yap
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kamera iznini verin.')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('Kamera bulunamadı. Cihazınızda kamera olduğundan emin olun.')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        alert('Kamera kullanımda. Lütfen diğer uygulamaları kapatın ve tekrar deneyin.')
      } else {
        alert(`Kamera başlatılamadı: ${error.message || 'Bilinmeyen hata'}`)
      }
    }
  }, [])

  // Kamerayı durdur
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }, [])

  // Fotoğraf çek ve işle
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Canvas boyutlarını ayarla
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Video frame'ini canvas'a çiz
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    setIsProcessing(true)
    
    try {
      // Canvas'tan blob al
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Blob oluşturulamadı'))
        }, 'image/jpeg', 0.95)
      })

      // Görüntüyü işle
      const processedBlob = await processDocumentImage(blob, processingQuality)
      
      // Yeni sayfa ekle
      const pageId = `page-${Date.now()}`
      const originalUrl = URL.createObjectURL(blob)
      const processedUrl = URL.createObjectURL(processedBlob)
      
      setScannedPages(prev => [...prev, {
        id: pageId,
        originalImage: originalUrl,
        processedImage: processedUrl,
        blob: processedBlob,
        timestamp: Date.now()
      }])
      
      // Kamerayı durdur
      stopCamera()
      
    } catch (error) {
      console.error('Görüntü işleme hatası:', error)
      alert('Görüntü işlenirken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setIsProcessing(false)
    }
  }, [processingQuality, stopCamera])

  // Dosyadan yükle ve işle
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)

    try {
      for (let i = 0; i < Math.min(files.length, maxPages - scannedPages.length); i++) {
        const file = files[i]
        
        // Sadece resim dosyalarını kabul et
        if (!file.type.startsWith('image/')) continue

        const blob = new Blob([file], { type: file.type })
        
        // Görüntüyü işle
        const processedBlob = await processDocumentImage(blob, processingQuality)
        
        const pageId = `page-${Date.now()}-${i}`
        const originalUrl = URL.createObjectURL(blob)
        const processedUrl = URL.createObjectURL(processedBlob)
        
        setScannedPages(prev => [...prev, {
          id: pageId,
          originalImage: originalUrl,
          processedImage: processedUrl,
          blob: processedBlob,
          timestamp: Date.now()
        }])
      }
    } catch (error) {
      console.error('Dosya işleme hatası:', error)
      alert('Dosyalar işlenirken bir hata oluştu.')
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [maxPages, processingQuality, scannedPages.length])

  // Sayfayı sil
  const deletePage = useCallback((pageId: string) => {
    setScannedPages(prev => {
      const page = prev.find(p => p.id === pageId)
      if (page) {
        URL.revokeObjectURL(page.originalImage)
        URL.revokeObjectURL(page.processedImage)
      }
      return prev.filter(p => p.id !== pageId)
    })
  }, [])

  // Sayfayı yeniden işle
  const reprocessPage = useCallback(async (pageId: string) => {
    const page = scannedPages.find(p => p.id === pageId)
    if (!page) return

    setIsProcessing(true)
    
    try {
      // Orijinal görüntüden blob al
      const response = await fetch(page.originalImage)
      const originalBlob = await response.blob()
      
      // Yeniden işle
      const processedBlob = await processDocumentImage(originalBlob, processingQuality)
      const processedUrl = URL.createObjectURL(processedBlob)
      
      // Eski processed URL'i temizle
      URL.revokeObjectURL(page.processedImage)
      
      // Güncelle
      setScannedPages(prev => prev.map(p => 
        p.id === pageId 
          ? { ...p, processedImage: processedUrl, blob: processedBlob }
          : p
      ))
    } catch (error) {
      console.error('Yeniden işleme hatası:', error)
      alert('Sayfa yeniden işlenirken bir hata oluştu.')
    } finally {
      setIsProcessing(false)
    }
  }, [scannedPages, processingQuality])

  // Taramayı tamamla
  const handleComplete = useCallback(async () => {
    if (scannedPages.length === 0) return

    setIsProcessing(true)

    try {
      // Tüm sayfaları image dosyaları olarak dönüştür
      const files = scannedPages.map((page, index) => {
        return new File(
          [page.blob],
          `scanned-document-${Date.now()}-${index + 1}.jpg`,
          { type: 'image/jpeg' }
        )
      })
      
      onScanComplete(files)
      
      // Temizlik
      scannedPages.forEach(page => {
        URL.revokeObjectURL(page.originalImage)
        URL.revokeObjectURL(page.processedImage)
      })
      
      setScannedPages([])
      onClose()
      
    } catch (error) {
      console.error('Belge oluşturma hatası:', error)
      alert('Belge oluşturulurken bir hata oluştu.')
    } finally {
      setIsProcessing(false)
    }
  }, [scannedPages, onScanComplete, onClose])

  // Modal kapanırken temizlik
  const handleClose = useCallback(() => {
    stopCamera()
    scannedPages.forEach(page => {
      URL.revokeObjectURL(page.originalImage)
      URL.revokeObjectURL(page.processedImage)
    })
    setScannedPages([])
    setSelectedPageId(null)
    onClose()
  }, [scannedPages, stopCamera, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Scan className="w-6 h-6" />
                {title}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="rounded-full w-8 h-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Kalite Seçimi */}
          <div className="flex items-center gap-2 justify-center">
            <span className="text-sm text-gray-600">Tarama Modu:</span>
            <div className="flex gap-2">
              {[
                { value: 'auto', label: 'Otomatik' },
                { value: 'color', label: 'Renkli' },
                { value: 'grayscale', label: 'Gri Ton' },
                { value: 'bw', label: 'Siyah-Beyaz' }
              ].map(mode => (
                <Button
                  key={mode.value}
                  variant={processingQuality === mode.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProcessingQuality(mode.value as any)}
                  className="text-xs"
                >
                  {mode.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Kamera Görünümü */}
          {isCameraActive && (
            <div className="relative bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Kamera Kontrolleri */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    onClick={stopCamera}
                    className="bg-white/90 hover:bg-white"
                  >
                    İptal
                  </Button>
                  <Button
                    onClick={capturePhoto}
                    disabled={isProcessing}
                    className="bg-white text-black hover:bg-gray-100 w-16 h-16 rounded-full"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tarama Butonları */}
          {!isCameraActive && scannedPages.length === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={startCamera}
                  disabled={isProcessing}
                  className="h-32 flex flex-col gap-3 bg-gradient-to-br from-gray-900 to-black hover:from-black hover:to-gray-900"
                >
                  <Camera className="w-12 h-12" />
                  <div>
                    <div className="font-semibold">Kamera ile Tara</div>
                    <div className="text-xs opacity-80">Belgeyi kamera ile tarayın</div>
                  </div>
                </Button>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  variant="outline"
                  className="h-32 flex flex-col gap-3 border-2 border-dashed"
                >
                  <FileText className="w-12 h-12" />
                  <div>
                    <div className="font-semibold">Galeriden Seç</div>
                    <div className="text-xs text-gray-500">Mevcut fotoğrafları yükleyin</div>
                  </div>
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Taranan Sayfalar */}
          {scannedPages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Taranan Sayfalar ({scannedPages.length}/{maxPages})
                </h3>
                {scannedPages.length < maxPages && !isCameraActive && (
                  <div className="flex gap-2">
                    <Button
                      onClick={startCamera}
                      disabled={isProcessing}
                      size="sm"
                      variant="outline"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Sayfa Ekle
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      size="sm"
                      variant="outline"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Galeriden
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {scannedPages.map((page, index) => (
                  <div key={page.id} className="relative group">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100">
                      <img
                        src={page.processedImage}
                        alt={`Sayfa ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Sayfa Numarası */}
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-full">
                      {index + 1}
                    </div>
                    
                    {/* Kontroller */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={() => reprocessPage(page.id)}
                        size="sm"
                        variant="secondary"
                        className="w-8 h-8 p-0 rounded-full bg-white/90 hover:bg-white"
                        title="Yeniden İşle"
                      >
                        <RotateCw className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => deletePage(page.id)}
                        size="sm"
                        variant="destructive"
                        className="w-8 h-8 p-0 rounded-full"
                        title="Sil"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 text-gray-600 py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>İşleniyor...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {scannedPages.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {scannedPages.length === 1 
                  ? '1 sayfa tarandı'
                  : `${scannedPages.length} sayfa tarandı`
                }
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isProcessing}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={isProcessing || scannedPages.length === 0}
                  className="bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      İşleniyor...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Taramayı Tamamla
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

