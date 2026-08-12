'use client'

import { useState } from 'react'
import {
  User,
  Building2,
  Loader2,
  Undo2,
  ArrowRightLeft,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  type ActiveZimmetRow,
  type EmployeeOption,
} from '@/services/zimmet.service'

type ZimmetRow = ActiveZimmetRow & {
  user?: { full_name?: string; email?: string } | null
}

interface ZimmetManagePanelProps {
  productId: string
  productUnit?: string
  zimmets: ZimmetRow[]
  loading?: boolean
  onChanged?: () => void
  /** Kompakt: stok işlemleri formu içi */
  compact?: boolean
}

export function ZimmetManagePanel({
  productId,
  productUnit = 'adet',
  zimmets,
  loading = false,
  onChanged,
  compact = false,
}: ZimmetManagePanelProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [changeTarget, setChangeTarget] = useState<ZimmetRow | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ZimmetRow | null>(null)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  const displayName = (row: ZimmetRow) =>
    row.owner_name || row.user?.full_name || 'İsimsiz'
  const displayEmail = (row: ZimmetRow) =>
    row.owner_email || row.user?.email || ''

  const openChange = async (row: ZimmetRow) => {
    setChangeTarget(row)
    setSelectedEmployeeId('')
    setActionError(null)
    setLoadingEmployees(true)
    try {
      setEmployees(await fetchEmployeesForZimmet())
    } catch (e: any) {
      setActionError(e?.message || 'Çalışan listesi yüklenemedi')
    } finally {
      setLoadingEmployees(false)
    }
  }

  const confirmChange = async () => {
    if (!changeTarget || !selectedEmployeeId) return
    const emp = employees.find((e) => e.id === selectedEmployeeId)
    if (!emp) return

    try {
      setActionLoadingId(changeTarget.id)
      setActionError(null)
      await changeZimmetAssignment({
        inventoryId: changeTarget.id,
        newEmployee: emp,
      })
      setChangeTarget(null)
      onChanged?.()
    } catch (e: any) {
      setActionError(e?.message || 'Zimmet değiştirilemedi')
    } finally {
      setActionLoadingId(null)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    try {
      setActionLoadingId(removeTarget.id)
      setActionError(null)
      await removeZimmetAssignment({
        inventoryId: removeTarget.id,
        productId,
      })
      setRemoveTarget(null)
      onChanged?.()
    } catch (e: any) {
      setActionError(e?.message || 'Zimmet kaldırılamadı')
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <>
      <div
        className={
          compact
            ? 'rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden'
            : 'rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden'
        }
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Mevcut zimmetler</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Sorumluluk kaydı · depo stoğu değişmez
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
            {zimmets.length} kayıt
          </span>
        </div>

        <div className="p-4 space-y-3">
          {actionError && !changeTarget && !removeTarget && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Yükleniyor…
            </div>
          ) : zimmets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">Bu ürün için aktif zimmet yok.</p>
            </div>
          ) : (
            zimmets.map((row) => {
              const busy = actionLoadingId === row.id
              return (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                      <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {displayName(row)}
                      </p>
                      {displayEmail(row) && (
                        <p className="text-xs text-gray-500 truncate">{displayEmail(row)}</p>
                      )}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 px-2 py-0.5">
                          <Building2 className="h-3 w-3 text-gray-500" />
                          {row.source_warehouse?.name || 'Depo'}
                        </span>
                        <span className="font-medium text-gray-800">
                          {Number(row.quantity).toLocaleString('tr-TR')} {productUnit}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => openChange(row)}
                      className="h-9 rounded-xl border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Değiştir
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setActionError(null)
                        setRemoveTarget(row)
                      }}
                      className="h-9 rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Kaldır
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Değiştir */}
      <Dialog
        open={!!changeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setChangeTarget(null)
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
                  ? `${displayName(changeTarget)} yerine yeni çalışan seçin. Depo stoğu aynı kalır.`
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
                </div>
              )}

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
                onClick={() => setChangeTarget(null)}
                className="rounded-full px-5 border-gray-200 bg-white"
              >
                İptal
              </Button>
              <Button
                type="button"
                disabled={!selectedEmployeeId || !!actionLoadingId}
                onClick={confirmChange}
                className="rounded-full px-6 bg-gray-900 text-white hover:bg-gray-800"
              >
                {actionLoadingId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Kaydediliyor
                  </>
                ) : (
                  'Zimmeti aktar'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kaldır */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
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
                Sorumluluk kaydı kapanır. Ürün depoda kalmaya devam eder.
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
                    {Number(removeTarget.quantity).toLocaleString('tr-TR')} {productUnit}
                  </p>
                </div>
              )}

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
                onClick={() => setRemoveTarget(null)}
                className="rounded-full px-5 border-gray-200 bg-white"
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                disabled={!!actionLoadingId}
                onClick={confirmRemove}
                className="rounded-full px-6 bg-red-600 text-white hover:bg-red-700"
              >
                {actionLoadingId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Kaldırılıyor
                  </>
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
