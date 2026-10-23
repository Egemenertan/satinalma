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
import { Check, Loader2, Search, UserMinus } from 'lucide-react'
import { releaseInventoryAssignments } from '@/services/zimmet.service'
import {
  assignmentRowsFromInventory,
  loadEmployeeActiveInventory,
  type Employee,
} from './ZimmetReportModal'

interface TerminationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onCompleted: () => void
}

export function TerminationModal({ open, onOpenChange, showToast, onCompleted }: TerminationModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId('')
      setEmployeeSearch('')
      return
    }

    const load = async () => {
      setLoadingList(true)
      try {
        const { data, error } = await createClient()
          .from('employees')
          .select('id, first_name, work_email, personal_email')
          .order('first_name')
        if (error) throw error
        setEmployees(data || [])
      } catch (error) {
        console.error(error)
        showToast('Çalışan listesi yüklenemedi', 'error')
      } finally {
        setLoadingList(false)
      }
    }

    void load()
  }, [open, showToast])

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLocaleLowerCase('tr')
    if (query.length < 1) return []
    return employees
      .filter((employee) => {
        const haystack = [employee.first_name, employee.work_email, employee.personal_email]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr')
        return haystack.includes(query)
      })
      .slice(0, 12)
  }, [employees, employeeSearch])

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId)

  const handleTerminate = async () => {
    if (!selectedEmployee) {
      showToast('Lütfen bir çalışan seçin', 'error')
      return
    }

    setWorking(true)
    try {
      const matched = await loadEmployeeActiveInventory(selectedEmployee)
      if (matched.length === 0) {
        showToast(`${selectedEmployee.first_name || 'Çalışan'} üzerinde aktif zimmet yok`, 'info')
        return
      }

      const tableRows = await assignmentRowsFromInventory(matched)
      await releaseInventoryAssignments(
        matched.map((row) => {
          const item = row as {
            id: string
            product_id: string | null
            quantity: number | null
            notes: string | null
            owner_name: string | null
            owner_email: string | null
            source_warehouse_id: string | null
            serial_number: string | null
          }
          return item
        })
      )

      try {
        const client = createClient()
      const { data: authData } = await client.auth.getUser()
      const user = authData?.user
      let exportedByDisplayName = user?.email ?? '—'
      let exportedByEmail = user?.email ?? undefined
      if (user?.id) {
        const { data: profile } = await client
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.full_name?.trim()) exportedByDisplayName = profile.full_name.trim()
        else if (profile?.email) exportedByDisplayName = profile.email
        exportedByEmail = profile?.email || user.email || undefined
      }

      const safeName = (selectedEmployee.first_name || 'calisan')
        .replace(/[/\\?%*:|"<>]/g, '')
        .slice(0, 40)
      const payload = {
        docTitleSuffix: `İlişki kesme — ${safeName}`,
        titleMain: 'İLİŞKİ KESME TUTANAĞI',
        titleSub: 'Personelin üzerindeki zimmetler kaynak depolara iade edilmiştir',
        assignedPersonName: selectedEmployee.first_name || 'Çalışan',
        assignedPersonEmailLine: [selectedEmployee.work_email, selectedEmployee.personal_email]
          .filter(Boolean)
          .join(' · '),
        exportedByDisplayName,
        exportedByEmail,
        generatedAtLabel: new Date().toLocaleString('tr-TR'),
        warehouseScopeLine: 'Her kalem kendi kaynak deposunda boşa düşmüştür',
        rowCountNote: `${tableRows.length} ürün satırı iade edilmiştir`,
        rows: tableRows,
        heading: 'İade edilen zimmetler',
        signLeftRole: 'Teslim alan',
        signRightRole: 'İlişkisi kesilen personel',
        signRightNote: 'Yukarıdaki beyanı imzamla kabul ederim.',
        footerNote: 'İlişki kesme tutanağı — Satın Alma / Envanter — Dovec',
        declaration:
          'İşbu tutanak ile, uhdemde bulunan ve yukarıda dökümü verilen tüm malzeme ve ürünleri eksiksiz, sağlam ve kullanıma elverişli halde ilgili birime iade ettiğimi; zimmetimde başkaca şirket malı kalmadığını beyan ve kabul ederim.',
      }
      const { groupInventoryBySite, inventoryWarehouseName, recordZimmetOperation } = await import(
        '@/services/zimmet-operations.service'
      )
      const personName = selectedEmployee.first_name || 'Çalışan'
      for (const [siteId, group] of groupInventoryBySite(matched)) {
        const siteRows = await assignmentRowsFromInventory(group)
        const warehouseName = inventoryWarehouseName(group[0])
        await recordZimmetOperation({
          operationType: 'termination',
          personName,
          personEmail: selectedEmployee.work_email,
          siteId,
          snapshot: {
            ...payload,
            rows: siteRows,
            warehouseScopeLine: `Kaynak depo: ${warehouseName}`,
            rowCountNote: `${siteRows.length} ürün satırı iade edilmiştir`,
          },
        })
      }
      const { downloadZimmetAssignmentListPdf } = await import('@/lib/pdf/zimmetAssignmentListPdf')
      await downloadZimmetAssignmentListPdf(payload)

      showToast(`${selectedEmployee.first_name || 'Kişi'} zimmetleri boşa düştü. Tutanak indirildi.`, 'success')
      } catch (pdfError) {
        console.error(pdfError)
        showToast('Zimmetler boşa düştü ancak tutanak indirilemedi', 'error')
      }
      onCompleted()
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      showToast('İlişki kesme tamamlanamadı', 'error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <UserMinus className="h-6 w-6" />
            İlişki kes
          </DialogTitle>
          <p className="pt-1 text-sm text-gray-500">
            Seçilen kişinin tüm aktif zimmetleri kaynak depolarında boşta kalır ve ilişki kesme tutanağı iner.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label className="text-sm font-medium text-gray-900">Çalışan</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="İsim veya e-posta ile ara..."
              disabled={loadingList || working}
              className="h-11 rounded-xl border-gray-200 bg-white pl-10"
            />
          </div>
          {selectedEmployee && (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{selectedEmployee.first_name || '—'}</p>
                <p className="truncate text-xs text-gray-500">{selectedEmployee.work_email || '—'}</p>
              </div>
              <Check className="h-5 w-5 shrink-0" />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white">
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yükleniyor...
              </div>
            ) : employeeSearch.trim().length < 1 ? (
              <p className="px-3 py-8 text-center text-sm text-gray-500">Kişi arayın</p>
            ) : filteredEmployees.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-gray-500">Çalışan bulunamadı</p>
            ) : (
              filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
          selectedEmployeeId === employee.id ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {employee.first_name || '—'}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{employee.work_email || '—'}</span>
                  </span>
                  {selectedEmployeeId === employee.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={working}>
            İptal
          </Button>
          <Button
            onClick={() => void handleTerminate()}
            disabled={!selectedEmployeeId || working}
            className="rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
          >
            {working ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                İşleniyor...
              </>
            ) : (
              'İlişkiyi kes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
