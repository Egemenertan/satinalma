'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchWarehouseAccessForUser,
  replaceUserWarehouseAccess,
} from '@/lib/warehouse-access'

type Site = { id: string; name: string }

interface WarehouseAccessModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: string
    full_name: string | null
    email: string
  } | null
  onSuccess?: () => void
}

export default function WarehouseAccessModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: WarehouseAccessModalProps) {
  const supabase = createClient()
  const [sites, setSites] = useState<Site[]>([])
  const [mode, setMode] = useState<'manage_all' | 'warehouses'>('warehouses')
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !user) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ data: sitesData }, rows] = await Promise.all([
          supabase.from('sites').select('id, name').order('name'),
          fetchWarehouseAccessForUser(user.id),
        ])

        setSites(sitesData || [])

        const hasManageAll = rows.some((r) => r.warehouse_id === null && r.access_level === 'manage')
        if (hasManageAll) {
          setMode('manage_all')
          setSelectedSiteIds([])
        } else {
          setMode('warehouses')
          setSelectedSiteIds(
            rows.map((r) => r.warehouse_id).filter((id): id is string => Boolean(id))
          )
        }
      } catch (e) {
        console.error(e)
        setError('Depo yetkileri yüklenemedi')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isOpen, user, supabase])

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    )
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)

    const result = await replaceUserWarehouseAccess({
      userId: user.id,
      email: user.email,
      mode,
      warehouseIds: selectedSiteIds,
      accessLevel: 'view',
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.error || 'Kayıt başarısız')
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Depo yetkisi
          </DialogTitle>
          <DialogDescription>
            {user?.full_name || 'Kullanıcı'}
            {user?.email ? ` · ${user.email}` : ''} — ürün/stok sayfası erişimi.
            Talep rolü değişmez.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Yükleniyor…
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Yetki tipi</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="wh-mode"
                    checked={mode === 'manage_all'}
                    onChange={() => setMode('manage_all')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-sm">Tüm depolar (yönet)</span>
                    <span className="text-xs text-gray-500">
                      Ürün ekleme/düzenleme + tüm depolar
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="wh-mode"
                    checked={mode === 'warehouses'}
                    onChange={() => setMode('warehouses')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-sm">Seçili depolar (görüntüle)</span>
                    <span className="text-xs text-gray-500">
                      Sadece seçilen depoları görür; ürün kataloğunu düzenleyemez
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {mode === 'warehouses' && (
              <div className="space-y-2">
                <Label>Depolar</Label>
                <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
                  {sites.map((site) => (
                    <label
                      key={site.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedSiteIds.includes(site.id)}
                        onCheckedChange={() => toggleSite(site.id)}
                      />
                      <span className="text-sm">{site.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !user}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Kaydediliyor
              </>
            ) : (
              'Kaydet'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
