'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { invalidateDashboardCache } from '@/lib/cache'
import { DashboardInsights } from '@/app/dashboard/components/DashboardInsights'
import { fetchDashboardBundle } from '@/services/dashboard.service'

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

        if (profile?.role === 'warehouse_manager') {
          router.replace('/dashboard/products')
        }
      }
    }

    checkUserRole()
  }, [router, supabase])

  const { data, error, isLoading } = useSWR('dashboard_bundle', fetchDashboardBundle, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
    errorRetryCount: 3,
  })

  useEffect(() => {
    const subscription = supabase
      .channel('dashboard_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requests' },
        () => invalidateDashboardCache()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers' },
        () => invalidateDashboardCache()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sites' },
        () => invalidateDashboardCache()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <div className="space-y-6 pb-8">
      <DashboardInsights bundle={data} loading={isLoading && !data} error={error ?? undefined} />
    </div>
  )
}
