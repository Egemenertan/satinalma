'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SupplierManagement from '@/components/SupplierManagement'

export default function SuppliersPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <div className="space-y-8">
      <SupplierManagement />
    </div>
  )
}


