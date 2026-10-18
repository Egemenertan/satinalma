'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { convertBrickQuantity, formatConvertedQty } from '@/lib/brick-quantity'
import { formatContractDate, formatContractMoney, formatContractQty } from '@/lib/contracts'

export type ContractRequestRow = {
  id: string
  requestId: string
  requestNumber: string
  status: string | null
  siteName: string | null
  createdAt: string | null
  itemName: string
  quantity: number
  unit: string
  amount: number
  currency: string
  matched: boolean
  included: boolean
}

export function ContractRelatedRequests({
  includedRequests,
  otherRequests,
  busyKey,
  onInclude,
  onExclude,
}: {
  includedRequests: ContractRequestRow[]
  otherRequests: ContractRequestRow[]
  busyKey: string | null
  onInclude: (rows: ContractRequestRow[]) => void
  onExclude: (rows: ContractRequestRow[]) => void
}) {
  const otherGroups = groupByItem(otherRequests)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-elegant-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-elegant-black">Bağlı talepler</h2>
        <p className="mt-1 text-sm text-elegant-gray-600">
          Sözleşme kalemine uyan talepler ve dahil ettiğiniz diğer talepler.
        </p>
        <div className="mt-5 space-y-3">
          {includedRequests.length === 0 ? (
            <p className="text-sm text-elegant-gray-500">Henüz sözleşmeye yansıyan talep yok.</p>
          ) : (
            includedRequests.map((row) => (
              <RequestRow
                key={row.id}
                row={row}
                action={
                  row.matched ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-elegant-gray-200"
                      disabled={busyKey === row.id}
                      onClick={() => onExclude([row])}
                    >
                      {busyKey === row.id ? 'Çıkarılıyor…' : 'Çıkar'}
                    </Button>
                  )
                }
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-elegant-gray-300 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-elegant-black">Diğer talepler</h2>
        <p className="mt-1 text-sm text-elegant-gray-600">
          Yalnızca bu şantiyeden istenen ve bu tedarikçiye verilen, sözleşme kalemine uymayan talepler. Dahil etmezseniz sözleşmeye yazılmaz.
        </p>
        <div className="mt-5 space-y-5">
          {otherGroups.length === 0 ? (
            <p className="text-sm text-elegant-gray-500">Ayrı gösterilecek başka talep yok.</p>
          ) : (
            otherGroups.map((group) => (
              <div key={group.itemName} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-elegant-black">{group.itemName}</p>
                    <p className="text-xs text-elegant-gray-500">{group.rows.length} talep</p>
                  </div>
                  <Button
                    type="button"
                    className="rounded-xl bg-bordeaux text-white hover:bg-bordeaux-700"
                    disabled={busyKey === group.itemName}
                    onClick={() => onInclude(group.rows)}
                  >
                    {busyKey === group.itemName ? 'Ekleniyor…' : 'Hepsini dahil et'}
                  </Button>
                </div>
                {group.rows.map((row) => (
                  <RequestRow
                    key={row.id}
                    row={row}
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-elegant-gray-200"
                        disabled={busyKey === row.id}
                        onClick={() => onInclude([row])}
                      >
                        {busyKey === row.id ? 'Ekleniyor…' : 'Dahil et'}
                      </Button>
                    }
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function groupByItem(rows: ContractRequestRow[]) {
  const groups = new Map<string, ContractRequestRow[]>()
  for (const row of rows) {
    const list = groups.get(row.itemName) || []
    list.push(row)
    groups.set(row.itemName, list)
  }
  return Array.from(groups.entries()).map(([itemName, groupRows]) => ({
    itemName,
    rows: groupRows,
  }))
}

function RequestRow({
  row,
  action,
}: {
  row: ContractRequestRow
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-elegant-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={row.requestId ? `/dashboard/requests/${row.requestId}/offers` : '/dashboard/requests'}
        className="min-w-0 flex-1"
      >
        <p className="font-semibold text-elegant-black">{row.requestNumber}</p>
        <p className="mt-0.5 text-sm text-elegant-gray-600">
          {row.itemName} · {formatConvertedQty(formatContractQty, convertBrickQuantity(row.itemName, row.quantity, row.unit))}
          {row.siteName ? ` · ${row.siteName}` : ''}
        </p>
        <p className="mt-1 text-xs text-elegant-gray-500">
          {row.createdAt ? formatContractDate(row.createdAt) : '—'}
          {row.status ? ` · ${row.status}` : ''}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        {row.amount > 0 && (
          <p className="text-sm font-semibold tabular-nums text-elegant-black">
            {formatContractMoney(row.amount, row.currency)}
          </p>
        )}
        {action}
      </div>
    </div>
  )
}
