'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Layers3, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { titleCaseTr } from '@/lib/reports/titleCase'
import { RolePerformancePanel } from './components/RolePerformancePanel'
import { SpendingReportPanel } from './components/SpendingReportPanel'

const TABS = [
  { value: 'site', label: 'Şantiye Bazlı', icon: Building2 },
  { value: 'department', label: 'Departman Bazlı', icon: Layers3 },
  { value: 'role', label: 'Rol Bazlı', icon: Users },
] as const

export default function ReportsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<string>('site')

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'admin') {
        setIsAdmin(false)
        router.push('/dashboard')
        return
      }
      setIsAdmin(true)
    }
    void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isAdmin === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-elegant-black dark:text-white">
          {titleCaseTr('Raporlar')}
        </h1>
        <p className="mt-1 text-sm text-elegant-gray-600 dark:text-elegant-gray-400">
          {titleCaseTr('Şantiye, Departman Ve Rol Bazlı Performans Raporları')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-elegant-gray-200 bg-elegant-gray-50 p-1 dark:border-elegant-gray-800 dark:bg-elegant-black/40">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-elegant-gray-800 dark:data-[state=active]:text-white"
              >
                <Icon className="size-4" />
                {titleCaseTr(item.label)}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="site">
          <SpendingReportPanel dimension="site" />
        </TabsContent>
        <TabsContent value="department">
          <SpendingReportPanel dimension="department" />
        </TabsContent>
        <TabsContent value="role">
          <RolePerformancePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
