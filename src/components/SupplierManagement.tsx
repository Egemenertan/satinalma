'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { invalidateSuppliersCache } from '@/lib/cache'
import { cn } from '@/lib/utils'
import { Building2, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  code: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  tax_number: string | null
  payment_terms: number | null
  rating: number | null
  is_approved: boolean | null
}

type StatusFilter = 'all' | 'approved' | 'pending'

const fetchSuppliers = async (): Promise<Supplier[]> => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Kullanıcı oturumu bulunamadı')

  const { data, error } = await supabase
    .from('suppliers')
    .select(
      'id, name, code, contact_person, email, phone, address, tax_number, payment_terms, rating, is_approved'
    )
    .order('name')

  if (error) throw error
  return data || []
}

function fold(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function supplierMatches(supplier: Supplier, query: string) {
  const q = fold(query.trim())
  if (!q) return true

  const haystack = [
    supplier.name,
    supplier.code,
    supplier.contact_person,
    supplier.email,
    supplier.phone,
    supplier.tax_number,
    supplier.address,
  ]
    .filter(Boolean)
    .map((part) => fold(String(part)))
    .join(' ')

  if (haystack.includes(q)) return true

  const queryDigits = digits(query)
  if (queryDigits.length < 3) return false

  const phoneDigits = digits(`${supplier.phone || ''}${supplier.tax_number || ''}`)
  return phoneDigits.includes(queryDigits)
}

function formatRating(rating: number | null) {
  if (rating == null) return '—'
  const value = Number(rating)
  if (!Number.isFinite(value) || value <= 0) return '—'
  return value.toFixed(1)
}

function contactSummary(supplier: Supplier, query: string) {
  const foldedQuery = fold(query.trim())
  const queryDigits = digits(query)

  if (supplier.phone && foldedQuery) {
    const phoneHit =
      fold(supplier.phone).includes(foldedQuery) ||
      (queryDigits.length >= 3 && digits(supplier.phone).includes(queryDigits))
    if (phoneHit) return supplier.phone
  }

  if (supplier.email && foldedQuery && fold(supplier.email).includes(foldedQuery)) {
    return supplier.email
  }

  return supplier.email || supplier.phone || 'İletişim yok'
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('')
}

function StatusPill({ approved }: { approved: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        approved
          ? 'bg-primary/15 text-elegant-black'
          : 'bg-elegant-gray-100 text-elegant-gray-600'
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', approved ? 'bg-primary' : 'bg-elegant-gray-400')}
        aria-hidden
      />
      {approved ? 'Onaylı' : 'Beklemede'}
    </span>
  )
}

function StatCard({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string
  value: number
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl border bg-white p-5 text-left shadow-sm transition-colors',
        active
          ? 'border-elegant-black'
          : 'border-elegant-gray-200 hover:border-elegant-gray-300'
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
        {label}
      </span>
      <div className="mt-2 text-3xl font-bold tracking-tight text-elegant-black tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-elegant-gray-500">{hint}</p>
    </button>
  )
}

export default function SupplierManagement() {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const {
    data: suppliers = [],
    error,
    isLoading,
    mutate,
  } = useSWR('suppliers_list', fetchSuppliers, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
    errorRetryCount: 3,
  })

  useEffect(() => {
    const supabase = createClient()
    const subscription = supabase
      .channel('suppliers_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => {
        invalidateSuppliersCache()
        mutate()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [mutate])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const counts = useMemo(() => {
    const approved = suppliers.filter((supplier) => supplier.is_approved).length
    return {
      total: suppliers.length,
      approved,
      pending: suppliers.length - approved,
    }
  }, [suppliers])

  const visibleSuppliers = useMemo(() => {
    return suppliers
      .filter((supplier) => {
        if (status === 'approved') return Boolean(supplier.is_approved)
        if (status === 'pending') return !supplier.is_approved
        return true
      })
      .filter((supplier) => supplierMatches(supplier, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [suppliers, query, status])

  const hasQuery = query.trim().length > 0
  const filtersActive = hasQuery || status !== 'all'

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    searchRef.current?.focus()
  }

  if (isLoading && suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[112px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
        <p className="font-medium text-red-800">Tedarikçiler yüklenemedi</p>
        <p className="mt-1 text-sm text-red-700/80">{error.message}</p>
        <Button
          type="button"
          variant="outline"
                className="mt-5 rounded-xl border-elegant-gray-300 bg-white hover:bg-elegant-gray-50 hover:text-elegant-black"
          onClick={() => mutate()}
        >
          Tekrar dene
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-elegant-black md:text-3xl">Tedarikçiler</h1>
          <p className="mt-1 text-sm text-elegant-gray-600">
            Kayıtlı iş ortaklarını arayın, durumuna göre süzün ve yönetin
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push('/dashboard/suppliers/create')}
          className="h-11 shrink-0 rounded-xl bg-elegant-black px-5 text-white hover:bg-elegant-gray-800"
        >
          <Plus className="h-4 w-4" />
          Yeni tedarikçi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Toplam"
          value={counts.total}
          hint="Kayıtlı tedarikçi"
          active={status === 'all'}
          onClick={() => setStatus('all')}
        />
        <StatCard
          label="Onaylı"
          value={counts.approved}
          hint="Siparişe açık"
          active={status === 'approved'}
          onClick={() => setStatus('approved')}
        />
        <StatCard
          label="Beklemede"
          value={counts.pending}
          hint="Onay bekleyen"
          active={status === 'pending'}
          onClick={() => setStatus('pending')}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-elegant-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-elegant-gray-100 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-elegant-black">Tedarikçi listesi</h2>
              <p className="mt-0.5 text-sm text-elegant-gray-500">
                {visibleSuppliers.length === suppliers.length
                  ? `${suppliers.length} tedarikçi`
                  : `${visibleSuppliers.length} sonuç · ${suppliers.length} kayıt`}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-elegant-gray-400"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setQuery('')
                    event.currentTarget.blur()
                  }
                }}
                placeholder="Ad, kod, yetkili, e-posta veya telefon"
                aria-label="Tedarikçi ara"
                className="h-11 w-full rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 pl-10 pr-10 text-sm text-elegant-black outline-none transition-colors placeholder:text-elegant-gray-400 focus:border-elegant-gray-400 focus:bg-white focus:ring-2 focus:ring-primary/40"
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    searchRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-elegant-gray-500 hover:bg-elegant-gray-100 hover:text-elegant-black"
                  aria-label="Aramayı temizle"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div
              className="flex shrink-0 rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1"
              role="tablist"
              aria-label="Durum filtresi"
            >
              {(
                [
                  ['all', 'Tümü'],
                  ['approved', 'Onaylı'],
                  ['pending', 'Beklemede'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={status === value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    'rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors',
                    status === value
                      ? 'bg-white text-elegant-black shadow-sm'
                      : 'text-elegant-gray-500 hover:text-elegant-black'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleSuppliers.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-elegant-gray-100">
              <Building2 className="h-6 w-6 text-elegant-gray-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-elegant-black">
              {filtersActive ? 'Eşleşen tedarikçi yok' : 'Henüz tedarikçi yok'}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-elegant-gray-500">
              {filtersActive
                ? 'Farklı bir kelime deneyin veya filtreyi kaldırın.'
                : 'İlk kaydı eklediğinizde liste burada görünür.'}
            </p>
            {filtersActive ? (
              <Button
                type="button"
                variant="outline"
                className="mt-5 rounded-xl border-elegant-gray-300 bg-white hover:bg-elegant-gray-50 hover:text-elegant-black"
                onClick={clearFilters}
              >
                Filtreleri temizle
              </Button>
            ) : (
              <Button
                type="button"
                className="mt-5 rounded-xl bg-elegant-black text-white hover:bg-elegant-gray-800"
                onClick={() => router.push('/dashboard/suppliers/create')}
              >
                <Plus className="h-4 w-4" />
                Yeni tedarikçi
              </Button>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-elegant-gray-100 lg:hidden">
              {visibleSuppliers.map((supplier) => (
                <li key={supplier.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-elegant-gray-50"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elegant-gray-100 text-xs font-semibold text-elegant-gray-700">
                      {initials(supplier.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-elegant-black">{supplier.name}</span>
                        <StatusPill approved={Boolean(supplier.is_approved)} />
                      </span>
                      <span className="mt-1 block truncate text-sm text-elegant-gray-500">
                        {supplier.contact_person && contactSummary(supplier, query) !== 'İletişim yok'
                          ? `${supplier.contact_person} · ${contactSummary(supplier, query)}`
                          : supplier.contact_person || contactSummary(supplier, query)}
                      </span>
                      <span className="mt-1 block text-xs text-elegant-gray-400">
                        {supplier.code ? `${supplier.code} · ` : ''}
                        {supplier.payment_terms != null ? `${supplier.payment_terms} gün vade` : 'Vade belirtilmemiş'}
                      </span>
                    </span>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-elegant-gray-300" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-elegant-gray-100 text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                    <th className="px-6 py-3 font-bold">Tedarikçi</th>
                    <th className="px-4 py-3 font-bold">İletişim</th>
                    <th className="px-4 py-3 font-bold">Vade</th>
                    <th className="px-4 py-3 font-bold">Puan</th>
                    <th className="px-4 py-3 font-bold">Durum</th>
                    <th className="px-4 py-3 text-right font-bold">
                      <span className="sr-only">İşlem</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSuppliers.map((supplier) => (
                    <tr
                      key={supplier.id}
                      onClick={() => router.push(`/dashboard/suppliers/${supplier.id}`)}
                      className="cursor-pointer border-b border-elegant-gray-100 last:border-0 transition-colors hover:bg-elegant-gray-50"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elegant-gray-100 text-xs font-semibold text-elegant-gray-700">
                            {initials(supplier.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-elegant-black">{supplier.name}</div>
                            <div className="truncate text-xs text-elegant-gray-500">
                              {supplier.code || 'Kod yok'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="truncate text-sm text-elegant-black">
                          {supplier.contact_person || '—'}
                        </div>
                        <div className="truncate text-xs text-elegant-gray-500">
                          {contactSummary(supplier, query)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm tabular-nums text-elegant-black">
                        {supplier.payment_terms != null ? `${supplier.payment_terms} gün` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm tabular-nums text-elegant-black">
                        {formatRating(supplier.rating)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill approved={Boolean(supplier.is_approved)} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            router.push(`/dashboard/suppliers/${supplier.id}/edit`)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-elegant-gray-500 transition-colors hover:bg-elegant-gray-100 hover:text-elegant-black"
                          aria-label={`${supplier.name} kaydını düzenle`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
