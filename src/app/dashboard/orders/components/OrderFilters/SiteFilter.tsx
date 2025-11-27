'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Building2, X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SiteFilterProps {
  selectedSites: string[]
  onSitesChange: (sites: string[]) => void
}

export function SiteFilter({ selectedSites, onSitesChange }: SiteFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [sites, setSites] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Şantiyeleri yükle
  React.useEffect(() => {
    const fetchSites = async () => {
      const supabase = createClient()
      
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('purchase_requests!orders_purchase_request_id_fkey(site_name)')
        
        if (error) {
          console.error('Şantiye yükleme hatası:', error)
          return
        }
        
        if (data) {
          const uniqueSites = Array.from(
            new Set(
              data
                .map((order: any) => order.purchase_requests?.site_name)
                .filter(Boolean)
            )
          ).sort()
          
          console.log('📍 Şantiyeler yüklendi:', uniqueSites)
          setSites(uniqueSites as string[])
        }
      } catch (error) {
        console.error('Şantiye yükleme hatası:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSites()
  }, [])

  // Dışarı tıklandığında kapat
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggleSite = (site: string) => {
    if (selectedSites.includes(site)) {
      onSitesChange(selectedSites.filter(s => s !== site))
    } else {
      onSitesChange([...selectedSites, site])
    }
  }

  const handleClearAll = () => {
    onSitesChange([])
  }

  const handleSelectAll = () => {
    onSitesChange(sites)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-10 border-gray-300 ${
          selectedSites.length > 0
            ? 'border-gray-900 bg-gray-50'
            : 'hover:bg-gray-50'
        }`}
      >
        <Building2 className="w-4 h-4 mr-2" />
        Şantiye
        {selectedSites.length > 0 && (
          <span className="ml-2 px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
            {selectedSites.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Şantiye Filtresi</h4>
              {selectedSites.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs text-gray-600 hover:text-gray-900"
                >
                  <X className="w-3 h-3 mr-1" />
                  Temizle
                </Button>
              )}
            </div>
            
            {!isLoading && sites.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-7 text-xs text-gray-600 hover:text-gray-900 w-full justify-start"
              >
                Tümünü Seç ({sites.length})
              </Button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">Yükleniyor...</div>
              </div>
            ) : sites.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-gray-500">Şantiye bulunamadı</div>
              </div>
            ) : (
              <div className="space-y-1">
                {sites.map((site) => (
                  <button
                    key={site}
                    type="button"
                    onClick={() => handleToggleSite(site)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedSites.includes(site)}
                      onCheckedChange={() => handleToggleSite(site)}
                      className="data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                    />
                    <span className="text-sm text-gray-900 flex-1 text-left">
                      {site}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedSites.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-600">
                {selectedSites.length} şantiye seçildi
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
