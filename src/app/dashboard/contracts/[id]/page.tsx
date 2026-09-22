'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { ContractSummaryCard } from '@/components/contracts/ContractSummaryCard'
import { formatContractDate, formatContractQty } from '@/lib/contracts'
import { cancelSupplierContract, fetchContractOverviewById, fetchLinkedRequests } from '@/services/contracts.service'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft } from 'lucide-react'

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const { showToast } = useToast()
  const [cancelling, setCancelling] = useState(false)

  const { data: contract, isLoading, mutate } = useSWR(
    `supplier_contracts/${params.id}`,
    () => fetchContractOverviewById(params.id),
    { revalidateOnFocus: false }
  )
  const { data: linked } = useSWR(
    `supplier_contracts/${params.id}/requests`,
    () => fetchLinkedRequests(params.id),
    { revalidateOnFocus: false }
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!contract) {
    return <p className="text-sm text-gray-600">Sözleşme bulunamadı.</p>
  }

  const handleCancel = async () => {
    if (!confirm('Bu sözleşmeyi iptal etmek istediğinize emin misiniz?')) return
    setCancelling(true)
    try {
      await cancelSupplierContract(contract.id)
      showToast('Sözleşme iptal edildi', 'success')
      mutate()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'İptal edilemedi', 'error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 -ml-2 rounded-xl">
            <Link href="/dashboard/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sözleşmeler
            </Link>
          </Button>
          <h1 className="inline-block border-b-2 border-[#00E676] pb-3 text-3xl font-semibold text-gray-900">
            {contract.supplier_name}
          </h1>
          <p className="mt-4 text-base text-gray-600">
            {contract.title || 'Toplu alım sözleşmesi'} · Bitiş {formatContractDate(contract.end_date)}
          </p>
        </div>
        {contract.status === 'active' && (
          <Button
            variant="outline"
            className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleCancel}
            disabled={cancelling}
          >
            Sözleşmeyi iptal et
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {contract.items.map((item) => (
          <ContractSummaryCard key={item.id} contract={contract} item={item} />
        ))}
      </div>

      <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-elegant-black">Bağlı talepler</h2>
        <p className="mt-1 text-sm text-elegant-gray-600">
          Miktar yalnızca irsaliye yüklendiğinde düşer. Sipariş oluşturulmaz.
        </p>
        <div className="mt-4 space-y-3">
          {(linked || []).length === 0 ? (
            <p className="text-sm text-elegant-gray-500">Henüz bağlı talep yok.</p>
          ) : (
            (linked || []).map((row: any) => {
              const request = Array.isArray(row.purchase_request) ? row.purchase_request[0] : row.purchase_request
              return (
                <Link
                  key={row.id}
                  href={request?.id ? `/dashboard/requests/${request.id}/offers` : '/dashboard/requests'}
                  className="block rounded-lg border border-elegant-gray-200 px-4 py-3 hover:bg-elegant-gray-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-elegant-black">{request?.request_number || 'Talep'}</p>
                      <p className="text-sm text-elegant-gray-600">
                        {row.item_name} · {formatContractQty(row.original_quantity ?? row.quantity, row.unit)}
                      </p>
                    </div>
                    <p className="text-xs text-elegant-gray-500">{request?.status}</p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
