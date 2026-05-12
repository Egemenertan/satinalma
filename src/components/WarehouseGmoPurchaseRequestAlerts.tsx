'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SPECIAL_SITE_ID } from '@/lib/constants'
import {
  isProfileDepartmentIt,
  materialLineAllowedForItWarehouse,
  purchaseRequestHasItWarehouseVisibleItem
} from '@/lib/warehouse-it-material-filter'

type PurchaseRequestRow = {
  id: string
  request_number?: string | null
  title?: string | null
  site_id?: string | null
  status?: string | null
  requested_by?: string | null
  department?: string | null
  material_group?: string | null
  material_class?: string | null
  material_item_name?: string | null
}

function bumpTabBadge() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('satinalma:tab-badge', { detail: { delta: 1 } }))
}

async function fetchItemsForItCheck(
  supabase: ReturnType<typeof createClient>,
  purchaseRequestId: string
) {
  const { data } = await supabase
    .from('purchase_request_items')
    .select('material_group, material_group_code, material_class, material_item_name, item_name')
    .eq('purchase_request_id', purchaseRequestId)
  return data ?? []
}

async function gmoRequestAppliesToWarehouseManager(
  supabase: ReturnType<typeof createClient>,
  row: PurchaseRequestRow,
  viewerUserId: string,
  profileDept: string | null | undefined
): Promise<boolean> {
  if (!row?.id || row.site_id !== SPECIAL_SITE_ID) return false
  if (row.requested_by === viewerUserId) return false
  if (row.status === 'departman_onayı_bekliyor') return false

  if (isProfileDepartmentIt(profileDept)) {
    if (
      materialLineAllowedForItWarehouse({
        material_group: row.material_group,
        material_class: row.material_class,
        material_item_name: row.material_item_name
      })
    ) {
      return true
    }
    let items = await fetchItemsForItCheck(supabase, row.id)
    if (purchaseRequestHasItWarehouseVisibleItem(items)) return true
    await new Promise((r) => setTimeout(r, 650))
    items = await fetchItemsForItCheck(supabase, row.id)
    return purchaseRequestHasItWarehouseVisibleItem(items)
  }

  const dept = profileDept || 'Genel'
  return (row.department || 'Genel') === dept
}

/**
 * Genel Merkez Ofisi sitesinde yeni talep oluştuğunda depo yöneticisine
 * masaüstü bildirimi ve sekme başlığında sayaç gösterir (NotificationManager ile).
 */
export function WarehouseGmoPurchaseRequestAlerts() {
  const router = useRouter()
  const notifiedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    let channel: { unsubscribe: () => void } | null = null

    const run = async () => {
      const supabase = createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, department')
        .eq('id', user.id)
        .single()

      if (cancelled || profile?.role !== 'warehouse_manager') return

      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch {
          /* kullanıcı reddedebilir */
        }
      }

      channel = supabase
        .channel('warehouse_gmo_new_requests')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'purchase_requests',
            filter: `site_id=eq.${SPECIAL_SITE_ID}`
          },
          async (payload) => {
            if (cancelled) return
            const row = payload.new as PurchaseRequestRow
            const applies = await gmoRequestAppliesToWarehouseManager(
              supabase,
              row,
              user.id,
              profile?.department
            )
            if (!applies || cancelled) return
            if (notifiedIdsRef.current.has(row.id)) return
            notifiedIdsRef.current.add(row.id)

            bumpTabBadge()

            const num = row.request_number || row.id.slice(0, 8)
            const titleText = row.title || 'Yeni talep'
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                const icon =
                  typeof window !== 'undefined'
                    ? new URL('/blackdu.webp', window.location.origin).href
                    : undefined
                const n = new Notification('Genel Merkez Ofisi — Yeni talep', {
                  body: `${num}: ${titleText}`,
                  icon,
                  tag: `gmo-pr-${row.id}`
                })
                n.onclick = () => {
                  window.focus()
                  n.close()
                  router.push(`/dashboard/requests/${row.id}`)
                }
              } catch {
                /* Notification oluşturulamadı */
              }
            }
          }
        )
        .subscribe()
    }

    void run()

    return () => {
      cancelled = true
      channel?.unsubscribe()
    }
  }, [router])

  return null
}
