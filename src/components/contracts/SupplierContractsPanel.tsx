'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ContractBudgetSummary } from '@/components/contracts/ContractBudgetSummary'
import { ContractFormModal } from '@/components/contracts/ContractFormModal'
import { ContractSummaryCard } from '@/components/contracts/ContractSummaryCard'
import { fetchContractOverviews } from '@/services/contracts.service'
import { Plus } from 'lucide-react'

interface SupplierContractsPanelProps {
  supplierId: string
  supplierName: string
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function SupplierContractsPanel({
  supplierId,
  supplierName,
  showToast,
}: SupplierContractsPanelProps) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, mutate } = useSWR(
    `supplier_contracts/supplier/${supplierId}`,
    () => fetchContractOverviews(supplierId),
    { revalidateOnFocus: false }
  )

  const contracts = data || []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-elegant-black">Toplu alım sözleşmeleri</h3>
          <p className="mt-1 text-sm text-elegant-gray-500">
            Sipariş beklemede görünür. Adet irsaliye ile düşer, fatura sözleşme bütçesine yazılır.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-black text-white hover:bg-gray-900"
        >
          <Plus className="mr-2 h-4 w-4" />
          Sözleşme ekle
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-elegant-gray-200 border-t-elegant-black" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl bg-elegant-gray-50 px-6 py-12 text-center">
          <p className="text-sm font-medium text-elegant-black">Henüz sözleşme yok</p>
          <p className="mt-1 text-sm text-elegant-gray-500">Bu tedarikçiye çerçeve sözleşme ekleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="space-y-3">
              <ContractBudgetSummary
                contract={contract}
                showToast={showToast}
                onBudgetSaved={() => mutate()}
              />
              {contract.items.map((item) => (
                <ContractSummaryCard key={item.id} contract={contract} item={item} />
              ))}
              <Link
                href={`/dashboard/contracts/${contract.id}`}
                className="inline-flex text-sm font-medium text-elegant-gray-600 transition hover:text-elegant-black"
              >
                Sözleşme detayı
              </Link>
            </div>
          ))}
        </div>
      )}

      <ContractFormModal
        open={open}
        onOpenChange={setOpen}
        supplierId={supplierId}
        supplierName={supplierName}
        showToast={showToast}
        onCreated={() => mutate()}
      />
    </div>
  )
}
