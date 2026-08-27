'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ReanalyzePanelProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  disabled?: boolean
}

export function ReanalyzePanel({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  disabled,
}: ReanalyzePanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-3">
      <div>
        <Label htmlFor="qc-priority-criteria" className="text-base font-semibold text-gray-900">
          Önem verdiğiniz özellikler
        </Label>
        <p className="text-sm text-gray-500 mt-1.5 leading-6">
          Sistemin ilk önerisinde gözden kaçırmış olabileceğiniz birincil kriterleri yazın (ör.{' '}
          <span className="text-gray-700">teslimat 2 haftayı geçmesin, montaj dahil olsun, paslanmaz malzeme</span>
          ). Bu maddelere daha fazla ağırlık verilir; yine de tüm teklifler detaylı karşılaştırılır. Önceliği
          karşılamayan bir teklif diğer birçok özellikte belirgin üstünse yine önerilebilir — gerekçede bu ödün
          açıkça yazılır.
        </p>
      </div>
      <Textarea
        id="qc-priority-criteria"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isSubmitting}
        maxLength={2000}
        rows={4}
        placeholder="Örn: Birincil öncelik teslimat süresi. Garanti ve montaj dahil olması da önemli. Fiyat ikincil."
        className="min-h-[108px] resize-y rounded-xl border-gray-200 bg-white text-base text-gray-900 placeholder:text-gray-400"
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400">{value.trim().length}/2000</p>
        <Button
          onClick={onSubmit}
          disabled={disabled || isSubmitting}
          className="bg-neutral-950 hover:bg-neutral-800 text-white"
        >
          <RotateCcw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
          {isSubmitting ? 'Analiz başlatılıyor...' : 'Analizi tekrar yap'}
        </Button>
      </div>
    </div>
  )
}
