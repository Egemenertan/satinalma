'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  changeZimmetAssignment,
  fetchEmployeesForZimmet,
  removeZimmetAssignment,
  type EmployeeOption,
} from '@/services/zimmet.service'

export type ZimmetActionTarget = {
  id: string
  ids?: string[]
  quantity: number
  owner_name?: string | null
  owner_email?: string | null
  user?: { full_name?: string; email?: string } | null
  source_warehouse?: { name?: string } | null
}

interface ZimmetActionDialogsProps {
  productId: string
  productUnit?: string
  changeTarget: ZimmetActionTarget | null
  removeTarget: ZimmetActionTarget | null
  onCloseChange: () => void
  onCloseRemove: () => void
  onSuccess: () => void
}

function displayName(row: ZimmetActionTarget) {
  return row.owner_name || row.user?.full_name || 'İsimsiz'
}

function displayEmail(row: ZimmetActionTarget) {
  return row.owner_email || row.user?.email || ''
}

function maxQty(row: ZimmetActionTarget | null) {
  const n = Number(row?.quantity)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function defaultQty(max: number) {
  if (!(max > 0)) return '1'
  return max <= 1 ? String(max) : '1'
}

function parseQtyInput(raw: string, max: number) {
  const qty = Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false as const, error: 'Geçerli bir adet girin' }
  }
  if (qty > max + 1e-9) {
    return {
      ok: false as const,
      error: `En fazla ${max.toLocaleString('tr-TR')} adet işlem yapılabilir`,
    }
  }
  return { ok: true as const, qty }
}

function ZimmetQuantityField({
  value,
  max,
  unit,
  onChange,
  disabled,
}: {
  value: string
  max: number
  unit: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const parsed = Number(String(value).replace(',', '.'))
  const remaining =
    Number.isFinite(parsed) && parsed > 0 ? Math.max(0, max - parsed) : max

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Adet *
      </Label>
      <Input
        type="number"
        min={max > 0 ? Math.min(1, max) : 0}
        max={max}
        step="0.01"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border-gray-200 bg-white text-lg font-semibold"
      />
      <div className="flex flex-wrap items-center gap-2">
        {max > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange('1')}
            className="h-8 rounded-full px-3 text-xs border-gray-200 bg-white"
          >
            1 {unit}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(String(max))}
          className="h-8 rounded-full px-3 text-xs border-gray-200 bg-white"
        >
          Tümü ({max.toLocaleString('tr-TR')} {unit})
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Üzerinde {max.toLocaleString('tr-TR')} {unit} var. Bu işlemden sonra{' '}
        <span className="font-semibold text-gray-800">
          {remaining.toLocaleString('tr-TR')} {unit}
        </span>{' '}
        kalır.
      </p>
    </div>
  )
}

