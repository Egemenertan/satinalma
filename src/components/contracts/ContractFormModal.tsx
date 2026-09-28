'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { CONTRACT_UNITS, type CreateContractItemInput } from '@/lib/contracts'
import { createSupplierContract } from '@/services/contracts.service'
import { Plus, Trash2 } from 'lucide-react'

type LineItem = CreateContractItemInput

const emptyLine = (): LineItem => ({
  material_class: '',
  material_group: '',
  material_item: '',
  unit: 'Kg',
  unit_price: 0,
  currency: 'TRY',
  contracted_quantity: 0,
})

const fieldClass =
  'h-12 w-full rounded-xl border-elegant-gray-200 bg-elegant-gray-50 px-3 text-base text-elegant-black shadow-none placeholder:text-elegant-gray-400 focus-visible:ring-1 focus-visible:ring-elegant-black data-[size=default]:h-12 sm:text-sm'

const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500'

interface ContractFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName?: string
  onCreated?: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function ContractFormModal({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  onCreated,
  showToast,
}: ContractFormModalProps) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [contractNo, setContractNo] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState('TRY')
  const [items, setItems] = useState<LineItem[]>([emptyLine()])
  const [classes, setClasses] = useState<string[]>([])
  const [groupsByIndex, setGroupsByIndex] = useState<Record<number, string[]>>({})
  const [materialsByIndex, setMaterialsByIndex] = useState<Record<number, string[]>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const loadClasses = async () => {
      const { data, error } = await supabase
        .from('all_materials')
        .select('class')
        .not('class', 'is', null)
        .not('class', 'eq', '')

      if (error) {
        showToast('Malzeme sınıfları yüklenemedi', 'error')
        return
      }
      setClasses(Array.from(new Set((data || []).map((row) => row.class).filter(Boolean))).sort())
    }
    void loadClasses()
  }, [open, showToast, supabase])

  const reset = () => {
    setTitle('')
    setContractNo('')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setBudgetAmount('')
    setBudgetCurrency('TRY')
    setItems([emptyLine()])
    setGroupsByIndex({})
    setMaterialsByIndex({})
  }

  const loadGroups = async (index: number, materialClass: string) => {
    const { data } = await supabase
      .from('all_materials')
      .select('group')
      .eq('class', materialClass)
      .not('group', 'is', null)

    setGroupsByIndex((prev) => ({
      ...prev,
      [index]: Array.from(new Set((data || []).map((row) => row.group).filter(Boolean) as string[])).sort(),
    }))
  }

  const loadItems = async (index: number, materialClass: string, materialGroup: string) => {
    const { data } = await supabase
      .from('all_materials')
      .select('item_name')
      .eq('class', materialClass)
      .eq('group', materialGroup)
      .not('item_name', 'is', null)

    setMaterialsByIndex((prev) => ({
      ...prev,
      [index]: Array.from(new Set((data || []).map((row) => row.item_name).filter(Boolean) as string[])).sort(),
    }))
  }

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const handleSave = async () => {
    const validItems = items.filter((item) => item.material_item && item.unit && item.contracted_quantity > 0)
    if (validItems.length === 0) {
      showToast('En az bir sözleşme kalemi ekleyin (malzeme ve miktar)', 'error')
      return
    }
    if (!endDate) {
      showToast('Sözleşme bitiş tarihi gerekli', 'error')
      return
    }
    const budget = Number(budgetAmount)
    if (!Number.isFinite(budget) || budget <= 0) {
      showToast('Sözleşme bütçesi gerekli', 'error')
      return
    }

    setSaving(true)
    try {
      await createSupplierContract({
        supplier_id: supplierId,
        title: title || `${supplierName || 'Tedarikçi'} sözleşmesi`,
        contract_no: contractNo,
        start_date: startDate,
        end_date: endDate,
        notes,
        budget_amount: budget,
        budget_currency: budgetCurrency,
        items: validItems,
      })
      showToast('Sözleşme kaydedildi', 'success')
      reset()
      onOpenChange(false)
      onCreated?.()
    } catch (error) {
      console.error(error)
      showToast(error instanceof Error ? error.message : 'Sözleşme kaydedilemedi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border sm:border-elegant-gray-200 sm:shadow-2xl"
      >
        <div className="shrink-0 border-b border-elegant-gray-200 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-elegant-gray-500">
                Toplu alım
              </p>
              <DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-elegant-black">
                Sözleşme ekle
              </DialogTitle>
              {supplierName && (
                <p className="mt-1 text-sm text-elegant-gray-600">{supplierName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-elegant-gray-600 hover:bg-elegant-gray-50"
            >
              Kapat
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
              Sözleşme bilgileri
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Başlık</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Çimento çerçeve sözleşmesi"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sözleşme no</label>
                <Input
                  value={contractNo}
                  onChange={(e) => setContractNo(e.target.value)}
                  placeholder="SZL-2026-01"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Başlangıç</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Bitiş</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Bütçe</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bütçe para birimi</label>
                <Select value={budgetCurrency} onValueChange={setBudgetCurrency}>
                  <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-elegant-gray-500">
              Kesilen faturalar bu bütçe üzerinden izlenir. Miktar, irsaliye yüklenince düşer.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-elegant-gray-500">
                Kalemler
              </p>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, emptyLine()])}
                className="inline-flex items-center gap-1 text-sm font-medium text-elegant-black"
              >
                <Plus className="h-4 w-4" />
                Kalem ekle
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="space-y-3 rounded-2xl border border-elegant-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-elegant-black">Kalem {index + 1}</p>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded-full p-2 text-elegant-gray-400 hover:bg-elegant-gray-50 hover:text-elegant-black"
                      aria-label="Kalemi kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Sınıf</label>
                    <Select
                      value={item.material_class}
                      onValueChange={async (value) => {
                        updateItem(index, { material_class: value, material_group: '', material_item: '' })
                        await loadGroups(index, value)
                      }}
                    >
                      <SelectTrigger className={fieldClass}><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={labelClass}>Grup</label>
                    <Select
                      value={item.material_group}
                      disabled={!item.material_class}
                      onValueChange={async (value) => {
                        updateItem(index, { material_group: value, material_item: '' })
                        await loadItems(index, item.material_class, value)
                      }}
                    >
                      <SelectTrigger className={fieldClass}><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        {(groupsByIndex[index] || []).map((group) => (
                          <SelectItem key={group} value={group}>{group}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={labelClass}>Malzeme</label>
                    <Select
                      value={item.material_item}
                      disabled={!item.material_group}
                      onValueChange={(value) => updateItem(index, { material_item: value })}
                    >
                      <SelectTrigger className={fieldClass}><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        {(materialsByIndex[index] || []).map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className={labelClass}>Birim</label>
                    <Select value={item.unit} onValueChange={(value) => updateItem(index, { unit: value })}>
                      <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTRACT_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={labelClass}>Miktar</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      inputMode="decimal"
                      placeholder="0"
                      value={item.contracted_quantity || ''}
                      onChange={(e) => updateItem(index, { contracted_quantity: Number(e.target.value) || 0 })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Birim fiyat</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0"
                      value={item.unit_price || ''}
                      onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) || 0 })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Para birimi</label>
                    <Select
                      value={item.currency || 'TRY'}
                      onValueChange={(value) => updateItem(index, { currency: value })}
                    >
                      <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRY">TRY</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-8">
            <label className={labelClass}>Not</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="İsteğe bağlı açıklama"
              className="min-h-[88px] rounded-xl border-elegant-gray-200 bg-elegant-gray-50 text-base shadow-none focus-visible:ring-1 focus-visible:ring-elegant-black sm:text-sm"
            />
          </section>
        </div>

        <div className="shrink-0 border-t border-elegant-gray-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-elegant-gray-200 sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              className="h-12 rounded-2xl bg-black text-white hover:bg-gray-900 sm:min-w-[180px]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Kaydediliyor...' : 'Sözleşmeyi kaydet'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
