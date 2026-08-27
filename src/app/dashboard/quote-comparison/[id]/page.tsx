'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, RotateCcw, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { RecommendationBanner } from '@/components/quoteComparison/RecommendationBanner'
import { ComparisonTable } from '@/components/quoteComparison/ComparisonTable'
import { LineItemPriceTable } from '@/components/quoteComparison/LineItemPriceTable'
import { CommercialTermsTable } from '@/components/quoteComparison/CommercialTermsTable'
import { ReanalyzePanel } from '@/components/quoteComparison/ReanalyzePanel'
import { DlxAiLogo } from '@/components/quoteComparison/DlxAiLogo'
import { AnalysisProgressBar } from '@/components/quoteComparison/AnalysisProgressBar'
import { QUOTE_COMPARISON_STORAGE_BUCKET, type QuoteComparisonWithOffers } from '@/types/quoteComparison'

export default function QuoteComparisonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const comparisonId = params.id as string

  const [comparison, setComparison] = useState<QuoteComparisonWithOffers | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [priorityCriteria, setPriorityCriteria] = useState('')

  const loadComparison = useCallback(async () => {
    const supabase = createClient()
    const [{ data, error }, { data: offers, error: offersError }] = await Promise.all([
      supabase.from('quote_comparisons').select('*').eq('id', comparisonId).single(),
      supabase
        .from('quote_comparison_offers')
        .select('*')
        .eq('comparison_id', comparisonId)
        .order('sort_order', { ascending: true }),
    ])

    if (error || !data) {
      showToast('Karşılaştırma bulunamadı', 'error')
      router.push('/dashboard/quote-comparison')
      return
    }

    if (offersError) {
      showToast('Teklifler yüklenemedi: ' + offersError.message, 'error')
    }

    setComparison({
      ...data,
      quote_comparison_offers: offers || [],
    })
    setPriorityCriteria(typeof data.priority_criteria === 'string' ? data.priority_criteria : '')
    setIsLoading(false)
  }, [comparisonId, router, showToast])

  useEffect(() => {
    loadComparison()
  }, [loadComparison])

  // Analiz arka planda sürer; bu sayfa yalnızca sonucu izler.
  useEffect(() => {
    if (comparison?.status !== 'analyzing' && comparison?.status !== 'draft') return

    const tick = () => {
      void loadComparison()
    }

    const interval = setInterval(tick, 2000)
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
  }, [comparison?.status, loadComparison])

  const startAnalysis = async (criteria: string | undefined) => {
    setIsRetrying(true)
    try {
      const response = await fetch(`/api/quote-comparison/${comparisonId}/analyze`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria !== undefined ? { priorityCriteria: criteria } : {}),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Analiz başlatılamadı')
      setComparison((prev) =>
        prev
          ? {
              ...prev,
              status: 'analyzing',
              error_message: null,
              analysis_progress: 5,
              analysis_step: 'Analiz başlatıldı',
              ...(criteria !== undefined ? { priority_criteria: criteria.trim() || null } : {}),
            }
          : prev
      )
      showToast('Analiz yeniden başladı. Sayfadan ayrılsanız da işlem devam eder.', 'success')
    } catch (error: any) {
      showToast(error?.message || 'Analiz başlatılamadı', 'error')
      await loadComparison()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleRetry = () => startAnalysis(undefined)

  const handleReanalyzeWithPriorities = () => startAnalysis(priorityCriteria)

  const handleDelete = async () => {
    if (!comparison) return
    if (!confirm('Bu karşılaştırmayı silmek istediğinizden emin misiniz? Yüklenen PDF dosyaları da silinecek.')) return

    setIsDeleting(true)
    try {
      const supabase = createClient()
      const filePaths = (comparison.quote_comparison_offers || []).map((o) => o.file_path)
      if (filePaths.length > 0) {
        await supabase.storage.from(QUOTE_COMPARISON_STORAGE_BUCKET).remove(filePaths)
      }
      const { error } = await supabase.from('quote_comparisons').delete().eq('id', comparisonId)
      if (error) throw error

      showToast('Karşılaştırma silindi', 'success')
      router.push('/dashboard/quote-comparison')
    } catch (error: any) {
      showToast('Silme işlemi başarısız: ' + error.message, 'error')
      setIsDeleting(false)
    }
  }

  const handleExportXlsx = async () => {
    if (!comparison) return
    setIsExporting(true)
    try {
      const { exportQuoteComparisonXlsx } = await import('@/lib/xlsx/quoteComparisonXlsx')
      await exportQuoteComparisonXlsx({
        title: comparison.title,
        projectName: comparison.project_name,
        materialName: comparison.material_name,
        createdAt: comparison.created_at,
        comparisonTable: comparison.comparison_table,
        lineItemComparison: comparison.line_item_comparison,
        recommendation: comparison.ai_recommendation,
        recommendedOfferId: comparison.recommended_offer_id,
        offers: comparison.quote_comparison_offers,
      })
    } catch (error: any) {
      showToast('Excel oluşturulamadı: ' + error.message, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading || !comparison) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loading text="Karşılaştırma yükleniyor..." />
      </div>
    )
  }

  const canReanalyze = comparison.status === 'completed' || comparison.status === 'failed'
  const lineItemRows = comparison.line_item_comparison || []
  const hasLineItems = lineItemRows.length > 0

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-gray-500">
          <a href="/dashboard/quote-comparison">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </a>
        </Button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{comparison.title}</h1>
            {comparison.project_name && (
              <p className="text-sm font-medium text-gray-600 mt-1">{comparison.project_name}</p>
            )}
            {comparison.material_name && <p className="text-sm text-gray-500 mt-0.5">{comparison.material_name}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {(comparison.quote_comparison_offers || []).length} teklif ·{' '}
              {new Date(comparison.created_at).toLocaleDateString('tr-TR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {comparison.status === 'completed' && (
              <Button variant="outline" onClick={handleExportXlsx} disabled={isExporting}>
                <Download className="w-4 h-4" />
                {isExporting ? 'Hazırlanıyor...' : 'Excel İndir'}
              </Button>
            )}
            {comparison.status === 'failed' && (
              <Button onClick={handleRetry} disabled={isRetrying} className="bg-neutral-950 hover:bg-neutral-800 text-white">
                <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                Tekrar Dene
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {comparison.status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <DlxAiLogo className="h-8" />
          <p className="text-sm font-medium text-neutral-800">Teklifler analiz ediliyor...</p>
          <AnalysisProgressBar
            progress={comparison.analysis_progress ?? 0}
            step={comparison.analysis_step}
          />
          <p className="text-xs text-neutral-500 text-center max-w-md">
            {comparison.priority_criteria?.trim()
              ? 'Belirttiğiniz öncelikler dikkate alınarak yeniden değerlendiriliyor. Başka sayfaya geçseniz de analiz arka planda devam eder.'
              : 'Bu işlem teklif sayısına göre 1-2 dakika sürebilir. Başka sayfaya geçseniz de analiz arka planda devam eder.'}
          </p>
        </div>
      )}

      {comparison.status === 'failed' && (
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-red-200 bg-red-50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">Analiz sırasında bir hata oluştu</p>
            <p className="text-sm text-red-700 mt-1">{comparison.error_message || 'Bilinmeyen hata'}</p>
          </div>
        </div>
      )}

      {comparison.status === 'completed' && comparison.ai_recommendation && (
        <RecommendationBanner
          recommendation={comparison.ai_recommendation}
          offers={comparison.quote_comparison_offers || []}
          recommendedOfferId={comparison.recommended_offer_id}
        />
      )}

      {canReanalyze && (
        <ReanalyzePanel
          value={priorityCriteria}
          onChange={setPriorityCriteria}
          onSubmit={handleReanalyzeWithPriorities}
          isSubmitting={isRetrying}
        />
      )}

      {comparison.status === 'completed' && hasLineItems && (
        <LineItemPriceTable
          offers={comparison.quote_comparison_offers || []}
          rows={lineItemRows}
          recommendedOfferId={comparison.recommended_offer_id}
        />
      )}

      {comparison.status === 'completed' && (
        <CommercialTermsTable
          offers={comparison.quote_comparison_offers || []}
          recommendedOfferId={comparison.recommended_offer_id}
        />
      )}

      {comparison.status === 'completed' && (
        <ComparisonTable
          offers={comparison.quote_comparison_offers || []}
          comparisonTable={comparison.comparison_table}
          recommendedOfferId={comparison.recommended_offer_id}
          showPriceRow={!hasLineItems}
        />
      )}
    </div>
  )
}
