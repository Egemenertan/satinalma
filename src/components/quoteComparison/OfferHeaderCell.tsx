'use client'

import { FileText, Mail, Phone, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QUOTE_COMPARISON_STORAGE_BUCKET, type QuoteComparisonOffer } from '@/types/quoteComparison'

export function offerDisplayName(offer: QuoteComparisonOffer): string {
  return offer.supplier_name?.trim() || offer.extracted_data?.supplier_name?.trim() || offer.file_name
}

export function getOfferFileUrl(filePath: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(QUOTE_COMPARISON_STORAGE_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

interface OfferHeaderCellProps {
  offer: QuoteComparisonOffer
  recommended: boolean
  /** Tedarikçi yetkilisi/telefon/e-posta gösterilsin mi (varsayılan: evet, veri varsa). */
  showContact?: boolean
}

/**
 * Karşılaştırma tablolarının (kalem fiyatı, ticari şartlar, teknik özellik) hepsinde
 * aynı görünen tedarikçi başlık içeriği: ad, "Önerilen" rozeti, iletişim bilgisi, dosya linki.
 */
export function OfferHeaderCell({ offer, recommended, showContact = true }: OfferHeaderCellProps) {
  const extracted = offer.extracted_data
  const contactPerson = extracted?.supplier_contact_person?.trim()
  const phone = extracted?.supplier_phone?.trim()
  const email = extracted?.supplier_email?.trim()
  const hasContact = showContact && Boolean(contactPerson || phone || email)

  return (
    <>
      {recommended && <span className="inline-block text-[11px] font-bold text-[#00c853] mb-1">Önerilen</span>}
      <div className="text-[14px] font-bold tracking-tight text-neutral-950 leading-snug">{offerDisplayName(offer)}</div>
      {hasContact && (
        <div className="mt-1.5 space-y-0.5">
          {contactPerson && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-600">
              <User className="w-3 h-3 shrink-0 text-neutral-400" />
              <span className="truncate max-w-[160px]">{contactPerson}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
              <Phone className="w-3 h-3 shrink-0 text-neutral-400" />
              <span className="truncate max-w-[160px]">{phone}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-1 text-[11px] text-neutral-500">
              <Mail className="w-3 h-3 shrink-0 text-neutral-400" />
              <span className="truncate max-w-[160px]">{email}</span>
            </div>
          )}
        </div>
      )}
      <a
        href={getOfferFileUrl(offer.file_path)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <FileText className="w-3 h-3" />
        <span className="truncate max-w-[160px]">{offer.file_name}</span>
      </a>
    </>
  )
}
