/**
 * Depo çıkışlı (source_warehouse_id dolu) zimmet kayıtlarını çalışana göre PDF (yazdır) olarak çıkarır.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Check, FileText, Loader2, Search, User } from 'lucide-react'
import {
  buildDovecGroupWorkEmailFromDisplayName,
} from '@/lib/dovec-work-email'

interface Employee {
  id: string
  first_name: string | null
  work_email: string | null
  personal_email: string | null
}

export interface ZimmetReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  /** Doluysa yalnızca bu depo/site için kaynaklanan zimmetler */
  sourceWarehouseId?: string
  warehouseLabel?: string
}

function normEmail(v: string | null | undefined) {
  return (v || '').trim().toLowerCase()
}

/** @dovecgroup ↔ @dovecgroup.com typo varyantları */
function expandDovecEmailDomainVariants(email: string): string[] {
  const n = normEmail(email)
  if (!n || !n.includes('@')) return []
  const at = n.lastIndexOf('@')
  const local = n.slice(0, at)
  const domain = n.slice(at + 1)
  if (!local) return [n]
  const out = new Set<string>([n])
  if (domain === 'dovecgroup') out.add(`${local}@dovecgroup.com`)
  if (domain === 'dovecgroup.com') out.add(`${local}@dovecgroup`)
  return [...out]
}

/** Rapor DB filtresi: çalışanın tüm olası e-postaları (+ domain varyantları, küçük harf) */
function buildReportEmailCandidates(employee: Employee): string[] {
  const set = new Set<string>()
  const add = (v: string | null | undefined) => {
    const n = normEmail(v)
    if (!n) return
    for (const x of expandDovecEmailDomainVariants(n)) set.add(x)
  }
  add(employee.work_email)
  add(employee.personal_email)
  add(buildDovecGroupWorkEmailFromDisplayName(employee.first_name || ''))
  return [...set]
}

/**
 * PostgREST: nokta / @ içeren değerler için ilike + çift tırnak (büyük/küçük harf duyarsız tam eşleşme).
 */
function buildOwnerEmailOrIlikeClause(emails: string[]): string {
  return emails
    .filter(Boolean)
    .map((e) => {
      const escaped = normEmail(e).replace(/\\/g, '\\\\').replace(/"/g, '""')
      return `owner_email.ilike."${escaped}"`
    })
    .join(',')
}

/** employees.work_email / personal_email / isimden türetilen e-posta ile profiles.id */
async function resolveProfileIdForEmployee(employee: Employee) {
  const client = createClient()
  const candidates = [employee.work_email, employee.personal_email].map(normEmail).filter(Boolean)
  for (const em of candidates) {
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .ilike('email', em)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('Profil eşlemesi:', error.message)
      continue
    }
    if (data?.id) return data.id
  }
  const fromDisplay = normEmail(buildDovecGroupWorkEmailFromDisplayName(employee.first_name || ''))
  if (fromDisplay) {
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .ilike('email', fromDisplay)
      .limit(1)
      .maybeSingle()
    if (!error && data?.id) return data.id
  }
  return undefined
}

const INVENTORY_SELECT = `
  id,
  product_id,
  quantity,
  unit,
  assigned_date,
  owner_name,
  owner_email,
  user_id,
  source_warehouse_id,
  notes,
  serial_number,
  products!user_inventory_product_id_fkey(
    name,
    sku,
    unit,
    product_type,
    brand:brands(name)
  ),
  warehouse:sites!user_inventory_source_warehouse_id_fkey(name)
`

const PRODUCT_TYPE_TR: Record<string, string> = {
  demirbas: 'Demirbaş',
  sarf_malzeme: 'Sarf Malzeme',
  kontrol_sarf: 'Kontrol Sarf',
}

