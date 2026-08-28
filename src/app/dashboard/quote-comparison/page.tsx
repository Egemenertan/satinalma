'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { ComparisonCard } from '@/components/quoteComparison/ComparisonCard'
import { SiteFilterBar } from '@/components/quoteComparison/SiteFilterBar'
import { QUOTE_COMPARISON_STORAGE_BUCKET, type QuoteComparisonStatus } from '@/types/quoteComparison'
import {
  ALL_PROJECTS_KEY,
  OTHER_PROJECT_KEY,
  fetchQuoteComparisonSites,
  getFallbackQuoteComparisonSites,
  getQuoteComparisonSiteKey,
  type QuoteComparisonSite,
} from '@/lib/quoteComparison/projectSites'

interface ComparisonListItem {
  id: string
  title: string
  project_name: string | null
  material_name: string | null
  status: QuoteComparisonStatus
  created_at: string
  offerCount: number
  analysis_progress: number
  analysis_step: string | null
}

export default function QuoteComparisonListPage() {
  const { showToast } = useToast()
  const [comparisons, setComparisons] = useState<ComparisonListItem[]>([])
  const [sites, setSites] = useState<QuoteComparisonSite[]>(getFallbackQuoteComparisonSites)
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedSiteKey, setSelectedSiteKey] = useState(ALL_PROJECTS_KEY)
  const [searchTerm, setSearchTerm] = useState('')

  const loadComparisons = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    const supabase = createClient()

    const [{ data, error }, { data: offers }] = await Promise.all([
      supabase
        .from('quote_comparisons')
        .select('id, title, project_name, material_name, status, created_at, analysis_progress, analysis_step')
        .order('created_at', { ascending: false }),
      supabase.from('quote_comparison_offers').select('id, comparison_id'),
    ])

    if (error) {
      if (!silent) showToast('Karşılaştırmalar yüklenemedi: ' + error.message, 'error')
      setIsLoading(false)
      return
    }

    const countByComparison = new Map<string, number>()
    for (const offer of offers || []) {
      countByComparison.set(offer.comparison_id, (countByComparison.get(offer.comparison_id) || 0) + 1)
    }

    setComparisons(
      (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        project_name: row.project_name,
        material_name: row.material_name,
        status: row.status,
        created_at: row.created_at,
        offerCount: countByComparison.get(row.id) || 0,
        analysis_progress: typeof row.analysis_progress === 'number' ? row.analysis_progress : 0,
        analysis_step: row.analysis_step || null,
      }))
    )
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    loadComparisons()
  }, [loadComparisons])

  useEffect(() => {
    let cancelled = false

    const loadSites = async () => {
      try {
        const data = await fetchQuoteComparisonSites()
        if (!cancelled) setSites(data)
      } catch (error) {
        console.error('Sites could not be loaded:', error)
        if (!cancelled) setSites(getFallbackQuoteComparisonSites())
      }
    }

    void loadSites()
    return () => {
      cancelled = true
    }
  }, [])

  const hasInProgress = comparisons.some((c) => c.status === 'analyzing' || c.status === 'draft')

  useEffect(() => {
    if (!hasInProgress) return

    const tick = () => {
      void loadComparisons(true)
    }
    const interval = setInterval(tick, 4000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }

    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [hasInProgress, loadComparisons])

  const countsBySiteKey = useMemo(() => {
    const counts: Record<string, number> = {}
    let otherCount = 0

    for (const comparison of comparisons) {
      const key = getQuoteComparisonSiteKey(comparison.project_name)
      if (key) {
        counts[key] = (counts[key] || 0) + 1
      } else {
        otherCount += 1
      }
    }

    return { counts, otherCount }
  }, [comparisons])

  const filterOptions = useMemo(
    () =>
      sites.map((site) => ({
        key: site.key,
        label: site.name,
        count: countsBySiteKey.counts[site.key] || 0,
        imageUrl: site.imageUrl,
      })),
    [sites, countsBySiteKey.counts]
  )

  const filteredComparisons = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr')

    return comparisons.filter((comparison) => {
      if (selectedSiteKey === OTHER_PROJECT_KEY) {
        if (getQuoteComparisonSiteKey(comparison.project_name)) return false
      } else if (selectedSiteKey !== ALL_PROJECTS_KEY) {
        if (getQuoteComparisonSiteKey(comparison.project_name) !== selectedSiteKey) return false
      }

      if (!query) return true

      const haystack = [
        comparison.title,
        comparison.project_name,
        comparison.material_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr')

      return haystack.includes(query)
    })
  }, [comparisons, selectedSiteKey, searchTerm])

  const groupedComparisons = useMemo(() => {
    const groups: { key: string; label: string; items: ComparisonListItem[] }[] = []
    const byKey = new Map<string, ComparisonListItem[]>()

    for (const comparison of filteredComparisons) {
      const siteKey = getQuoteComparisonSiteKey(comparison.project_name) || OTHER_PROJECT_KEY
      const list = byKey.get(siteKey) || []
      list.push(comparison)
      byKey.set(siteKey, list)
    }

    for (const site of sites) {
      const items = byKey.get(site.key)
      if (items && items.length > 0) {
        groups.push({ key: site.key, label: site.name, items })
      }
    }

    const otherItems = byKey.get(OTHER_PROJECT_KEY)
    if (otherItems && otherItems.length > 0) {
      groups.push({ key: OTHER_PROJECT_KEY, label: 'Diğer', items: otherItems })
    }

    return groups
  }, [filteredComparisons, sites])

  const handleDelete = async (id: string) => {
    if (!confirm('Bu karşılaştırmayı silmek istediğinizden emin misiniz? Yüklenen PDF dosyaları da silinecek.')) return

    setDeletingId(id)
    try {
      const supabase = createClient()

      const { data: offers } = await supabase
        .from('quote_comparison_offers')
        .select('file_path')
        .eq('comparison_id', id)

      if (offers && offers.length > 0) {
        await supabase.storage
          .from(QUOTE_COMPARISON_STORAGE_BUCKET)
          .remove(offers.map((o) => o.file_path))
      }

      const { error } = await supabase.from('quote_comparisons').delete().eq('id', id)
      if (error) throw error

      setComparisons((prev) => prev.filter((c) => c.id !== id))
      showToast('Karşılaştırma silindi', 'success')
    } catch (error: any) {
      showToast('Silme işlemi başarısız: ' + error.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const renderCardGrid = (items: ComparisonListItem[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((comparison) => (
        <ComparisonCard
          key={comparison.id}
          comparison={comparison}
          onDelete={handleDelete}
          isDeleting={deletingId === comparison.id}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">
            Teklif Karşılaştırma
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Tedarikçi teklif PDF'lerini yükleyin, sistem özellik bazında karşılaştırıp en optimum teklifi önersin.
          </p>
        </div>
        <Button asChild className="bg-neutral-950 hover:bg-neutral-800 text-white">
          <Link href="/dashboard/quote-comparison/new">
            <Plus className="w-4 h-4" />
            Yeni Karşılaştırma
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loading text="Karşılaştırmalar yükleniyor..." />
        </div>
      ) : comparisons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-300 rounded-2xl bg-white">
          <p className="text-gray-500 text-sm font-medium">Henüz bir karşılaştırma oluşturulmamış</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">
            Başlamak için tedarikçi tekliflerini PDF olarak yükleyin
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/quote-comparison/new">
              <Plus className="w-4 h-4" />
              Yeni Karşılaştırma Oluştur
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Başlık, site veya malzeme ile ara..."
                className="h-11 w-full rounded-xl border-gray-200 bg-white pl-10 pr-10"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Aramayı temizle"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <SiteFilterBar
              options={filterOptions}
              selectedKey={selectedSiteKey}
              onChange={setSelectedSiteKey}
              totalCount={comparisons.length}
              otherCount={countsBySiteKey.otherCount}
            />
          </div>

          {filteredComparisons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
              <p className="text-gray-500 text-sm font-medium">
                {searchTerm.trim()
                  ? 'Aramanızla eşleşen karşılaştırma bulunamadı'
                  : 'Bu siteye ait karşılaştırma yok'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {searchTerm.trim()
                  ? 'Farklı bir kelime deneyin veya filtreyi değiştirin'
                  : 'Başka bir site seçin veya yeni karşılaştırma oluşturun'}
              </p>
            </div>
          ) : selectedSiteKey === ALL_PROJECTS_KEY ? (
            <div className="space-y-8">
              {groupedComparisons.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-gray-900">{group.label}</h2>
                    <span className="text-xs text-gray-400 tabular-nums">{group.items.length}</span>
                  </div>
                  {renderCardGrid(group.items)}
                </section>
              ))}
            </div>
          ) : (
            renderCardGrid(filteredComparisons)
          )}
        </>
      )}
    </div>
  )
}
