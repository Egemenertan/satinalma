'use client'

import { Package, Receipt, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineLoading } from '@/components/ui/loading'

interface MultiSelectActionsProps {
  selectedCount: number
  onClearSelection: () => void
  onOpenInvoiceModal: () => void
  onExportPDF: () => void
  isGeneratingReport: boolean
}

export function MultiSelectActions({
  selectedCount,
  onClearSelection,
  onOpenInvoiceModal,
  onExportPDF,
  isGeneratingReport,
}: MultiSelectActionsProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-black rounded-2xl shadow-2xl border border-gray-800 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <Package className="h-5 w-5 text-black" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedCount} sipariş seçildi
              </p>
              <p className="text-xs text-gray-300">
                Toplu işlemler yapabilirsiniz
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
            >
              İptal
            </Button>
            <Button
              onClick={onOpenInvoiceModal}
              className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-xl font-medium shadow-lg"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Fatura Ekle
            </Button>
            <Button
              onClick={onExportPDF}
              disabled={isGeneratingReport}
              className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-xl font-medium shadow-lg"
            >
              {isGeneratingReport ? (
                <>
                  <InlineLoading className="mr-2" />
                  Rapor Oluşturuluyor...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Rapor
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}









