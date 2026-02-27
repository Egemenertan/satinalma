'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/loading'
import { getRoleLabel } from '@/lib/roles'
import type { UserRole } from '@/lib/types'
import { 
  Users, 
  Search, 
  UserCog, 
  Mail, 
  Building2,
  Calendar,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  department: string | null
  is_active: boolean
  created_at: string
  site_id: string[] | null
}

interface Site {
  id: string
  name: string
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Kullanıcının admin olup olmadığını kontrol et
  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
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
        router.push('/dashboard')
        return
      }

      setCurrentUserRole(profile.role)
    }

    checkAdminAccess()
  }, [router, supabase])

  // Kullanıcıları ve şantiyeleri çek
  const fetchData = async () => {
    setIsLoading(true)
    try {
      // Kullanıcıları çek
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      // Şantiyeleri çek
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, name')

      if (sitesError) throw sitesError

      setProfiles(profilesData || [])
      setSites(sitesData || [])
    } catch (error) {
      console.error('Veri çekme hatası:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (currentUserRole === 'admin') {
      fetchData()
    }
  }, [currentUserRole])

  // Filtreleme
  const filteredProfiles = profiles.filter(profile => {
    const searchLower = searchQuery.toLowerCase()
    return (
      profile.email?.toLowerCase().includes(searchLower) ||
      profile.full_name?.toLowerCase().includes(searchLower) ||
      profile.department?.toLowerCase().includes(searchLower) ||
      getRoleLabel(profile.role).toLowerCase().includes(searchLower)
    )
  })

  // Şantiye adlarını al
  const getSiteNames = (siteIds: string[] | null) => {
    if (!siteIds || siteIds.length === 0) return 'Atanmamış'
    return siteIds
      .map(id => sites.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'Atanmamış'
  }

  // Rol badge renkleri - Beyaz bg ile kontrastlı
  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      admin: 'bg-purple-100 text-purple-700',
      manager: 'bg-blue-100 text-blue-700',
      site_manager: 'bg-emerald-100 text-emerald-700',
      warehouse_manager: 'bg-orange-100 text-orange-700',
      purchasing_officer: 'bg-cyan-100 text-cyan-700',
      site_personnel: 'bg-indigo-100 text-indigo-700',
      santiye_depo: 'bg-amber-100 text-amber-700',
      santiye_depo_yonetici: 'bg-pink-100 text-pink-700',
      user: 'bg-gray-100 text-gray-700'
    }
    return colors[role] || colors.user
  }

  // İstatistikler
  const stats = {
    total: profiles.length,
    active: profiles.filter(p => p.is_active).length,
    inactive: profiles.filter(p => !p.is_active).length,
    admins: profiles.filter(p => p.role === 'admin').length,
    managers: profiles.filter(p => p.role === 'manager').length,
    others: profiles.filter(p => !['admin', 'manager'].includes(p.role)).length
  }

  if (currentUserRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loading size="lg" text="Erişim kontrol ediliyor..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Minimal ve Clean */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Admin Paneli
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistem kullanıcılarını yönetin ve kontrol edin
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="gap-2 text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* İstatistik Kartları - Beyaz Arka Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Toplam Kullanıcı</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <Users className="h-5 w-5 text-gray-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aktif</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">{stats.active}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pasif</p>
                <p className="text-2xl font-semibold text-gray-600 mt-1">{stats.inactive}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Admin & Yönetici</p>
                <p className="text-2xl font-semibold text-purple-600 mt-1">
                  {stats.admins + stats.managers}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arama ve Kullanıcı Listesi */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader className="bg-white border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">Kullanıcılar</CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                {filteredProfiles.length} kullanıcı gösteriliyor
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kullanıcı ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 bg-white">

          {/* Kullanıcı Listesi - Minimal Tablo */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loading size="lg" text="Yükleniyor..." />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-16 bg-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Users className="h-8 w-8 text-gray-500" />
              </div>
              <p className="text-sm text-gray-600">Kullanıcı bulunamadı</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-white">
              {filteredProfiles.map((profile) => (
                <div 
                  key={profile.id} 
                  className="p-6 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Sol: Kullanıcı Bilgileri */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-lg flex-shrink-0">
                        {profile.full_name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {profile.full_name || 'İsimsiz'}
                          </h3>
                          <Badge 
                            variant={profile.is_active ? 'default' : 'secondary'}
                            className={`flex-shrink-0 ${profile.is_active 
                              ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {profile.is_active ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {profile.email}
                          </span>
                          {profile.department && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {profile.department}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(profile.created_at).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sağ: Rol ve Şantiye */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge 
                        variant="outline" 
                        className={`${getRoleBadgeColor(profile.role)} border-0`}
                      >
                        {getRoleLabel(profile.role)}
                      </Badge>
                      {profile.site_id && profile.site_id.length > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {getSiteNames(profile.site_id)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
