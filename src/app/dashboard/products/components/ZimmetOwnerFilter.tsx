'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, UserRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchZimmetOwnerOptions, type ZimmetOwnerOption } from '@/services/products.service'
import { cn } from '@/lib/utils'

interface ZimmetOwnerFilterProps {
  value: string
  onChange: (value: string) => void
  warehouseIds?: string[]
}

export function ZimmetOwnerFilter({ value, onChange, warehouseIds }: ZimmetOwnerFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ZimmetOwnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const warehouseKey = (warehouseIds || []).filter(Boolean).join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchZimmetOwnerOptions(warehouseKey ? warehouseKey.split(',') : undefined)
      .then((list) => {
        if (!cancelled) setOptions(list)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [warehouseKey])

  const selected = options.find((option) => option.value === value)
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    if (!term) return options
    return options.filter((option) => {
      const label = option.label.toLocaleLowerCase('tr')
      const email = (option.email || '').toLocaleLowerCase('tr')
      return label.includes(term) || email.includes(term)
    })
  }, [options, query])

  const pick = (next: string) => {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 text-sm sm:w-64"
      >
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
          <span className={cn('truncate', selected ? 'text-gray-900' : 'text-gray-500')}>
            {selected?.label || 'Zimmetli kişi'}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zimmetli kişi</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kişi ara..."
            className="h-10 rounded-xl border-gray-200 bg-white"
          />
          <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => pick('')}
              className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Tüm kişiler
              {!value && <Check className="h-4 w-4" />}
            </button>
            {loading && <p className="px-3 py-6 text-sm text-gray-500">Kişiler yükleniyor...</p>}
            {!loading && visible.length === 0 && (
              <p className="px-3 py-6 text-sm text-gray-500">Eşleşen kişi yok</p>
            )}
            {visible.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => pick(option.value)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50',
                  option.value === value && 'bg-gray-50'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{option.label}</span>
                  {option.email && (
                    <span className="block truncate text-xs text-gray-500">{option.email}</span>
                  )}
                </span>
                {option.value === value && <Check className="h-4 w-4 shrink-0 text-gray-900" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
