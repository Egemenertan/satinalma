'use client'

import { Building2, Warehouse } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SiteKind } from '@/lib/site-kind'
import { cn } from '@/lib/utils'

type SiteKindTabsProps = {
  value: SiteKind
  onChange: (value: SiteKind) => void
  siteCount?: number
  warehouseCount?: number
  className?: string
}

export function SiteKindTabs({
  value,
  onChange,
  siteCount,
  warehouseCount,
  className,
}: SiteKindTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as SiteKind)}
      className={cn('gap-0', className)}
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
        <TabsTrigger
          value="site"
          className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-elegant-gray-800 dark:data-[state=active]:text-white"
        >
          <Building2 className="size-4" />
          Şantiyeler
          {siteCount != null && (
            <span className="ml-1 text-xs font-medium text-gray-500">{siteCount}</span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="warehouse"
          className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-elegant-gray-800 dark:data-[state=active]:text-white"
        >
          <Warehouse className="size-4" />
          Depolar
          {warehouseCount != null && (
            <span className="ml-1 text-xs font-medium text-gray-500">{warehouseCount}</span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
