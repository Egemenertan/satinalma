'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSessionUser } from '@/lib/auth'
import { Skeleton } from '@/components/ui/skeleton'
import SupplierManagement from '@/components/SupplierManagement'

export default function SuppliersPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient()
      const user = await getSessionUser(supabase)

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Kullanıcının site_id'sini kontrol et
      const { data: profile } = await supabase
        .from('profiles')
        .select('site_id')
        .eq('id', user.id)
        .single()

      const restrictedSiteId = 'f7f3d36e-0c31-4e9a-8883-94c39330660b'
      
      if (profile?.site_id) {
        const siteIds = Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id]
        
        // Eğer kullanıcı kısıtlanmış site ID'sine aitse erişimi engelle
        if (siteIds.includes(restrictedSiteId)) {
          router.push('/dashboard')
          return
        }
      }

      setHasAccess(true)
      setIsChecking(false)
    }

    checkAccess()
  }, [router])

  if (isChecking) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[112px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return <SupplierManagement />
}


