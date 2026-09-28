'use client'

import { useState } from 'react'
import {
  formatContractMoney,
  formatContractQty,
  type ContractOverview,
} from '@/lib/contracts'
import { updateContractBudget } from '@/services/contracts.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const

interface ContractBudgetSummaryProps {
  contract: ContractOverview
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void
  onBudgetSaved?: () => void
}

export function ContractBudgetSummary({
  contract,
  showToast,
  onBudgetSaved,
}: ContractBudgetSummaryProps) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(contract.budget_currency || 'TRY')
  const [saving, setSaving] = useState(false)

  const budget = contract.budget_amount
  const invoicedInBudget =
    contract.invoiced_amounts.find((row) => row.currency === contract.budget_currency)?.amount || 0
  const otherInvoices = contract.invoiced_amounts.filter((row) => row.currency !== contract.budget_currency)
  const remainingBudget = budget == null ? null : Math.max(0, budget - invoicedInBudget)
  const ratio = budget && budget > 0 ? Math.min(100, Math.round((invoicedInBudget / budget) * 100)) : 0

  const saveBudget = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      showToast?.('Geçerli bir bütçe girin', 'error')
      return
    }
    setSaving(true)
    try {
      await updateContractBudget(contract.id, value, currency)
      showToast?.('Sözleşme bütçesi kaydedildi', 'success')
      setAmount('')
      onBudgetSaved?.()
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : 'Bütçe kaydedilemedi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-elegant-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
            Sözleşme bütçesi
          </p>
          <h3 className="mt-1 text-base font-semibold text-elegant-black">
            {contract.title || 'Toplu alım sözleşmesi'}
          </h3>
        </div>
        {budget != null && (
          <p className="text-right text-sm text-elegant-gray-600">
            Kalan bütçe
            <span className="mt-0.5 block text-lg font-semibold tabular-nums text-elegant-black">
              {formatContractMoney(remainingBudget || 0, contract.budget_currency)}
            </span>
          </p>
        )}
      </div>

      {budget == null ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-elegant-gray-600">
            Bu sözleşmenin bütçesi yok. Faturalar bütçe üzerinden izlenir.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Bütçe tutarı"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 rounded-xl border-elegant-gray-200 bg-elegant-gray-50"
            />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-11 w-full rounded-xl border-elegant-gray-200 bg-elegant-gray-50 sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={saveBudget}
              disabled={saving}
              className="h-11 rounded-xl bg-elegant-black text-white hover:bg-elegant-gray-800"
            >
              {saving ? 'Kaydediliyor' : 'Bütçeyi kaydet'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Bütçe" value={formatContractMoney(budget, contract.budget_currency)} />
            <Metric
              label="Kesilen fatura"
              value={formatContractMoney(invoicedInBudget, contract.budget_currency)}
            />
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-elegant-gray-500">
              <span>Bütçe kullanımı</span>
              <span>%{ratio}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-elegant-gray-100">
              <div className="h-full rounded-full bg-[#01E884]" style={{ width: `${ratio}%` }} />
            </div>
          </div>
          <p className="mt-3 text-sm text-elegant-gray-700">
            Bu sözleşmeye ait şu ana kadar{' '}
            <span className="font-semibold text-elegant-black">
              {formatContractMoney(invoicedInBudget, contract.budget_currency)}
            </span>{' '}
            fatura kesildi.
          </p>
          {otherInvoices.length > 0 && (
            <p className="mt-1 text-xs text-elegant-gray-500">
              Diğer para birimleri:{' '}
              {otherInvoices.map((row) => formatContractMoney(row.amount, row.currency)).join(' · ')}
            </p>
          )}
        </>
      )}

      <div className="mt-5 border-t border-elegant-gray-100 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
          Bekleyen siparişler
        </p>
        {contract.pending_orders.length === 0 ? (
          <p className="mt-2 text-sm text-elegant-gray-500">
            İrsaliyesi bekleyen sipariş yok. Sipariş verilince burada beklemede görünür; miktar irsaliye yüklenince düşer.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-elegant-gray-100">
            {contract.pending_orders.map((order) => (
              <li key={order.order_id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-elegant-black">
                    {order.order_number} · {order.material_name}
                  </p>
                  <p className="text-xs text-elegant-gray-500">
                    Sipariş {formatContractQty(order.ordered_quantity, order.unit)}
                    {order.delivered_quantity > 0
                      ? ` · teslim ${formatContractQty(order.delivered_quantity, order.unit)}`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-elegant-gray-100 px-2.5 py-1 text-[11px] font-semibold text-elegant-gray-700">
                  Beklemede · {formatContractQty(order.pending_quantity, order.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elegant-gray-50 px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-elegant-black">{value}</div>
    </div>
  )
}
