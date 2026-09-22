'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import {
  formatContractDate,
  formatContractMoney,
  formatContractQty,
  isContractCurrentlyActive,
  type ContractOverview,
} from '@/lib/contracts'
import { fetchContractOverviews } from '@/services/contracts.service'
import { FileText, Search } from 'lucide-react'

const fetcher = () => fetchContractOverviews()

export default function ContractsPage() {
  const { data, isLoading, error } = useSWR('supplier_contracts/overview', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'expired'>('all')

  const contracts = data || []

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return contracts.filter((contract) => {
      const active = isContractCurrentlyActive(contract)
      if (status === 'active' && !active) return false
      if (status === 'expired' && active) return false
      if (!q) return true
      const hay = [
        contract.supplier_name,
        contract.title,
        contract.contract_no,
        ...contract.items.map((item) => item.material_item),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')
      return hay.includes(q)
    })
  }, [contracts, search, status])

  const stats = useMemo(() => {
    const active = contracts.filter((c) => isContractCurrentlyActive(c))
    const remaining = active.reduce((sum, c) => sum + c.total_remaining, 0)
    const warning = active.filter((c) => c.is_nearly_used || c.is_expiring_soon).length
    const expired = contracts.filter((c) => c.is_expired).length
    return { active: active.length, remaining, warning, expired }
  }, [contracts])

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loading />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="inline-block border-b-2 border-[#00E676] pb-3 text-3xl font-semibold text-gray-900">
            Toplu Alım Sözleşmeleri
          </h1>
          <p className="mt-4 text-base text-gray-600">
            Tedarikçi sözleşmeleri, birim fiyatlar ve irsaliye ile düşen kalan miktarlar
          </p>
        </div>
        <Button asChild className="rounded-2xl bg-black text-white hover:bg-gray-900">
          <Link href="/dashboard/suppliers">Tedarikçiden ekle</Link>
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">Sözleşmeler yüklenirken bir hata oluştu.</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Aktif sözleşme" value={String(stats.active)} />
        <Kpi label="Toplam kalan" value={new Intl.NumberFormat('tr-TR').format(stats.remaining)} />
        <Kpi label="Bitmek üzere" value={String(stats.warning)} />
        <Kpi label="Süresi dolmuş" value={String(stats.expired)} />
      </div>

      <Card className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tedarikçi veya malzeme ara"
              className="h-12 rounded-xl pl-10"
            />
          </div>
          <div className="flex rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1">
            {([
              ['all', 'Tümü'],
              ['active', 'Aktif'],
              ['expired', 'Süresi dolmuş'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatus(id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  status === id ? 'bg-white text-elegant-black shadow-sm' : 'text-elegant-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-elegant-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Henüz sözleşme yok</h2>
          <p className="mt-2 text-sm text-gray-500">
            Tedarikçi detayından ilgili firmaya sözleşme ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((contract) => (
            <ContractOverviewCard key={contract.id} contract={contract} />
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-elegant-black">{value}</p>
    </div>
  )
}

function ContractOverviewCard({ contract }: { contract: ContractOverview }) {
  return (
    <Link href={`/dashboard/contracts/${contract.id}`}>
      <div className="h-full rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-elegant-black">{contract.supplier_name}</h3>
            <p className="text-sm text-elegant-gray-600">
              {contract.title || 'Toplu alım sözleşmesi'}
              {contract.contract_no ? ` · ${contract.contract_no}` : ''}
            </p>
          </div>
          {contract.is_expired ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Pasif</Badge>
          ) : (
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-emerald-700">Aktif</Badge>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {contract.items.map((item) => {
            const pct = Math.min(100, Math.round(item.usage_ratio * 100))
            return (
              <div key={item.id} className="rounded-lg bg-elegant-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-elegant-black">{item.material_item}</p>
                  <p className="text-sm text-elegant-gray-600">
                    {formatContractMoney(item.unit_price, item.currency)} / {item.unit}
                  </p>
                </div>
                <p className="mt-1 text-xs text-elegant-gray-500">
                  {formatContractQty(item.delivered_quantity, item.unit)} teslim · kalan {formatContractQty(item.remaining_quantity, item.unit)}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#01E884] shadow-[0_0_12px_rgba(1,232,132,0.35)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-elegant-gray-500">Bitiş: {formatContractDate(contract.end_date)}</p>
      </div>
    </Link>
  )
}
