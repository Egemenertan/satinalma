export function PurchasingRejectionNote({ reason }: { reason?: string | null }) {
  const text = reason?.trim()
  if (!text) return null
  return (
    <div className="mt-3 rounded-2xl border border-[#FCA5A5] bg-[#FECACA] px-3 py-2">
      <p className="text-xs font-semibold text-[#7F1D1D]">Red nedeni</p>
      <p className="mt-1 text-sm leading-relaxed text-[#7F1D1D] break-words">{text}</p>
    </div>
  )
}
