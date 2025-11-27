'use client'

import { SearchInput } from './SearchInput'
import { StatusFilter } from './StatusFilter'
import { SiteFilter } from './SiteFilter'
import { DateFilter } from './DateFilter'
import { Button } from '@/components/ui/button'
import { Receipt, List } from 'lucide-react'

interface OrderFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  siteFilter: string[]
  onSiteFilterChange: (sites: string[]) => void
  dateRange: { from: Date | undefined; to?: Date | undefined }
  onDateRangeChange: (range: { from: Date | undefined; to?: Date | undefined }) => void
  onClearDateFilters: () => void
  viewMode: 'default' | 'invoice'
  onViewModeChange: (mode: 'default' | 'invoice') => void
}

export function OrderFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  siteFilter,
  onSiteFilterChange,
  dateRange,
  onDateRangeChange,
  onClearDateFilters,
  viewMode,
  onViewModeChange,
}: OrderFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Filtreler */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Tedarikçi, malzeme adı, talep başlığı veya talep numarası ara..."
        />
        
        <StatusFilter
          value={statusFilter}
          onChange={onStatusChange}
        />

        <SiteFilter
          selectedSites={siteFilter}
          onSitesChange={onSiteFilterChange}
        />

        <DateFilter
          dateRange={dateRange}
          onChange={onDateRangeChange}
          onClear={onClearDateFilters}
        />
      </div>

      {/* Görünüm Modu Toggle - Şimdilik gizli */}
      {false && (
        <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => onViewModeChange('default')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${viewMode === 'default' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <List className="w-4 h-4" />
            Varsayılan
          </button>
          <button
            onClick={() => onViewModeChange('invoice')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${viewMode === 'invoice' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <Receipt className="w-4 h-4" />
            Fatura Bazlı
          </button>
        </div>
      )}
    </div>
  )
}



