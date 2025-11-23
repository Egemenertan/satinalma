'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Download, Loader2, CheckCircle2, Package, Building2, Calendar } from 'lucide-react'
import { generateRequestSubmittedPDF } from '@/lib/pdf'
import { createClient } from '@/lib/supabase/client'

interface RequestPDFExportModalProps {
  isOpen: boolean
  onClose: () => void
  request: any
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export default function RequestPDFExportModal({
  isOpen,
  onClose,
  request,
  showToast
}: RequestPDFExportModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const supabase = createClient()

  // Get current user info
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single()
          
          setCurrentUser(profile)
        }
      } catch (error) {
        console.error('Current user fetch error:', error)
      }
    }

    if (isOpen) {
      fetchCurrentUser()
    }
  }, [isOpen])

  const handleExportPDF = async () => {
    try {
      setIsGenerating(true)
      
      console.log('📄 PDF Export başlatılıyor:', {
        requestId: request.id,
        title: request.title,
        materialsCount: request.purchase_request_items?.length || 0,
        generatedBy: currentUser
      })

      // PDF oluştur - current user bilgisini gönder
      await generateRequestSubmittedPDF(request, currentUser)
      
      showToast('PDF başarıyla oluşturuldu!', 'success')
      
      // Kısa bir gecikme sonra modalı kapat
      setTimeout(() => {
        onClose()
      }, 500)
      
    } catch (error) {
      console.error('PDF oluşturma hatası:', error)
      showToast('PDF oluşturulurken bir hata oluştu', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const materialsCount = request?.purchase_request_items?.length || 0
  const siteName = request?.sites?.name || request?.site_name || 'Belirtilmemiş'
  const createdDate = request?.created_at 
    ? new Date(request.created_at).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '-'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-gray-900" />
            </div>
            <div>
              <div className="text-gray-900">Talep Teslim PDF'i</div>
              <div className="text-sm font-normal text-gray-500 mt-1">
                Talep belgesi oluşturulacak
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Request Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-gray-900" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-500 mb-1">Talep Başlığı</div>
                <div className="font-semibold text-gray-900 break-words">
                  {request?.title || 'Satın Alma Talebi'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Talep Edilen Yer</div>
                  <div className="text-sm font-medium text-gray-900">{siteName}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Tarih</div>
                  <div className="text-sm font-medium text-gray-900">{createdDate}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
              <Package className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-500">Malzeme Sayısı</div>
                <div className="text-sm font-medium text-gray-900">{materialsCount} adet</div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <div className="font-medium mb-1">PDF İçeriği</div>
                <ul className="space-y-1 text-blue-800">
                  <li>• Talep bilgileri ve detayları</li>
                  <li>• Tüm malzeme listesi ({materialsCount} adet)</li>
                  <li>• Teknik özellikler ve notlar</li>
                  <li>• Kullanım amaçları</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1"
          >
            İptal
          </Button>
          <Button
            type="button"
            onClick={handleExportPDF}
            disabled={isGenerating}
            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                PDF Oluştur
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

