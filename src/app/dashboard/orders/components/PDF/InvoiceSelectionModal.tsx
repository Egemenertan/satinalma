'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Receipt, FileText } from 'lucide-react'

interface InvoiceSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  order: any
  selectedInvoiceIds: Set<string>
  onToggleInvoice: (invoiceId: string) => void
  onConfirm: () => void
}

export function InvoiceSelectionModal({
  isOpen,
  onClose,
  order,
  selectedInvoiceIds,
  onToggleInvoice,
  onConfirm,
}: InvoiceSelectionModalProps) {
  if (!order || !order.invoices) return null

  const allSelected = order.invoices.every((inv: any) => selectedInvoiceIds.has(inv.id))

  const handleToggleAll = () => {
    if (allSelected) {
      // Tümünü kaldır
      order.invoices.forEach((inv: any) => {
        if (selectedInvoiceIds.has(inv.id)) {
          onToggleInvoice(inv.id)
        }
      })
    } else {
      // Tümünü seç
      order.invoices.forEach((inv: any) => {
        if (!selectedInvoiceIds.has(inv.id)) {
          onToggleInvoice(inv.id)
        }
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-white border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
        {/* Header - Apple Style */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900 tracking-tight">
            PDF İçin Fatura Seçimi
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1 font-normal">
            {order.invoices.length} fatura bulundu
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Tümünü Seç - Minimal */}
          <button
            onClick={handleToggleAll}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                allSelected 
                  ? 'bg-black border-black' 
                  : 'border-gray-300 bg-white'
              }`}>
                {allSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">
                Tüm Faturaları Seç
              </span>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-white px-2.5 py-1 rounded-full">
              {selectedInvoiceIds.size}/{order.invoices.length}
            </span>
          </button>

          {/* Fatura Listesi - Clean & Minimal */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
            {order.invoices.map((invoice: any, index: number) => {
              const isSelected = selectedInvoiceIds.has(invoice.id)
              
              return (
                <button
                  key={invoice.id}
                  onClick={() => onToggleInvoice(invoice.id)}
                  className="w-full flex items-start gap-3 p-4 rounded-xl transition-all duration-200 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300"
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    isSelected 
                      ? 'bg-black border-black' 
                      : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Receipt className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">
                        Fatura {index + 1}
                      </span>
                      {invoice.invoice_group_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                          Toplu
                        </span>
                      )}
                    </div>
                    
                    <div className="text-lg font-bold mb-1 text-gray-900">
                      {(invoice.grand_total || invoice.amount)?.toLocaleString('tr-TR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })} {invoice.currency}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">
                        {new Date(invoice.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      {invoice.invoice_photos && invoice.invoice_photos.length > 0 && (
                        <span className="flex items-center gap-1 text-gray-500">
                          📷 {invoice.invoice_photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Toplam - Minimal */}
          {selectedInvoiceIds.size > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Genel Toplam</span>
                <span className="text-xl font-bold text-gray-900">
                  {order.invoices
                    .filter((inv: any) => selectedInvoiceIds.has(inv.id))
                    .reduce((sum: number, inv: any) => sum + (inv.grand_total || inv.amount || 0), 0)
                    .toLocaleString('tr-TR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} {order.invoices[0]?.currency || 'TRY'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Apple Style Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border-gray-300 hover:bg-gray-100 font-medium"
          >
            İptal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={selectedInvoiceIds.size === 0}
            className="flex-1 h-11 rounded-xl bg-black hover:bg-gray-900 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          >
            PDF Oluştur
          </Button>
        </div>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}

