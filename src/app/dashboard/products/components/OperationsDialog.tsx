'use client'

import { useEffect, useState } from 'react'
import { FileText, Loader2, UserMinus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ZimmetAssignmentListPdfPayload } from '@/lib/pdf/zimmetAssignmentListPdf'
import {
  fetchPastTerminationRows,
  fetchStoredZimmetOperations,
  type StoredZimmetOperation,
} from '@/services/zimmet-operations.service'
import { assignmentRowsFromInventory } from './ZimmetReportModal'

interface OperationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTerminate: () => void
  onReport: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

type HistoryItem = {
  id: string
  operationType: 'termination' | 'report' | 'delivery'
  personName: string
  createdAt: string
  itemCount: number
  performedByName: string | null
  snapshot?: ZimmetAssignmentListPdfPayload
  sourceRows?: unknown[]
}

function sameOperation(stored: StoredZimmetOperation, at: string, personName: string) {
  const storedTime = new Date(stored.createdAt).getTime()
  const rowTime = new Date(at).getTime()
  if (!Number.isFinite(storedTime) || !Number.isFinite(rowTime)) return false
  return (
    stored.operationType === 'termination' &&
    stored.personName.trim().toLocaleLowerCase('tr') === personName.trim().toLocaleLowerCase('tr') &&
    Math.abs(storedTime - rowTime) < 20 * 60 * 1000
  )
}

function groupPastTerminations(rows: any[], stored: StoredZimmetOperation[]): HistoryItem[] {
  const groups = new Map<string, any[]>()
  for (const row of rows) {
    const personName = String(row.owner_name || row.owner_email || 'Personel').trim()
    const at = row.return_date || row.assigned_date || new Date().toISOString()
    const bucket = Math.floor(new Date(at).getTime() / (10 * 60 * 1000))
    const key = `${personName.toLocaleLowerCase('tr')}|${bucket}`
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }

  const items: HistoryItem[] = []
  for (const [key, group] of groups) {
    const personName = String(group[0].owner_name || group[0].owner_email || 'Personel').trim()
    const createdAt = group
      .map((row) => row.return_date)
      .filter(Boolean)
      .sort()[0] as string
    if (stored.some((item) => sameOperation(item, createdAt, personName))) continue
    items.push({
      id: `past-${key}`,
      operationType: 'termination',
      personName,
      createdAt: createdAt || new Date().toISOString(),
      itemCount: group.length,
      performedByName: null,
      sourceRows: group,
    })
  }
  return items
}

export function OperationsDialog({
  open,
  onOpenChange,
  onTerminate,
  onReport,
  showToast,
}: OperationsDialogProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchStoredZimmetOperations(), fetchPastTerminationRows()])
      .then(([stored, pastRows]) => {
        if (cancelled) return
        const recorded: HistoryItem[] = stored.map((item) => ({
          id: item.id,
          operationType: item.operationType,
          personName: item.personName,
          createdAt: item.createdAt,
          itemCount: item.itemCount,
          performedByName: item.performedByName,
          snapshot: item.snapshot,
        }))
        const older = groupPastTerminations(pastRows as any[], stored)
        const merged = [...recorded, ...older].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setHistory(merged)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const reprint = async (item: HistoryItem) => {
    setPrintingId(item.id)
    try {
      const { downloadZimmetAssignmentListPdf } = await import('@/lib/pdf/zimmetAssignmentListPdf')
      if (item.snapshot) {
        await downloadZimmetAssignmentListPdf(item.snapshot)
      } else if (item.sourceRows) {
        const rows = await assignmentRowsFromInventory(item.sourceRows)
        const when = new Date(item.createdAt).toLocaleString('tr-TR')
        await downloadZimmetAssignmentListPdf({
          docTitleSuffix: `İlişki kesme — ${item.personName}`,
          titleMain: 'İLİŞKİ KESME TUTANAĞI',
          titleSub: 'Personelin üzerindeki zimmetler kaynak depolara iade edilmiştir',
          assignedPersonName: item.personName,
          assignedPersonEmailLine: '',
          exportedByDisplayName: item.performedByName || '—',
          generatedAtLabel: when,
          warehouseScopeLine: 'Her kalem kendi kaynak deposunda boşa düşmüştür',
          rowCountNote: `${rows.length} ürün satırı iade edilmiştir`,
          rows,
          heading: 'İade edilen zimmetler',
          signLeftRole: 'Teslim alan',
          signRightRole: 'İlişkisi kesilen personel',
          signRightNote: 'Yukarıdaki beyanı imzamla kabul ederim.',
          footerNote: 'İlişki kesme tutanağı — Satın Alma / Envanter — Dovec',
          declaration:
            'İşbu tutanak ile, uhdemde bulunan ve yukarıda dökümü verilen tüm malzeme ve ürünleri eksiksiz, sağlam ve kullanıma elverişli halde ilgili birime iade ettiğimi; zimmetimde başkaca şirket malı kalmadığını beyan ve kabul ederim.',
        })
      }
      showToast('Tutanak yeniden oluşturuldu', 'success')
    } catch (error) {
      console.error(error)
      showToast('PDF oluşturulamadı', 'error')
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>İşlemler</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={onTerminate}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left hover:bg-gray-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white">
              <UserMinus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">İlişki kes</span>
              <span className="block text-xs text-gray-500">Zimmetleri boşa düşür ve tutanak indir</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onReport}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left hover:bg-gray-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white">
              <FileText className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">Zimmet raporu</span>
              <span className="block text-xs text-gray-500">Seçilen kişinin zimmet listesini indir</span>
            </span>
          </button>
        </div>

        <div className="mt-2">
          <p className="mb-2 text-sm font-semibold text-gray-900">Geçmiş işlemler</p>
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yükleniyor...
              </div>
            )}
            {!loading && history.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-gray-500">Henüz kayıtlı işlem yok</p>
            )}
            {!loading &&
              history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.operationType === 'termination'
                        ? 'İlişki kes'
                        : item.operationType === 'delivery'
                          ? 'Teslim raporu'
                          : 'Zimmet raporu'}{' '}
                      · {item.personName}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleString('tr-TR')} · {item.itemCount} kalem
                      {item.performedByName ? ` · ${item.performedByName}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={printingId === item.id}
                    onClick={() => void reprint(item)}
                    className="h-9 shrink-0 rounded-xl border-gray-200 bg-white"
                  >
                    {printingId === item.id ? '...' : 'PDF'}
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
