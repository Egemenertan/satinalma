'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { ComparisonCard } from '@/components/quoteComparison/ComparisonCard'
import { QUOTE_COMPARISON_STORAGE_BUCKET, type QuoteComparisonStatus } from '@/types/quoteComparison'

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
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {comparisons.map((comparison) => (
            <ComparisonCard
              key={comparison.id}
              comparison={comparison}
              onDelete={handleDelete}
              isDeleting={deletingId === comparison.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