export function ZimmetReportModal({
  open,
  onOpenChange,
  showToast,
  sourceWarehouseId,
  warehouseLabel,
}: ZimmetReportModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId('')
      setEmployeeSearch('')
      return
    }

    const client = createClient()

    const load = async () => {
      setLoadingList(true)
      try {
        const { data, error } = await client
          .from('employees')
          .select('id, first_name, work_email, personal_email')
          .order('first_name')

        if (error) throw error
        setEmployees(data || [])
      } catch (e) {
        console.error(e)
        showToast('Çalışan listesi yüklenemedi', 'error')
      } finally {
        setLoadingList(false)
      }
    }

    void load()
  }, [open, showToast])

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => {
      const name = (e.first_name || '').toLowerCase()
      const mail = (e.work_email || '').toLowerCase()
      const pers = (e.personal_email || '').toLowerCase()
      return name.includes(q) || mail.includes(q) || pers.includes(q)
    })
  }, [employees, employeeSearch])

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  const handleExport = async () => {
    if (!selectedEmployee) {
      showToast('Lütfen bir çalışan seçin', 'error')
      return
    }

    setExporting(true)
    try {
      const client = createClient()
      const emailCandidates = buildReportEmailCandidates(selectedEmployee)
      const profileId = await resolveProfileIdForEmployee(selectedEmployee)

      if (emailCandidates.length === 0 && !profileId) {
        showToast('Bu çalışan için e-posta veya profil eşlemesi yok; rapor alınamıyor.', 'error')
        return
      }

      const byId = new Map<string, Record<string, unknown>>()

      if (emailCandidates.length > 0) {
        let q = client
          .from('user_inventory')
          .select(INVENTORY_SELECT)
          .eq('status', 'active')
          .not('source_warehouse_id', 'is', null)
          .or(buildOwnerEmailOrIlikeClause(emailCandidates))

        if (sourceWarehouseId) {
          q = q.eq('source_warehouse_id', sourceWarehouseId)
        }

        const { data, error } = await q.order('assigned_date', { ascending: false }).limit(5000)
        if (error) throw error
        for (const r of data || []) byId.set((r as { id: string }).id, r as Record<string, unknown>)
      }

      if (profileId) {
        let q2 = client
          .from('user_inventory')
          .select(INVENTORY_SELECT)
          .eq('status', 'active')
          .not('source_warehouse_id', 'is', null)
          .eq('user_id', profileId)

        if (sourceWarehouseId) {
          q2 = q2.eq('source_warehouse_id', sourceWarehouseId)
        }

        const { data: d2, error: e2 } = await q2.order('assigned_date', { ascending: false }).limit(5000)
        if (e2) throw e2
        for (const r of d2 || []) byId.set((r as { id: string }).id, r as Record<string, unknown>)
      }

      const matched = [...byId.values()] as any[]

      if (matched.length === 0) {
        showToast(
          warehouseLabel
            ? `${selectedEmployee.first_name || 'Çalışan'} için bu depoda kayıt bulunamadı`
            : `${selectedEmployee.first_name || 'Çalışan'} için depo zimmeti bulunamadı`,
          'info'
        )
        return
      }

      const { data: authData } = await client.auth.getUser()
      const user = authData?.user
      let exportedByDisplayName = user?.email ?? '—'
      let exportedByEmail: string | undefined = user?.email ?? undefined
      if (user?.id) {
        const { data: prof } = await client
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle()
        if (prof?.full_name?.trim()) exportedByDisplayName = prof.full_name.trim()
        else if (prof?.email) exportedByDisplayName = prof.email
        exportedByEmail = prof?.email || user.email || undefined
      }

      const filterNote =
        [
          'user_inventory: status=aktif; source_warehouse_id dolu; owner_email eşlemesi VEYA kullanıcı profili (profiles.id=user_id)',
          profileId ? `profiles.id: ${profileId}` : 'profiles.id: eşlenmedi',
          `E-posta adayları (owner): ${emailCandidates.join('; ') || '—'}`,
        ].join(' · ')

      const tableRows = matched.map((r: any) => {
        const p = r.products
        const brandName = Array.isArray(p?.brand) ? p.brand[0]?.name : p?.brand?.name
        const wh = r.warehouse
        const whName = Array.isArray(wh) ? wh[0]?.name : wh?.name
        const ptype = PRODUCT_TYPE_TR[p?.product_type] || p?.product_type || ''
        return {
          ownerEmail:
            (r.owner_email as string) ||
            selectedEmployee.work_email ||
            selectedEmployee.personal_email ||
            '',
          productName: p?.name || r.item_name || '',
          sku: p?.sku || '',
          brand: brandName || '',
          unit: p?.unit || r.unit || '',
          quantity: Number(r.quantity ?? 0),
          productType: ptype,
          sourceWarehouse: whName || '',
          serialNumber: (r.serial_number as string) || '',
        }
      })

      const safeName = (selectedEmployee.first_name || 'calisan')
        .replace(/[/\\?%*:|"<>]/g, '')
        .slice(0, 40)
      const whPart = warehouseLabel
        ? ` · ${warehouseLabel.replace(/[/\\?%*:|"<>]/g, '').slice(0, 24)}`
        : ''
      const docTitle = `Zimmet raporu — ${safeName}${whPart}`

      const { printZimmetAssignmentListPdf } = await import('@/lib/pdf/zimmetAssignmentListPdf')

      await printZimmetAssignmentListPdf({
        docTitleSuffix: docTitle,
        titleMain: 'ZİMMET ENVANTER RAPORU',
        titleSub:
          'Dovec Satın Alma — depodan çıkışlı aktif kullanıcı zimmet özetleri (user_inventory)',
        assignedPersonName: selectedEmployee.first_name || 'Çalışan',
        assignedPersonEmailLine:
          `${selectedEmployee.work_email || ''}${selectedEmployee.personal_email ? ` · ${selectedEmployee.personal_email}` : ''}`.trim(),
        exportedByDisplayName,
        exportedByEmail,
        generatedAtLabel: new Date().toLocaleString('tr-TR'),
        warehouseScopeLine: warehouseLabel
          ? `Kaynak depo / site filtresi: ${warehouseLabel}`
          : 'Tüm kaynak depolar dahil',
        rowCountNote: `${matched.length} zimmet kalemi listelenmiştir`,
        filterNoteTechnical: filterNote.slice(0, 4000),
        rows: tableRows,
      })

      showToast(`PDF yazdırıldı (${matched.length} satır). Kaydet seçeneğiyle PDF alabilirsiniz.`, 'success')
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      showToast('Rapor oluşturulurken hata oluştu', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <FileText className="w-6 h-6 text-emerald-600" />
            Zimmet Raporu (PDF)
          </DialogTitle>
          <p className="text-sm text-gray-500 pt-1">
            Seçilen çalışanın e-postalarına göre{' '}
            <span className="font-medium text-gray-700">user_inventory</span> (aktif, kaynak depolu) filtrelenir.
            {warehouseLabel ? (
              <>
                {' '}
                Depo:{' '}
                <span className="font-medium text-gray-700">{warehouseLabel}</span>.
              </>
            ) : (
              ' Tüm depolar.'
            )}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4" />
              Çalışan <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="İsim veya e-posta ile ara..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                disabled={loadingList}
                className="pl-10 h-11 rounded-xl border-gray-200"
              />
            </div>
            {selectedEmployee && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {(selectedEmployee.first_name || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {selectedEmployee.first_name || '—'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedEmployee.work_email || '—'}
                  </p>
                </div>
                <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              </div>
            )}
            <div className="border border-gray-200 rounded-xl max-h-52 overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-10 text-gray-500 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Yükleniyor...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Çalışan bulunamadı</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredEmployees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className={`w-full p-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                        selectedEmployeeId === employee.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          selectedEmployeeId === employee.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {(employee.first_name || '?').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {employee.first_name || '—'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{employee.work_email || '—'}</p>
                      </div>
                      {selectedEmployeeId === employee.id && (
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            İptal
          </Button>
          <Button
            onClick={() => void handleExport()}
            disabled={!selectedEmployeeId || exporting}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Hazırlanıyor...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                PDF al
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