export function ZimmetActionDialogs({
  productId,
  productUnit = 'adet',
  changeTarget,
  removeTarget,
  onCloseChange,
  onCloseRemove,
  onSuccess,
}: ZimmetActionDialogsProps) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [actionQuantity, setActionQuantity] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const changeMax = maxQty(changeTarget)
  const removeMax = maxQty(removeTarget)

  useEffect(() => {
    if (!changeTarget) return
    setSelectedEmployeeId('')
    setActionError(null)
    setActionQuantity(defaultQty(changeMax))
    setLoadingEmployees(true)
    fetchEmployeesForZimmet()
      .then(setEmployees)
      .catch((e: any) => setActionError(e?.message || 'Çalışan listesi yüklenemedi'))
      .finally(() => setLoadingEmployees(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeTarget?.id])

  useEffect(() => {
    if (!removeTarget) return
    setActionError(null)
    setActionQuantity(defaultQty(removeMax))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeTarget?.id])

  const parsedChange = useMemo(
    () => parseQtyInput(actionQuantity, changeMax || 0),
    [actionQuantity, changeMax]
  )
  const parsedRemove = useMemo(
    () => parseQtyInput(actionQuantity, removeMax || 0),
    [actionQuantity, removeMax]
  )

  const confirmChange = async () => {
    if (!changeTarget || !selectedEmployeeId) return
    const emp = employees.find((e) => e.id === selectedEmployeeId)
    if (!emp) return
    if (!parsedChange.ok) {
      setActionError(parsedChange.error)
      return
    }

    try {
      setSubmitting(true)
      setActionError(null)
      await changeZimmetAssignment({
        inventoryId: changeTarget.id,
        inventoryIds: changeTarget.ids,
        newEmployee: emp,
        quantity: parsedChange.qty,
      })
      onCloseChange()
      onSuccess()
    } catch (e: any) {
      setActionError(e?.message || 'Zimmet değiştirilemedi')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    if (!parsedRemove.ok) {
      setActionError(parsedRemove.error)
      return
    }

    try {
      setSubmitting(true)
      setActionError(null)
      await removeZimmetAssignment({
        inventoryId: removeTarget.id,
        inventoryIds: removeTarget.ids,
        productId,
        quantity: parsedRemove.qty,
      })
      onCloseRemove()
      onSuccess()
    } catch (e: any) {
      setActionError(e?.message || 'Zimmet kaldırılamadı')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog
        open={!!changeTarget}
        onOpenChange={(open) => {
          if (!open) {
            onCloseChange()
            setActionError(null)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[200] bg-black/60"
          className="sm:max-w-md !bg-white !rounded-3xl border border-gray-200 shadow-2xl p-0 gap-0 overflow-hidden z-[210]"
        >
          <div className="bg-white">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 text-left">
              <DialogTitle className="text-xl font-semibold text-gray-900 tracking-tight">
                Zimmeti değiştir
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-1.5">
                {changeTarget
                  ? `${displayName(changeTarget)} üzerindeki adetten istediğiniz kadarını yeni çalışana aktarın. Depo stoğu aynı kalır.`
                  : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4 bg-white">
              {changeTarget && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Mevcut zimmetli
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {displayName(changeTarget)}
                  </p>
                  {displayEmail(changeTarget) && (
                    <p className="text-xs text-gray-500">{displayEmail(changeTarget)}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    {changeTarget.source_warehouse?.name || 'Depo'} ·{' '}
                    {changeMax.toLocaleString('tr-TR')} {productUnit}
                  </p>
                </div>
              )}

              <ZimmetQuantityField
                value={actionQuantity}
                max={changeMax}
                unit={productUnit}
                onChange={setActionQuantity}
                disabled={submitting}
              />

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Yeni zimmetli
                </Label>
                {loadingEmployees ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Çalışanlar yükleniyor…
                  </div>
                ) : (
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 bg-white">
                      <SelectValue placeholder="Çalışan seçin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 !bg-white border border-gray-200 rounded-2xl shadow-xl z-[220]">
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="rounded-xl">
                          {(emp.first_name || 'İsimsiz') +
                            (emp.work_email ? ` · ${emp.work_email}` : '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {actionError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/90 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCloseChange}
                className="rounded-full px-5 border-gray-200 bg-white"
              >
                İptal
              </Button>
              <Button
                type="button"
                disabled={!selectedEmployeeId || submitting || !parsedChange.ok}
                onClick={confirmChange}
                className="rounded-full px-6 bg-gray-900 text-white hover:bg-gray-800"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Kaydediliyor
                  </>
                ) : parsedChange.ok ? (
                  `${parsedChange.qty.toLocaleString('tr-TR')} ${productUnit} aktar`
                ) : (
                  'Zimmeti aktar'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRemove()
            setActionError(null)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[200] bg-black/60"
          className="sm:max-w-md !bg-white !rounded-3xl border border-gray-200 shadow-2xl p-0 gap-0 overflow-hidden z-[210]"
        >
          <div className="bg-white">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 text-left">
              <DialogTitle className="text-xl font-semibold text-gray-900 tracking-tight">
                Zimmeti kaldır
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-1.5">
                İstediğiniz adedi sorumluluktan düşürün. Ürün depoda kalmaya devam eder.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4 bg-white">
              {removeTarget && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {displayName(removeTarget)}
                  </p>
                  {displayEmail(removeTarget) && (
                    <p className="text-xs text-gray-500">{displayEmail(removeTarget)}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    {removeTarget.source_warehouse?.name || 'Depo'} ·{' '}
                    {removeMax.toLocaleString('tr-TR')} {productUnit}
                  </p>
                </div>
              )}

              <ZimmetQuantityField
                value={actionQuantity}
                max={removeMax}
                unit={productUnit}
                onChange={setActionQuantity}
                disabled={submitting}
              />

              {actionError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/90 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCloseRemove}
                className="rounded-full px-5 border-gray-200 bg-white"
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                disabled={submitting || !parsedRemove.ok}
                onClick={confirmRemove}
                className="rounded-full px-6 bg-red-600 text-white hover:bg-red-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Kaldırılıyor
                  </>
                ) : parsedRemove.ok ? (
                  `${parsedRemove.qty.toLocaleString('tr-TR')} ${productUnit} kaldır`
                ) : (
                  'Zimmeti kaldır'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
