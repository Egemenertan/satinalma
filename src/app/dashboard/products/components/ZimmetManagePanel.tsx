'use client'

import { useMemo, useState } from 'react'
import {
  User,
  Building2,
  Loader2,
  Undo2,
  ArrowRightLeft,
  Users,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type ActiveZimmetRow, groupZimmetsByOwner } from '@/services/zimmet.service'
import { ZimmetActionDialogs, type ZimmetActionTarget } from './ZimmetActionDialogs'

type ZimmetRow = ActiveZimmetRow & {
  user?: { full_name?: string; email?: string } | null
}

interface ZimmetManagePanelProps {
  productId: string
  productUnit?: string
  zimmets: ZimmetRow[]
  loading?: boolean
  onChanged?: () => void
  /** Kompakt: stok işlemleri formu içi */
  compact?: boolean
}

export function ZimmetManagePanel({
  productId,
  productUnit = 'adet',
  zimmets,
  loading = false,
  onChanged,
}: ZimmetManagePanelProps) {
  const [changeTarget, setChangeTarget] = useState<ZimmetActionTarget | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ZimmetActionTarget | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const displayName = (row: ZimmetRow) =>
    row.owner_name || row.user?.full_name || 'İsimsiz'
  const displayEmail = (row: ZimmetRow) =>
    row.owner_email || row.user?.email || ''

  const groupedZimmets = useMemo(() => groupZimmetsByOwner(zimmets), [zimmets])

  const filteredZimmets = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr')
    if (!q) return groupedZimmets
    return groupedZimmets.filter((row) => {
      const haystack = [
        displayName(row),
        displayEmail(row),
        row.source_warehouse?.name || '',
      ]
        .join(' ')
        .toLocaleLowerCase('tr')
      return haystack.includes(q)
    })
  }, [groupedZimmets, searchQuery])

  return (
    <>
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Mevcut zimmetler</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Sorumluluk kaydı · depo stoğu değişmez
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
            {searchQuery.trim()
              ? `${filteredZimmets.length}/${groupedZimmets.length} kişi`
              : `${groupedZimmets.length} kişi`}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Yükleniyor…
            </div>
          ) : zimmets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">Bu ürün için aktif zimmet yok.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                  placeholder="Kişi, e-posta veya depo ara..."
                  className="h-11 rounded-xl border-gray-200 bg-white pl-10 pr-10"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Aramayı temizle"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {filteredZimmets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                  <p className="text-sm text-gray-500">
                    “{searchQuery.trim()}” ile eşleşen zimmet yok.
                  </p>
                </div>
              ) : (
                filteredZimmets.map((row) => {
                  const busy = changeTarget?.id === row.id || removeTarget?.id === row.id
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                          <User className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {displayName(row)}
                          </p>
                          {displayEmail(row) && (
                            <p className="text-xs text-gray-500 truncate">{displayEmail(row)}</p>
                          )}
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 px-2 py-0.5">
                              <Building2 className="h-3 w-3 text-gray-500" />
                              {row.source_warehouse?.name || 'Depo'}
                            </span>
                            <span className="font-medium text-gray-800">
                              {Number(row.quantity).toLocaleString('tr-TR')} {productUnit}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setChangeTarget(row)}
                          className="h-9 rounded-xl border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Değiştir
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setRemoveTarget(row)}
                          className="h-9 rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Kaldır
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>

      <ZimmetActionDialogs
        productId={productId}
        productUnit={productUnit}
        changeTarget={changeTarget}
        removeTarget={removeTarget}
        onCloseChange={() => setChangeTarget(null)}
        onCloseRemove={() => setRemoveTarget(null)}
        onSuccess={() => onChanged?.()}
      />
    </>
  )
}
