'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { ContractPurchaseHistory } from '@/components/contracts/ContractPurchaseHistory'
import {
  ContractRelatedRequests,
  type ContractRequestRow,
} from '@/components/contracts/ContractRelatedRequests'
import { ContractSummaryCard } from '@/components/contracts/ContractSummaryCard'
import { contractUsageTone, formatContractDate, formatContractMoney, formatContractQty } from '@/lib/contracts'
import { contractCategoryLabel, contractPartyLabel } from '@/lib/contract-setup'
import {
  matchHistoryAmountFromRequests,
  matchHistoryUsageForItem,
  productNamesMatch,
} from '@/lib/supplier-purchase-history'
import {
  cancelSupplierContract,
  excludeContractRequests,
  fetchContractInclusions,
  fetchContractOverviewById,
  fetchLinkedRequests,
  includeContractRequests,
  updateContractDates,
} from '@/services/contracts.service'
import { fetchSupplierPurchaseHistory } from '@/services/supplier-purchase-history.service'
import { EditContractModal } from '@/components/contracts/EditContractModal'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft, CalendarRange, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const { showToast } = useToast()
  const [cancelling, setCancelling] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [savingDates, setSavingDates] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

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
  const { data: history, isLoading: historyLoading } = useSWR(
    contract?.supplier_id
      ? `supplier_purchase_history/${contract.supplier_id}/${(contract.site_ids || []).join(',')}`
      : null,
    () => fetchSupplierPurchaseHistory(contract!.supplier_id, contract!.site_ids || []),
    { revalidateOnFocus: false }
  )
  const { data: inclusionKeys, mutate: mutateInclusions } = useSWR(
    `supplier_contracts/${params.id}/inclusions`,
    () => fetchContractInclusions(params.id),
    { revalidateOnFocus: false }
  )

  const itemNames = useMemo(
    () => (contract?.items || []).map((item) => item.material_item).filter(Boolean),
    [contract?.items]
  )

  const includedSet = useMemo(() => new Set(inclusionKeys || []), [inclusionKeys])

  const allRequests = useMemo(() => {
    const official = (linked || []).map((row: any) => {
      const request = Array.isArray(row.purchase_request) ? row.purchase_request[0] : row.purchase_request
      const requestId = request?.id || row.id
      const itemName = row.item_name
      return {
        id: `${requestId}::${row.id}`,
        requestId,
        requestNumber: request?.request_number || 'Talep',
        status: request?.status || null,
        siteName: request?.site_name || null,
        createdAt: request?.created_at || null,
        itemName,
        quantity: Number(row.original_quantity ?? row.quantity) || 0,
        unit: row.unit || '',
        amount: 0,
        currency: 'TRY',
        matched: true,
        included: true,
      } satisfies ContractRequestRow
    })

    const siteIds = contract?.site_ids || []
    const historical = (history?.requests || [])
      .filter((row) => siteIds.length === 0 || (row.siteId != null && siteIds.includes(row.siteId)))
      .map((row) => {
        const matched = itemNames.some((name) => productNamesMatch(name, row.itemName))
        const included = matched || includedSet.has(row.id)
        return {
          ...row,
          matched,
          included,
        } satisfies ContractRequestRow
      })

    const merged = new Map<string, ContractRequestRow>()
    for (const row of historical) merged.set(row.id, row)
    for (const row of official) {
      const existing = merged.get(row.id)
      merged.set(row.id, existing ? { ...row, amount: existing.amount || row.amount, included: true, matched: true } : row)
    }

    return Array.from(merged.values()).sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return right - left
    })
  }, [linked, history?.requests, itemNames, includedSet, contract?.site_ids])

  const includedRequests = useMemo(() => allRequests.filter((row) => row.included), [allRequests])
  const otherRequests = useMemo(() => allRequests.filter((row) => !row.included), [allRequests])

  const matchedInvoice = useMemo(() => {
    if (!history) return { amount: 0, currency: contract?.budget_currency || 'TRY' }
    const matched = matchHistoryAmountFromRequests(
      itemNames,
      history.requests,
      includedRequests.filter((row) => !row.matched).map((row) => row.id)
    )
    return {
      amount: matched.amount,
      currency: matched.currency || history.currency,
    }
  }, [history, itemNames, includedRequests, contract?.budget_currency])

  const itemsWithUsage = useMemo(() => {
    if (!contract) return []
    return contract.items.map((item) => {
      const used = matchHistoryUsageForItem(item.material_item, history, item.delivered_quantity)
      const remaining = Math.max(0, item.contracted_quantity - used)
      return {
        ...item,
        delivered_quantity: used,
        remaining_quantity: remaining,
        usage_ratio: item.contracted_quantity > 0 ? used / item.contracted_quantity : 0,
      }
    })
  }, [contract, history])

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

  const coverageStart = history?.firstDate || contract.start_date
  const coverageEnd = history?.lastDate || contract.end_date
  const datesDiffer =
    Boolean(history?.firstDate || history?.lastDate) &&
    ((history?.firstDate || '') !== (contract.start_date || '') ||
      (history?.lastDate || '') !== (contract.end_date || ''))

  const handleInclude = async (rows: ContractRequestRow[]) => {
    const key = rows.length === 1 ? rows[0].id : rows[0]?.itemName || 'include'
    setBusyKey(key)
    try {
      await includeContractRequests(
        contract.id,
        rows.map((row) => ({ requestKey: row.id, itemName: row.itemName }))
      )
      showToast(rows.length > 1 ? 'Talepler sözleşmeye dahil edildi' : 'Talep sözleşmeye dahil edildi', 'success')
      await mutateInclusions()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Dahil edilemedi', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const handleExclude = async (rows: ContractRequestRow[]) => {
    const key = rows.length === 1 ? rows[0].id : rows[0]?.itemName || 'exclude'
    setBusyKey(key)
    try {
      await excludeContractRequests(contract.id, rows.map((row) => row.id))
      showToast('Talep sözleşmeden çıkarıldı', 'success')
      await mutateInclusions()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Çıkarılamadı', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const applyDates = async () => {
    if (!history?.firstDate && !history?.lastDate) return
    setSavingDates(true)
    try {
      await updateContractDates(contract.id, history.firstDate, history.lastDate)
      showToast('Sözleşme tarihleri fatura geçmişinden güncellendi', 'success')
      mutate()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Tarihler güncellenemedi', 'error')
    } finally {
      setSavingDates(false)
    }
  }

  const budget = contract.budget_amount
  const invoiced = matchedInvoice.amount
  const remaining = budget == null ? null : budget - invoiced
  const usage = budget && budget > 0 ? (invoiced / budget) * 100 : 0
  const overBudget = remaining != null && remaining < 0
  const usageTone = contractUsageTone(usage)

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-elegant-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-elegant-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Button asChild variant="ghost" className="-ml-2 rounded-xl">
            <Link href="/dashboard/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sözleşmeler
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-2xl border-elegant-gray-200"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
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
        </div>

        <div className="px-6 py-8 sm:px-10">
          <p className="text-[11px] font-bold text-elegant-gray-500">
            Toplu alım sözleşmesi
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-elegant-black md:text-5xl">
            {contract.title || contract.supplier_name}
          </h1>
          {contract.title && (
            <p className="mt-3 text-lg text-elegant-gray-700">{contract.supplier_name}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              contract.status === 'cancelled' ? 'İptal' : contract.is_expired ? 'Süresi doldu' : 'Aktif',
              contractPartyLabel(contract.party_kind),
              contractCategoryLabel(contract.contract_category),
              contract.contract_no,
              ...contract.site_labels,
            ]
              .filter(Boolean)
              .map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-elegant-gray-50 px-3 py-1.5 text-xs font-semibold text-elegant-gray-700"
                >
                  {chip}
                </span>
              ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <HeroStat
              label="Sözleşme bütçesi"
              value={budget == null ? 'Belirtilmedi' : formatContractMoney(budget, contract.budget_currency)}
            />
            <HeroStat
              label="Kesilen fatura"
              value={formatContractMoney(invoiced, matchedInvoice.currency || contract.budget_currency)}
            />
            <HeroStat
              label="Kalan"
              value={
                remaining == null
                  ? '—'
                  : formatContractMoney(Math.abs(remaining), contract.budget_currency)
              }
              hint={overBudget ? 'Aşıldı' : undefined}
              danger={overBudget}
            />
            <HeroStat
              label="Kapsanan dönem"
              value={`${formatContractDate(coverageStart)} – ${formatContractDate(coverageEnd)}`}
            />
            <HeroStat label="Sözleşme no" value={contract.contract_no || '—'} />
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-elegant-gray-600">Bütçe kullanımı</span>
              <span className={cn('font-semibold tabular-nums', usageTone.text)}>
                %{Math.round(usage)}
              </span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-elegant-gray-100">
              <div
                className={cn('h-full rounded-full transition-all duration-500', usageTone.bar)}
                style={{ width: `${Math.min(100, Math.max(0, usage))}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-elegant-gray-600">
              Yalnızca sözleşme kalemi ve dahil ettiğiniz taleplerin faturaları sayılır.
            </p>
          </div>

          {datesDiffer && (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-elegant-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-elegant-gray-600">
                <CalendarRange className="mt-0.5 h-4 w-4 shrink-0" />
                Fatura geçmişi {formatContractDate(history?.firstDate || null)} – {formatContractDate(history?.lastDate || null)}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-elegant-gray-200 bg-white"
                onClick={applyDates}
                disabled={savingDates}
              >
                {savingDates ? 'Uygulanıyor…' : 'Tarihleri sözleşmeye yaz'}
              </Button>
            </div>
          )}
        </div>
      </section>

      {itemsWithUsage.length > 0 && (
        <div className="space-y-4">
          {itemsWithUsage.map((item) => (
            <ContractSummaryCard key={item.id} contract={contract} item={item} usageFromHistory />
          ))}
        </div>
      )}

      {contract.pending_orders.length > 0 && (
        <section className="rounded-2xl border border-elegant-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-elegant-black">Bekleyen siparişler</h2>
          <ul className="mt-4 divide-y divide-elegant-gray-100">
            {contract.pending_orders.map((order) => (
              <li key={order.order_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-elegant-black">
                    {order.order_number} · {order.material_name}
                  </p>
                  <p className="text-xs text-elegant-gray-500">
                    Sipariş {formatContractQty(order.ordered_quantity, order.unit)}
                    {order.delivered_quantity > 0
                      ? ` · teslim ${formatContractQty(order.delivered_quantity, order.unit)}`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-elegant-gray-100 px-2.5 py-1 text-[11px] font-semibold text-elegant-gray-700">
                  Beklemede · {formatContractQty(order.pending_quantity, order.unit)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ContractRelatedRequests
        includedRequests={includedRequests}
        otherRequests={otherRequests}
        busyKey={busyKey}
        onInclude={handleInclude}
        onExclude={handleExclude}
      />

      <ContractPurchaseHistory
        contract={contract}
        history={history}
        isLoading={historyLoading}
      />

      <EditContractModal
        open={editOpen}
        onOpenChange={setEditOpen}
        contract={contract}
        onSaved={() => mutate()}
        showToast={showToast}
      />
    </div>
  )
}

function HeroStat({
  label,
  value,
  hint,
  danger,
}: {
  label: string
  value: string
  hint?: string
  danger?: boolean
}) {
  return (
    <div className="rounded-2xl bg-elegant-gray-50 px-4 py-4">
      <p className="text-[11px] font-bold text-elegant-gray-500">{label}</p>
      <p className={cn('mt-2 text-sm font-semibold leading-snug', danger ? 'text-red-600' : 'text-elegant-black')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs font-medium text-red-600">{hint}</p>}
    </div>
  )
}
