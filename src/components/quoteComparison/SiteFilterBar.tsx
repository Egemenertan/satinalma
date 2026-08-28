'use client'

import { useState, type ReactNode } from 'react'
import { Building2, Folder, LayoutGrid } from 'lucide-react'
import { ALL_PROJECTS_KEY, OTHER_PROJECT_KEY } from '@/lib/quoteComparison/projectSites'

interface SiteFilterOption {
  key: string
  label: string
  count: number
  imageUrl?: string | null
}

interface SiteFilterBarProps {
  options: SiteFilterOption[]
  selectedKey: string
  onChange: (key: string) => void
  totalCount: number
  otherCount: number
}

function SiteThumb({
  imageUrl,
  label,
  isActive,
  fallback,
}: {
  imageUrl?: string | null
  label: string
  isActive: boolean
  fallback: ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const showImage = Boolean(imageUrl) && !broken

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt={label}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className={isActive ? 'text-gray-900' : 'text-gray-500'}>{fallback}</span>
      )}
    </span>
  )
}

export function SiteFilterBar({
  options,
  selectedKey,
  onChange,
  totalCount,
  otherCount,
}: SiteFilterBarProps) {
  const pills: SiteFilterOption[] = [
    { key: ALL_PROJECTS_KEY, label: 'Tümü', count: totalCount },
    ...options,
  ]

  if (otherCount > 0) {
    pills.push({ key: OTHER_PROJECT_KEY, label: 'Diğer', count: otherCount })
  }

  return (
    <div className="flex flex-wrap gap-3">
      {pills.map((pill) => {
        const isActive = selectedKey === pill.key

        return (
          <button
            key={pill.key}
            type="button"
            onClick={() => onChange(pill.key)}
            className={`inline-flex min-w-[10.5rem] items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors ${
              isActive
                ? 'border-gray-900 bg-gray-50 text-gray-900 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <SiteThumb
              imageUrl={pill.imageUrl}
              label={pill.label}
              isActive={isActive}
              fallback={
                pill.key === ALL_PROJECTS_KEY ? (
                  <LayoutGrid className="h-5 w-5" />
                ) : pill.key === OTHER_PROJECT_KEY ? (
                  <Folder className="h-5 w-5" />
                ) : (
                  <Building2 className="h-5 w-5" />
                )
              }
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-snug">{pill.label}</span>
              <span className="text-xs leading-snug tabular-nums text-gray-400">
                {pill.count} karşılaştırma
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
