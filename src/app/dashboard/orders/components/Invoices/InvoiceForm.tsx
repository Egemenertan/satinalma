'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumberWithDots } from '../../utils'

interface InvoiceFormProps {
  amount: string
  currency: string
  onAmountChange: (value: string) => void
  onCurrencyChange: (currency: string) => void
}

export function InvoiceForm({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
}: InvoiceFormProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="amount">Fatura Tutarı</Label>
      <div className="flex gap-2">
        <Input
          id="amount"
          type="text"
          placeholder="0,00"
          value={amount}
          onChange={(e) => {
            const formatted = formatNumberWithDots(e.target.value)
            onAmountChange(formatted)
          }}
          className="flex-1"
        />
        <Select value={currency} onValueChange={onCurrencyChange}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="TRY">TRY</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="GBP">GBP</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}





















