'use client'

import { Button } from '@/components/ui/button'
import {
  formatContractDate,
  formatContractMoney,
  formatContractQty,
  type ContractItemOverview,
  type ContractOverview,
  type RequestContractBinding,
} from '@/lib/contracts'
import { FileText, Upload } from 'lucide-react'

interface ContractSummaryCardProps {
  contract: ContractOverview
  item: ContractItemOverview
  deliveredForRequest?: number
  remainingForRequest?: number
  compact?: boolean
  showOrderHint?: boolean
  canUploadWaybill?: boolean
  onUploadWaybill?: () => void
}

export function ContractSummaryCard({
  contract,
  item,
  deliveredForRequest,
  remainingForRequest,
  compact = false,
  showOrderHint = false,
  canUploadWaybill = false,
  onUploadWaybill,
}: ContractSummaryCardProps) {
  const usagePct = Math.min(100, Math.round(item.usage_ratio * 100))

  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-elegant-gray-500" />
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Toplu alım sözleşmesi
            </p>
          </div>
          <h3 className="mt-1 text-base font-semibold text-elegant-black">
            {contract.supplier_name}
          </h3>
          <p className="text-sm text-elegant-gray-600">
            {item.material_item}
            {contract.title ? ` · ${contract.title}` : ''}
          </p>
        </div>
        <span className="rounded-full border border-elegant-gray-200 bg-elegant-gray-50 px-2.5 py-1 text-[11px] font-medium text-elegant-gray-700">
          {contract.is_expired ? 'Süresi doldu' : contract.is_expiring_soon ? 'Yakında bitiyor' : 'Aktif'}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <Stat label="Birim fiyat" value={formatContractMoney(item.unit_price, item.currency)} />
        <Stat label="Sözleşmeli" value={formatContractQty(item.contracted_quantity, item.unit)} />
        <Stat
          label="Beklemede"
          value={formatContractQty(
            item.pending_order_quantity > 0 ? item.pending_order_quantity : item.pending_request_quantity,
            item.unit
          )}
        />
        <Stat label="Teslim" value={formatContractQty(item.delivered_quantity, item.unit)} />
        <Stat label="Kalan" value={formatContractQty(item.remaining_quantity, item.unit)} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-elegant-gray-500">
          <span>Kullanım</span>
          <span>%{usagePct}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-elegant-gray-100">
          <div
            className="h-full rounded-full bg-elegant-black"
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-elegant-gray-500">
        Bitiş: {formatContractDate(contract.end_date)}. Miktar yalnızca irsaliye yüklenince düşer.
      </p>

      {(deliveredForRequest != null || remainingForRequest != null) && (
        <p className="mt-1 text-xs text-elegant-gray-600">
          Bu talep: teslim {formatContractQty(deliveredForRequest || 0, item.unit)}
          {remainingForRequest != null ? ` · kalan ${formatContractQty(remainingForRequest, item.unit)}` : ''}
        </p>
      )}

      {showOrderHint && (
        <p className="mt-3 rounded-lg bg-elegant-gray-50 px-3 py-2 text-xs text-elegant-gray-600">
          Bu kalem sözleşmeye bağlı. Sipariş beklemede görünür; miktar irsaliye yüklenince düşer. Fatura, sözleşme bütçesine yazılır.
        </p>
      )}

      {canUploadWaybill && onUploadWaybill && (
        <Button
          onClick={onUploadWaybill}
          className="mt-4 w-full rounded-2xl bg-black text-white hover:bg-gray-900"
        >
          <Upload className="mr-2 h-4 w-4" />
          İrsaliye Yükle
        </Button>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elegant-gray-50 px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-elegant-black">{value}</div>
    </div>
  )
}

export function RequestContractBindingsList({
  bindings,
  showOrderHint,
  canUploadWaybill,
  onUploadWaybill,
}: {
  bindings: RequestContractBinding[]
  showOrderHint?: boolean
  canUploadWaybill?: boolean
  onUploadWaybill?: (binding: RequestContractBinding) => void
}) {
  if (bindings.length === 0) return null

  return (
    <div className="space-y-3">
      {bindings.map((binding) => (
        <ContractSummaryCard
          key={binding.request_item_id}
          contract={binding.contract}
          item={binding.overview}
          deliveredForRequest={binding.delivered_for_request}
          remainingForRequest={binding.remaining_for_request}
          showOrderHint={showOrderHint}
          canUploadWaybill={canUploadWaybill && binding.remaining_for_request > 0}
          onUploadWaybill={onUploadWaybill ? () => onUploadWaybill(binding) : undefined}
        />
      ))}
    </div>
  )
}
