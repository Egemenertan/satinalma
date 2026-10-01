'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ContractDetailsForm } from '@/components/contracts/ContractDetailsForm'

interface ContractFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName?: string
  onCreated?: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function ContractFormModal({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  onCreated,
  showToast,
}: ContractFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border sm:border-elegant-gray-200 sm:shadow-2xl"
      >
        <div className="shrink-0 border-b border-elegant-gray-200 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">
                Toplu alım
              </p>
              <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-elegant-black">
                Sözleşme ekle
              </DialogTitle>
              {supplierName && (
                <p className="mt-1 text-sm text-elegant-gray-600">{supplierName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-elegant-gray-600 hover:bg-elegant-gray-50"
            >
              Kapat
            </button>
          </div>
        </div>
        {open && (
          <ContractDetailsForm
            supplierId={supplierId}
            supplierName={supplierName}
            partyKind="supplier"
            contractCategory={null}
            siteIds={[]}
            onCancel={() => onOpenChange(false)}
            onCreated={() => {
              onOpenChange(false)
              onCreated?.()
            }}
            showToast={showToast}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
