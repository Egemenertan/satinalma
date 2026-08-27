'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { InlineLoading } from '@/components/ui/loading'
import { createClient } from '@/lib/supabase/client'
import { UploadDropzone, type QuoteUploadItem } from '@/components/quoteComparison/UploadDropzone'
import { DlxAiLogo } from '@/components/quoteComparison/DlxAiLogo'
import { QUOTE_COMPARISON_STORAGE_BUCKET } from '@/types/quoteComparison'

const MIN_OFFERS = 2

export default function NewQuoteComparisonPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [title, setTitle] = useState('')
  const [projectName, setProjectName] = useState('')
  const [materialName, setMaterialName] = useState('')
  const [uploads, setUploads] = useState<QuoteUploadItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast('Lütfen bir başlık girin', 'error')
      return
    }
    if (uploads.length < MIN_OFFERS) {
      showToast(`Karşılaştırma yapabilmek için en az ${MIN_OFFERS} teklif PDF'i yükleyin`, 'error')
      return
    }
    if (uploads.some((item) => !item.name.trim())) {
      showToast('Her teklif PDF\'i için bir ad girin', 'error')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    let createdComparisonId: string | null = null

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setProgressLabel('Karşılaştırma oluşturuluyor...')
      const { data: comparison, error: createError } = await supabase
        .from('quote_comparisons')
        .insert({
          title: title.trim(),
          project_name: projectName.trim() || null,
          material_name: materialName.trim() || null,
          status: 'draft',
          created_by: user?.id || null,
        })
        .select()
        .single()

      if (createError || !comparison) throw createError || new Error('Karşılaştırma oluşturulamadı')
      createdComparisonId = comparison.id

      for (let i = 0; i < uploads.length; i++) {
        const { file, name } = uploads[i]
        const offerName = name.trim()
        setProgressLabel(`Yükleniyor: ${offerName} (${i + 1}/${uploads.length})`)

        const filePath = `${comparison.id}/${i}_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage
          .from(QUOTE_COMPARISON_STORAGE_BUCKET)
          .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })

        if (uploadError) throw uploadError

        const { error: offerError } = await supabase.from('quote_comparison_offers').insert({
          comparison_id: comparison.id,
          supplier_name: offerName,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          sort_order: i,
        })

        if (offerError) throw offerError
      }

      setProgressLabel('Analiz arka planda başlatılıyor...')

      const analyzeResponse = await fetch(`/api/quote-comparison/${comparison.id}/analyze`, {
        method: 'POST',
        keepalive: true,
      })
      const analyzeResult = await analyzeResponse.json().catch(() => ({}))

      if (!analyzeResponse.ok) {
        throw new Error(analyzeResult.error || 'Analiz başlatılamadı')
      }

      showToast('Analiz başladı. Sayfadan ayrılsanız da işlem devam eder.', 'success')
      router.push(`/dashboard/quote-comparison/${comparison.id}`)
    } catch (error: any) {
      console.error('Quote comparison creation failed:', error)
      showToast(error?.message || 'Bir hata oluştu', 'error')

      // Analiz aşamasına ulaşıldıysa kayıt zaten oluştu; kullanıcıyı detay sayfasına
      // yönlendirip oradan tekrar denemesine izin ver. Daha erken bir aşamada
      // (oluşturma/yükleme) başarısız olduysa taslağı silmeye çalışma - kullanıcı
      // listeden manuel silebilir.
      if (createdComparisonId) {
        router.push(`/dashboard/quote-comparison/${createdComparisonId}`)
      }
    } finally {
      setIsSubmitting(false)
      setProgressLabel('')
    }
  }

  const offerCountLabel =
    uploads.length === 0
      ? `En az ${MIN_OFFERS} teklif PDF'i yükleyin`
      : uploads.length < MIN_OFFERS
        ? `${uploads.length}/${MIN_OFFERS} teklif · en az ${MIN_OFFERS} adet gerekli`
        : `${uploads.length} teklif eklendi`

  return (
    <div className="w-full space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3 text-gray-500 hover:text-gray-900">
          <a href="/dashboard/quote-comparison">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </a>
        </Button>
        <h1 className="text-3xl font-semibold text-gray-900 pb-3 border-b-2 border-[#00E676] inline-block">
          Yeni Teklif Karşılaştırması
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Aynı malzeme için alınan tedarikçi tekliflerini PDF olarak yükleyin, sistem özellik bazında
          karşılaştırıp en optimum teklifi önersin.
        </p>
      </div>

      <div className="w-full rounded-2xl border border-gray-200/60 bg-white p-6 sm:p-7 shadow-sm space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="qc-title" className="text-sm font-medium text-gray-700">
              Başlık <span className="text-[#00c46a]">*</span>
            </Label>
            <Input
              id="qc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Su Deposu Teklif Karşılaştırması"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl border-gray-200 placeholder:text-gray-300 focus-visible:border-gray-400 focus-visible:ring-gray-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-project" className="text-sm font-medium text-gray-700">
              Proje Adı <span className="text-gray-400 font-normal">(opsiyonel)</span>
            </Label>
            <Input
              id="qc-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Örn. Four Seasons Şantiyesi"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl border-gray-200 placeholder:text-gray-300 focus-visible:border-gray-400 focus-visible:ring-gray-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-material" className="text-sm font-medium text-gray-700">
              Malzeme / Konu <span className="text-gray-400 font-normal">(opsiyonel)</span>
            </Label>
            <Input
              id="qc-material"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="Örn. PVC Membran Kaplı Su Tankı"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl border-gray-200 placeholder:text-gray-300 focus-visible:border-gray-400 focus-visible:ring-gray-200"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-gray-700">
              Teklif PDF'leri <span className="text-[#00c46a]">*</span>
            </Label>
            <span className="text-xs text-gray-400">{offerCountLabel}</span>
          </div>
          <UploadDropzone items={uploads} onItemsChange={setUploads} disabled={isSubmitting} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
          {isSubmitting && progressLabel && (
            <p className="text-xs text-gray-500 flex-1 flex items-center gap-2">
              <InlineLoading className="!w-3.5 !h-3.5" />
              {progressLabel}
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-11 px-5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white"
          >
            {isSubmitting ? (
              <InlineLoading className="!w-4 !h-4" />
            ) : (
              <DlxAiLogo className="h-4" />
            )}
            {isSubmitting ? 'İşleniyor...' : 'Karşılaştırmayı Başlat'}
          </Button>
        </div>
      </div>
    </div>
  )
}
