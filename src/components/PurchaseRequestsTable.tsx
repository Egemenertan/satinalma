'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/loading'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { invalidatePurchaseRequestsCache } from '@/lib/cache'
import {
  isProfileDepartmentIt,
  fetchPurchaseRequestIdsVisibleToItWarehouseManager
} from '@/lib/warehouse-it-material-filter'

import { 
  Search, 
  FileText, 
  Building2, 
  Calendar,
  AlertTriangle,
  Clock,
  Target,
  Package,
  TrendingUp,
  User,
  ArrowUpDown,
  Check,
  Truck,
  Bell,
  RotateCcw,
  Box,
  Hash,
  MoreVertical,
  Trash2,
  ChevronDown,
  Filter,
  X
} from 'lucide-react'

interface PurchaseRequestItem {
  id: string
  item_name: string
  quantity: number
  original_quantity?: number
  unit: string
  unit_price: number
  brand?: string
  material_class?: string
  material_group?: string
  specifications?: string
  sent_quantity?: number
}

interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description?: string
  site_name: string
  site_id: string
  urgency_level: 'low' | 'normal' | 'high' | 'critical'
  status: string // Basitleştirdik - artık database'den ne geliyorsa onu kullanıyoruz
  requested_by: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  delivery_date?: string
  supplier_id?: string
  created_at: string
  updated_at: string
  sent_quantity?: number
  notifications?: string[] // Bildirimler: ["iade var", "acil"] gibi
  unordered_materials_count?: number // Siparişi verilmemiş malzeme sayısı
  overdue_deliveries_count?: number // Teslim alınmamış sipariş sayısı
  // Relations
  sites?: Array<{
    name: string
  }>
  profiles?: {
    full_name: string
    email: string
  }
}

interface Filters {
  search: string
  status: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// SWR fetcher fonksiyonu - Optimize edildi, sadece user bilgisi çekiliyor
const fetcherWithAuth = async (url: string) => {
  const supabase = createClient()
  
  // Kullanıcı bilgilerini çek
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  // Profile bilgisini çek (site_id ve department için gerekli)
  const { data: profile } = await supabase
    .from('profiles')
    .select('site_id, department')
    .eq('id', user.id)
    .single()

  return { user, profile, supabase }
}

// Siparişi verilmemiş malzeme sayısını hesapla
const fetchUnorderedMaterialsCount = async (requestIds: string[], supabase: any) => {
  if (requestIds.length === 0) return {}
  
  try {
    // Her request_id için siparişi olmayan purchase_request_items sayısını hesapla
    const { data, error } = await supabase.rpc('get_unordered_materials_count', {
      request_ids: requestIds
    })
    
    if (error) {
      console.error('Unordered materials count fetch error:', error)
      // RPC yoksa fallback olarak manuel hesaplama yap
      return await fetchUnorderedMaterialsCountManual(requestIds, supabase)
    }
    
    // { request_id: count } formatına çevir
    const countMap: { [key: string]: number } = {}
    data?.forEach((row: any) => {
      countMap[row.request_id] = row.unordered_count || 0
    })
    
    return countMap
  } catch (err) {
    console.error('Unordered materials count error:', err)
    return await fetchUnorderedMaterialsCountManual(requestIds, supabase)
  }
}

// Manuel hesaplama (fallback)
const fetchUnorderedMaterialsCountManual = async (requestIds: string[], supabase: any) => {
  try {
    // Tüm purchase_request_items'ları çek
    const { data: items, error: itemsError } = await supabase
      .from('purchase_request_items')
      .select('id, purchase_request_id')
      .in('purchase_request_id', requestIds)
    
    if (itemsError) throw itemsError
    
    // Tüm orders'ları çek
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('material_item_id')
      .in('purchase_request_id', requestIds)
      .not('material_item_id', 'is', null)
    
    if (ordersError) throw ordersError
    
    // Order'ı olan material_item_id'leri set'e koy
    const orderedMaterialIds = new Set(orders?.map((o: any) => o.material_item_id) || [])
    
    // Her request için siparişi olmayan malzeme sayısını hesapla
    const countMap: { [key: string]: number } = {}
    items?.forEach((item: any) => {
      if (!countMap[item.purchase_request_id]) {
        countMap[item.purchase_request_id] = 0
      }
      if (!orderedMaterialIds.has(item.id)) {
        countMap[item.purchase_request_id]++
      }
    })
    
    return countMap
  } catch (err) {
    console.error('Manual unordered materials count error:', err)
    return {}
  }
}

// Purchase requests fetcher - gelişmiş arama ve filtreleme ile
const fetchPurchaseRequests = async (
  key: string, 
  userRole?: string, 
  searchTerm?: string, 
  statusFilter?: string, 
  locationFilter?: string,
  unorderedOnly?: boolean,
  overdueOnly?: boolean,
  overdueRequestIds?: string[]
) => {
  const [_, currentPage, pageSize, role] = key.split('/')
  const page = parseInt(currentPage)
  const size = parseInt(pageSize)
  const effectiveRole = role || userRole // Key'den veya paramdan al
  
  const { user, profile, supabase } = await fetcherWithAuth('auth')

  const isItWarehouseManager =
    effectiveRole === 'warehouse_manager' && isProfileDepartmentIt(profile?.department)
  
  // Özel site ID'si için ek statuslar
  const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
  
  // Gelişmiş arama: purchase_requests ve purchase_request_items içinde arama yap
  let matchingRequestIds: string[] | null = null
  if (searchTerm && searchTerm.trim().length > 0) {
    // Türkçe karakterleri normalize et
    const normalizeTurkish = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ş/g, 's')
        .replace(/Ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'c')
    }
    
    const normalizedSearch = normalizeTurkish(searchTerm.trim())
    
    // 1. Purchase requests tablosunda ara (request_number, title, description)
    const { data: requestsData } = await supabase
      .from('purchase_requests')
      .select('id, request_number, title, description')
    
    // 2. Purchase request items tablosunda ara (item_name)
    const { data: itemsData } = await supabase
      .from('purchase_request_items')
      .select('purchase_request_id, item_name')
    
    // Client-side filtreleme ile Türkçe karakter desteği
    const matchingIds = new Set<string>()
    
    // Requests'lerde ara
    if (requestsData) {
      requestsData.forEach(req => {
        const searchableText = [
          req.request_number || '',
          req.title || '',
          req.description || ''
        ].join(' ')
        
        if (normalizeTurkish(searchableText).includes(normalizedSearch)) {
          matchingIds.add(req.id)
        }
      })
    }
    
    // Items'larda ara
    if (itemsData) {
      itemsData.forEach(item => {
        if (normalizeTurkish(item.item_name || '').includes(normalizedSearch)) {
          matchingIds.add(item.purchase_request_id)
        }
      })
    }
    
    matchingRequestIds = Array.from(matchingIds)
    if (matchingRequestIds.length === 0) {
      matchingRequestIds = []
    }
  }
  
  // Departman filtresi: department_head zaten kendi blok mantığında uyguluyor.
  // IT depo yöneticileri ise talep kalemlerine göre ayrı kısıtlanır; talep.departmanı ile sınırlanmaz.
  const userDepartment: string | null =
    effectiveRole !== 'department_head' && profile?.department && !isItWarehouseManager
      ? profile.department
      : null

  // Siparişi olmayan talepler filtresi - önce bunları bulalım
  let unorderedRequestIds: string[] | null = null
  if (unorderedOnly && effectiveRole === 'purchasing_officer') {
    try {
      // İlk önce kullanıcının görebileceği tüm talepleri al
      let tempQuery = supabase
        .from('purchase_requests')
        .select('id')
      
      const baseStatuses = ['satın almaya gönderildi', 'sipariş verildi', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered']
      
      const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
      
      if (userSiteIds.length > 0) {
        // Kendi sitelerine ait belirli statuslardaki talepler VEYA kendi oluşturduğu talepler
        tempQuery = tempQuery.or(
          `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${baseStatuses.join(',')})),` +
          `and(site_id.eq.${SPECIAL_SITE_ID},status.in.(kısmen gönderildi,depoda mevcut değil)),` +
          `requested_by.eq.${user.id}`
        )
      } else {
        // Site ID'si yoksa sadece kendi oluşturduğu talepleri göster
        tempQuery = tempQuery.eq('requested_by', user.id)
      }

      // Departman filtresi
      if (userDepartment) {
        tempQuery = tempQuery.eq('department', userDepartment)
      }
      
      const { data: allRequests } = await tempQuery
      
      if (allRequests && allRequests.length > 0) {
        const allRequestIds = allRequests.map(r => r.id)
        
        // RPC ile siparişi olmayan talepleri bul
        const { data: unorderedData } = await supabase.rpc('get_unordered_materials_count', {
          request_ids: allRequestIds
        })
        
        // 0'dan büyük olanları filtrele
        unorderedRequestIds = unorderedData
          ?.filter((item: any) => item.unordered_count > 0)
          .map((item: any) => item.request_id) || []
        
        if (unorderedRequestIds.length === 0) {
          // Hiç siparişi olmayan talep yok
          return { requests: [], totalCount: 0 }
        }
      } else {
        return { requests: [], totalCount: 0 }
      }
    } catch (err) {
      console.error('Unordered requests filter error:', err)
      unorderedRequestIds = []
    }
  }
  
  // Teslim alınmamış siparişler filtresi
  let overdueFilterIds: string[] | null = null
  if (overdueOnly && overdueRequestIds && overdueRequestIds.length > 0) {
    overdueFilterIds = overdueRequestIds
    if (overdueFilterIds.length === 0) {
      // Hiç gecikmiş sipariş yok
      return { requests: [], totalCount: 0 }
    }
  }

  /** IT WM: izin verilen malzeme gruplarındaki kalemleri olan talepler */
  let itWarehouseScopedIds: string[] | null = null
  if (isItWarehouseManager) {
    itWarehouseScopedIds = await fetchPurchaseRequestIdsVisibleToItWarehouseManager(supabase)
    if (!itWarehouseScopedIds.length) {
      return { requests: [], totalCount: 0 }
    }
  }

  /** Arama / IT WM / sıra dışı / gecikme filtreleri tek id kümesinde birleştirilir */
  let mergedRequestIdFilter: string[] | null = itWarehouseScopedIds

  if (matchingRequestIds !== null) {
    if (!matchingRequestIds.length) return { requests: [], totalCount: 0 }
    if (!mergedRequestIdFilter) mergedRequestIdFilter = [...matchingRequestIds]
    else {
      const m = new Set(matchingRequestIds)
      mergedRequestIdFilter = mergedRequestIdFilter.filter((id) => m.has(id))
    }
    if (!mergedRequestIdFilter.length) return { requests: [], totalCount: 0 }
  }

  if (unorderedRequestIds !== null) {
    if (!mergedRequestIdFilter) mergedRequestIdFilter = [...unorderedRequestIds]
    else {
      const u = new Set(unorderedRequestIds)
      mergedRequestIdFilter = mergedRequestIdFilter.filter((id) => u.has(id))
    }
    if (!mergedRequestIdFilter.length) return { requests: [], totalCount: 0 }
  }

  if (overdueFilterIds !== null) {
    if (!mergedRequestIdFilter) mergedRequestIdFilter = [...overdueFilterIds]
    else {
      const o = new Set(overdueFilterIds)
      mergedRequestIdFilter = mergedRequestIdFilter.filter((id) => o.has(id))
    }
    if (!mergedRequestIdFilter.length) return { requests: [], totalCount: 0 }
  }
  
  let countQuery = supabase
    .from('purchase_requests')
    .select('id', { count: 'exact', head: true })
  
  // Rol bazlı filtreleme
  if (effectiveRole === 'purchasing_officer') {
    // Purchasing officer:
    // 1. Kendi sitelerine ait VE belirli statuslardaki talepler
    // 2. VEYA kendi oluşturduğu tüm talepler
    const baseStatuses = ['satın almaya gönderildi', 'sipariş verildi', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered']
    
    const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
    
    if (userSiteIds.length > 0) {
      // Kendi sitelerine ait belirli statuslardaki talepler VEYA kendi oluşturduğu talepler
      countQuery = countQuery.or(
        `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${baseStatuses.join(',')})),` +
        `and(site_id.eq.${SPECIAL_SITE_ID},status.in.(kısmen gönderildi,depoda mevcut değil)),` +
        `requested_by.eq.${user.id}`
      )
    } else {
      // Site ID'si yoksa sadece kendi oluşturduğu talepleri göster
      countQuery = countQuery.eq('requested_by', user.id)
    }
  } else if (effectiveRole === 'site_personnel') {
    // Site personnel sadece kendi oluşturduğu talepleri görebilir
    countQuery = countQuery.eq('requested_by', user.id)
  } else if (effectiveRole === 'department_head') {
    // Department head: Sadece GMO sitesi + kendi departmanı
    const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const headDepartment = profile?.department || 'Genel'
    countQuery = countQuery
      .eq('site_id', GMO_SITE_ID)
      .eq('department', headDepartment)
  } else if (effectiveRole === 'warehouse_manager') {
    // Warehouse Manager: departman_onayı_bekliyor statusunu görmesin
    countQuery = countQuery.neq('status', 'departman_onayı_bekliyor')
  } else if (effectiveRole === 'santiye_depo') {
    // Santiye depo kullanıcıları kendi sitelerinin taleplerini görebilir ama 'onay_bekliyor' statusundakileri görmez
    if (profile?.site_id) {
      countQuery = countQuery
        .in('site_id', Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id])
        .neq('status', 'onay_bekliyor')
    }
  } else {
    // Diğer roller (site_manager, santiye_depo_yonetici) sadece kendi sitelerinin taleplerini görebilir
    if (profile?.site_id) {
      // site_id artık array olduğu için, kullanıcının sitelerinden herhangi biriyle eşleşenleri getir
      countQuery = countQuery.in('site_id', Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id])
    }
  }

  // Departman filtresi: profilde department doluysa, sadece o departmana ait talepler.
  // department_head rolü kendi mantığında zaten uyguluyor, dışarıda bırakılır.
  if (userDepartment) {
    countQuery = countQuery.eq('department', userDepartment)
  }
  
  if (mergedRequestIdFilter !== null) {
    countQuery = countQuery.in('id', mergedRequestIdFilter)
  }
  
  // Status filtresi
  if (statusFilter && statusFilter !== 'all') {
    countQuery = countQuery.eq('status', statusFilter)
  }
  
  // Lokasyon filtresi
  if (locationFilter && locationFilter !== 'all') {
    countQuery = countQuery.eq('site_id', locationFilter)
  }
  
  // Önce toplam sayıyı al
  const { count, error: countError } = await countQuery
  
  if (countError) {
    throw new Error(countError.message)
  }
  
  // Pagination ile veriyi çek
  const from = (page - 1) * size
  const to = from + size - 1
  
  let requestsQuery = supabase
    .from('purchase_requests')
    .select(`
      id,
      request_number,
      title,
      status,
      urgency_level,
      created_at,
      delivery_date,
      requested_by,
      site_name,
      site_id,
      sent_quantity,
      notifications,
      sites:site_id (
        name
      ),
      profiles:requested_by (
        full_name,
        email
      )
    `)
    .range(from, to)
    .order('created_at', { ascending: false })
  
  // Rol bazlı filtreleme (aynı mantık)
  if (effectiveRole === 'purchasing_officer') {
    // Purchasing officer:
    // 1. Kendi sitelerine ait VE belirli statuslardaki talepler
    // 2. VEYA kendi oluşturduğu tüm talepler
    const baseStatuses = ['satın almaya gönderildi', 'sipariş verildi', 'eksik malzemeler talep edildi', 'kısmen teslim alındı', 'teslim alındı', 'iade var', 'iade nedeniyle sipariş', 'ordered']
    
    const userSiteIds = Array.isArray(profile.site_id) ? profile.site_id : (profile.site_id ? [profile.site_id] : [])
    
    if (userSiteIds.length > 0) {
      // Kendi sitelerine ait belirli statuslardaki talepler VEYA kendi oluşturduğu talepler
      requestsQuery = requestsQuery.or(
        `and(site_id.in.(${userSiteIds.join(',')}),status.in.(${baseStatuses.join(',')})),` +
        `and(site_id.eq.${SPECIAL_SITE_ID},status.in.(kısmen gönderildi,depoda mevcut değil)),` +
        `requested_by.eq.${user.id}`
      )
    } else {
      // Site ID'si yoksa sadece kendi oluşturduğu talepleri göster
      requestsQuery = requestsQuery.eq('requested_by', user.id)
    }
  } else if (effectiveRole === 'site_personnel') {
    // Site personnel sadece kendi oluşturduğu talepleri görebilir
    requestsQuery = requestsQuery.eq('requested_by', user.id)
  } else if (effectiveRole === 'department_head') {
    // Department head: Sadece GMO sitesi + kendi departmanı
    const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const headDepartment = profile?.department || 'Genel'
    requestsQuery = requestsQuery
      .eq('site_id', GMO_SITE_ID)
      .eq('department', headDepartment)
  } else if (effectiveRole === 'warehouse_manager') {
    // Warehouse Manager: departman_onayı_bekliyor statusunu görmesin
    requestsQuery = requestsQuery.neq('status', 'departman_onayı_bekliyor')
  } else if (effectiveRole === 'santiye_depo') {
    // Santiye depo kullanıcıları kendi sitelerinin taleplerini görebilir ama 'onay_bekliyor' statusundakileri görmez
    if (profile?.site_id) {
      requestsQuery = requestsQuery
        .in('site_id', Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id])
        .neq('status', 'onay_bekliyor')
    }
  } else {
    // Diğer roller (site_manager, santiye_depo_yonetici) sadece kendi sitelerinin taleplerini görebilir
    if (profile?.site_id) {
      // site_id artık array olduğu için, kullanıcının sitelerinden herhangi biriyle eşleşenleri getir
      requestsQuery = requestsQuery.in('site_id', Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id])
    }
  }

  // Departman filtresi: profilde department doluysa, sadece o departmana ait talepler.
  // department_head rolü kendi mantığında zaten uyguluyor, dışarıda bırakılır.
  if (userDepartment) {
    requestsQuery = requestsQuery.eq('department', userDepartment)
  }
  
  // Gelişmiş arama filtresi
  if (mergedRequestIdFilter !== null) {
    requestsQuery = requestsQuery.in('id', mergedRequestIdFilter)
  }

  // Status filtresi
  if (statusFilter && statusFilter !== 'all') {
    requestsQuery = requestsQuery.eq('status', statusFilter)
  }
  
  // Lokasyon filtresi
  if (locationFilter && locationFilter !== 'all') {
    requestsQuery = requestsQuery.eq('site_id', locationFilter)
  }
  
  const { data: requests, error } = await requestsQuery
  
  if (error) {
    console.error('Purchase requests fetch error:', {
      error,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code
    })
    throw new Error(`Satın alma talepleri yüklenirken hata oluştu: ${error?.message || 'Bilinmeyen hata'}`)
  }

  // Profile bilgileri artık JOIN ile geliyor, sadece format işlemleri yap
  const formattedRequests = (requests || []).map(request => {
    // Profile bilgisi JOIN'den geldi - Supabase bazen array döndürebilir, kontrol et
    let processedProfiles = request.profiles as any
    
    // Eğer array dönerse ilk elemanı al
    if (Array.isArray(processedProfiles) && processedProfiles.length > 0) {
      processedProfiles = processedProfiles[0]
    }
    
    // Debug log - sadece eksik olanları göster (development modunda ve verbose mode açıksa)
    if ((!processedProfiles || !processedProfiles.full_name) && process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_VERBOSE_LOGS === 'true') {
      console.log('ℹ️ Profile bilgisi eksik (fallback kullanılacak):', {
        requestId: request.id.slice(0, 8),
        requested_by: request.requested_by?.slice(0, 8),
        hasProfile: !!processedProfiles,
        hasFullName: !!processedProfiles?.full_name,
        hasEmail: !!processedProfiles?.email
      })
    }
    
    if (processedProfiles && (processedProfiles.full_name || processedProfiles.email)) {
      // Eğer full_name boş ise email'den isim oluştur
      let displayName = processedProfiles.full_name
      
      if (!displayName || displayName.trim() === '') {
        // Email'den isim oluştur
        if (processedProfiles.email) {
          displayName = processedProfiles.email.split('@')[0]
            .replace(/[._-]/g, ' ')
            .split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
          
          // Veritabanındaki full_name'i de güncelle (arka planda, sessizce)
          if (request.requested_by && process.env.NODE_ENV === 'development') {
            supabase
              .from('profiles')
              .update({ 
                full_name: displayName,
                updated_at: new Date().toISOString()
              })
              .eq('id', request.requested_by)
              .then(({ error }) => {
                if (error && process.env.NEXT_PUBLIC_VERBOSE_LOGS === 'true') {
                  console.error('⚠️ Profile güncelleme hatası:', error)
                }
                // Başarı logu kaldırıldı - gereksiz
              })
          }
        } else {
          displayName = 'İsimsiz Kullanıcı'
        }
      }
      
      processedProfiles = {
        full_name: displayName,
        email: processedProfiles.email
      }
    } else {
      // Profile bilgisi yoksa fallback
      processedProfiles = { 
        full_name: request.requested_by ? 'Kullanıcı bulunamadı' : 'Bilinmiyor', 
        email: '' 
      }
    }
    
    // Sadece database'den gelen status'u kullan - Supabase trigger'ları otomatik güncelliyor
    return {
      ...request,
      profiles: processedProfiles,
      request_number: request.request_number ? 
        (() => {
          const parts = request.request_number.split('-')
          if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1]
            const secondLastPart = parts[parts.length - 2]
            const lastTwoChars = secondLastPart.slice(-2)
            return `${lastTwoChars}-${lastPart}`
          }
          return request.request_number
        })() :
        `REQ-${request.id.slice(-6)}`,
      updated_at: request.created_at
    }
  }) as PurchaseRequest[]

  // "Sipariş verildi" statusundaki talepler için orders'ı ayrı query ile çek
  const orderedRequestIds = formattedRequests
    .filter(r => r.status === 'sipariş verildi')
    .map(r => r.id)
  
  if (orderedRequestIds.length > 0) {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, purchase_request_id, material_item_id, status, quantity, delivered_quantity')
        .in('purchase_request_id', orderedRequestIds)
      
      if (!ordersError && ordersData) {
        // Orders'ı ilgili request'lere ekle
        formattedRequests.forEach((request: any) => {
          if (request.status === 'sipariş verildi') {
            request.orders = ordersData.filter(o => o.purchase_request_id === request.id)
          }
        })
      } else if (ordersError) {
        console.warn('Orders fetch error (non-critical):', ordersError.message)
      }
    } catch (err) {
      console.warn('Orders fetch failed (non-critical):', err)
    }
  }

  // Siparişi verilmemiş malzeme sayılarını hesapla (purchasing_officer için)
  const allRequestIds = formattedRequests.map(r => r.id)
  let unorderedMaterialsCounts: { [key: string]: number } = {}
  
  if (effectiveRole === 'purchasing_officer' && allRequestIds.length > 0) {
    try {
      unorderedMaterialsCounts = await fetchUnorderedMaterialsCount(allRequestIds, supabase)
      
      // Her request'e unordered_materials_count ekle
      formattedRequests.forEach((request: any) => {
        request.unordered_materials_count = unorderedMaterialsCounts[request.id] || 0
      })
    } catch (err) {
      console.warn('Unordered materials count failed (non-critical):', err)
    }
  }
  
  // Teslim alınmamış sipariş sayılarını hesapla (santiye_depo, santiye_depo_yonetici için)
  let overdueDeliveriesCounts: { [key: string]: number } = {}
  
  if ((effectiveRole === 'santiye_depo' || effectiveRole === 'santiye_depo_yonetici' || effectiveRole === 'site_manager') && allRequestIds.length > 0 && overdueRequestIds && overdueRequestIds.length > 0) {
    try {
      // overdueRequestIds array'inden request_id ve overdue_orders_count'u al
      // overdueRequestIds prop'u zaten count bilgisini içermiyor, sadece ID'leri içeriyor
      // Bu yüzden RPC'yi tekrar çağırmalıyız
      const userSiteIds = Array.isArray(profile?.site_id) ? profile.site_id : (profile?.site_id ? [profile.site_id] : [])
      
      if (userSiteIds.length > 0) {
        const { data: overdueData } = await supabase.rpc('get_overdue_deliveries_count', {
          user_site_ids: userSiteIds
        })
        
        if (overdueData) {
          overdueData.forEach((item: any) => {
            overdueDeliveriesCounts[item.request_id] = item.overdue_orders_count || 0
          })
          
          // Her request'e overdue_deliveries_count ekle
          formattedRequests.forEach((request: any) => {
            request.overdue_deliveries_count = overdueDeliveriesCounts[request.id] || 0
          })
        }
      }
    } catch (err) {
      console.warn('Overdue deliveries count failed (non-critical):', err)
    }
  }

  return { requests: formattedRequests, totalCount: count || 0 }
}

interface PurchaseRequestsTableProps {
  userRole?: string // Layout'tan gelen role prop'u
  showUnorderedOnly?: boolean // Siparişi verilmemiş talepleri göster
  onUnorderedFilterChange?: (active: boolean) => void // Filtre değişikliğini parent'a bildir
  showOverdueOnly?: boolean // Teslim alınmamış siparişleri göster
  onOverdueFilterChange?: (active: boolean) => void // Filtre değişikliğini parent'a bildir
  overdueRequestIds?: string[] // Teslim alınmamış taleplerin ID'leri
}

export default function PurchaseRequestsTable({ 
  userRole: propUserRole, 
  showUnorderedOnly = false,
  onUnorderedFilterChange,
  showOverdueOnly = false,
  onOverdueFilterChange,
  overdueRequestIds = []
}: PurchaseRequestsTableProps = {}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [approving, setApproving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(() => {
    // localStorage'dan son seçilen filtreyi al, yoksa 'approval_pending' kullan
    if (typeof window !== 'undefined') {
      return localStorage.getItem('purchase_requests_active_tab') || 'approval_pending'
    }
    return 'approval_pending'
  })

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })
  
  // Yeni filtreleme state'leri
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all') // Teslimat durumu filtresi
  const [unorderedOnlyFilter, setUnorderedOnlyFilter] = useState<boolean>(() => {
    // localStorage'dan filtreyi oku
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unordered_filter_active')
      return saved === 'true' || showUnorderedOnly
    }
    return showUnorderedOnly
  })
  const [overdueOnlyFilter, setOverdueOnlyFilter] = useState<boolean>(() => {
    // localStorage'dan filtreyi oku
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('overdue_filter_active')
      return saved === 'true' || showOverdueOnly
    }
    return showOverdueOnly
  })
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false) // Mobile filter dropdown

  // Tooltip state'leri
  const [hoveredRequestId, setHoveredRequestId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [requestMaterials, setRequestMaterials] = useState<{ [requestId: string]: PurchaseRequestItem[] }>({})
  const [loadingMaterials, setLoadingMaterials] = useState<{ [requestId: string]: boolean }>({})
  
  // Dropdown state'leri
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  
  // Delete modal state'leri
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [requestToDelete, setRequestToDelete] = useState<PurchaseRequest | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Kullanıcı site bilgisi
  const [userSiteIds, setUserSiteIds] = useState<string[]>([])

  // Kullanıcı site bilgisini çek
  useEffect(() => {
    const fetchUserSites = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('site_id')
            .eq('id', user.id)
            .single()
          
          if (profile?.site_id) {
            setUserSiteIds(Array.isArray(profile.site_id) ? profile.site_id : [profile.site_id])
          }
        }
      } catch (error) {
        console.error('Kullanıcı site bilgisi alınamadı:', error)
      }
    }
    fetchUserSites()
  }, [])

  // activeTab değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('purchase_requests_active_tab', activeTab)
    }
  }, [activeTab])

  // showUnorderedOnly prop'u değiştiğinde state'i güncelle
  useEffect(() => {
    setUnorderedOnlyFilter(showUnorderedOnly)
    if (showUnorderedOnly) {
      setCurrentPage(1) // Filtre aktif olunca ilk sayfaya dön
    }
  }, [showUnorderedOnly])
  
  // showOverdueOnly prop'u değiştiğinde state'i güncelle
  useEffect(() => {
    setOverdueOnlyFilter(showOverdueOnly)
    if (showOverdueOnly) {
      setCurrentPage(1) // Filtre aktif olunca ilk sayfaya dön
    }
  }, [showOverdueOnly])

  // unorderedOnlyFilter değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('unordered_filter_active', unorderedOnlyFilter.toString())
    }
  }, [unorderedOnlyFilter])
  
  // overdueOnlyFilter değiştiğinde localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('overdue_filter_active', overdueOnlyFilter.toString())
    }
  }, [overdueOnlyFilter])

  // Malzeme bilgilerini çekme fonksiyonu
  const fetchRequestMaterials = async (requestId: string) => {
    if (requestMaterials[requestId] || loadingMaterials[requestId]) {
      return // Zaten yüklendi veya yükleniyor
    }

    setLoadingMaterials(prev => ({ ...prev, [requestId]: true }))

    try {
      const supabase = createClient()
      const { data: materials, error } = await supabase
        .from('purchase_request_items')
        .select(`
          id,
          item_name,
          quantity,
          original_quantity,
          unit,
          unit_price,
          brand,
          material_class,
          material_group,
          specifications,
          sent_quantity
        `)
        .eq('purchase_request_id', requestId)
        .order('item_name')

      if (error) {
        console.error('Malzeme bilgileri çekilirken hata:', error)
        return
      }

      // original_quantity varsa onu kullan, yoksa quantity kullan
      const formattedMaterials = materials?.map(material => ({
        ...material,
        // original_quantity'yi quantity olarak göster (tooltip için)
        quantity: material.original_quantity ? Number(material.original_quantity) : material.quantity
      })) || []

      setRequestMaterials(prev => ({
        ...prev,
        [requestId]: formattedMaterials
      }))
    } catch (error) {
      console.error('Malzeme bilgileri çekilirken hata:', error)
    } finally {
      setLoadingMaterials(prev => ({ ...prev, [requestId]: false }))
    }
  }

  // Role prop'tan veya fallback olarak 'user' kullan
  const userRole = propUserRole || 'user'

  // Arama state'i
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1) // Arama değişince ilk sayfaya dön
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])
  
  // Dropdown'ları dışarı tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Dropdown içine tıklandıysa kapat
      const isInsideDropdown = target.closest('[data-dropdown]')
      const isDropdownButton = target.closest('button')?.hasAttribute('data-dropdown-trigger')
      
      if (!isInsideDropdown && !isDropdownButton) {
        setIsStatusDropdownOpen(false)
        setIsLocationDropdownOpen(false)
        setIsMobileFilterOpen(false)
      }
    }
    
    if (isStatusDropdownOpen || isLocationDropdownOpen || isMobileFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isStatusDropdownOpen, isLocationDropdownOpen, isMobileFilterOpen])
  
  // SWR ile cache'li veri çekme - Gelişmiş arama ve filtreleme ile
  const { data, error, isLoading, mutate: refreshData } = useSWR(
    `purchase_requests/${currentPage}/${pageSize}/${userRole}/${debouncedSearchTerm}/${statusFilter}/${locationFilter}/${unorderedOnlyFilter}/${overdueOnlyFilter}/${JSON.stringify(overdueRequestIds)}`,
    () => fetchPurchaseRequests(
    `purchase_requests/${currentPage}/${pageSize}/${userRole}`,
      userRole,
      debouncedSearchTerm,
      statusFilter,
      locationFilter,
      unorderedOnlyFilter,
      overdueOnlyFilter,
      overdueRequestIds
    ),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      refreshInterval: 30000,
    }
  )

  const requests = data?.requests || []
  const totalCount = data?.totalCount || 0
  
  // Malzeme teslimat durumu hesaplama fonksiyonu
  const calculateMaterialDeliveryStatus = (request: any) => {
    // Talebin tüm siparişlerini kontrol et
    const orders = request.orders || []
    
    if (orders.length === 0) return null
    
    // Her malzeme için benzersiz order'ları al
    const materialOrders = new Map()
    orders.forEach((order: any) => {
      const materialId = order.material_item_id
      if (!materialOrders.has(materialId)) {
        materialOrders.set(materialId, [])
      }
      materialOrders.get(materialId).push(order)
    })
    
    let totalMaterials = materialOrders.size
    let deliveredMaterials = 0
    let partialMaterials = 0
    
    // Her malzeme için teslimat durumunu kontrol et
    materialOrders.forEach((orders: any[], materialId: string) => {
      const allDelivered = orders.every((o: any) => 
        o.status === 'teslim alındı' || 
        (o.delivered_quantity && o.quantity && Number(o.delivered_quantity) >= Number(o.quantity))
      )
      
      const someDelivered = orders.some((o: any) => 
        (o.delivered_quantity && Number(o.delivered_quantity) > 0) || 
        o.status === 'teslim alındı' || 
        o.status === 'kısmen teslim alındı'
      )
      
      if (allDelivered) {
        deliveredMaterials++
      } else if (someDelivered) {
        partialMaterials++
      }
    })
    
    // Sonuç hesapla
    if (deliveredMaterials === totalMaterials) {
      return { type: 'full', label: 'Tamamı Teslim Alındı', className: 'text-white', style: { backgroundColor: '#2C5444' }, rounded: 'rounded-xl' }
    } else if (deliveredMaterials > 0 || partialMaterials > 0) {
      return { type: 'partial', label: 'Kısmen Teslim Alındı', className: 'bg-red-100 text-red-800', rounded: 'rounded-full' }
    }
    
    return null
  }
  
  // Teslimat durumu filtrelemesi - Frontend'de yapılıyor
  const filteredByDeliveryStatus = requests.filter(request => {
    if (deliveryStatusFilter === 'all') return true
    
    // Sadece "sipariş verildi" statusundaki talepler için teslimat durumu kontrolü
    if (request.status !== 'sipariş verildi') return false
    
    const deliveryStatus = calculateMaterialDeliveryStatus(request)
    
    if (deliveryStatusFilter === 'tamami_teslim_alindi') {
      return deliveryStatus?.type === 'full'
    } else if (deliveryStatusFilter === 'kismen_teslim_alindi') {
      return deliveryStatus?.type === 'partial'
    } else if (deliveryStatusFilter === 'siparis_verildi_sadece') {
      // Teslimat durumu badge'i olmayan "sipariş verildi" talepleri
      return !deliveryStatus
    }
    
    return true
  })
  
  // Unique status ve location listeleri
  const uniqueStatuses = [...new Set(requests.map(r => r.status).filter(Boolean))]
  
  // Lokasyonları unique hale getir - site_id'ye göre
  const locationMap = new Map()
  requests.forEach(r => {
    if (r.site_id && !locationMap.has(r.site_id)) {
      locationMap.set(r.site_id, {
        id: r.site_id,
        name: r.sites?.[0]?.name || r.site_name || 'Belirtilmemiş'
      })
    }
  })
  const uniqueLocations = Array.from(locationMap.values())

  // Real-time updates için subscription - Optimize edildi
  useEffect(() => {
    const supabase = createClient()
    
    // Purchase requests tablosundaki değişiklikleri dinle
    const subscription = supabase
      .channel('purchase_requests_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'purchase_requests' 
        }, 
        (payload) => {
          console.log('📡 Real-time update received:', payload)
          
          // Sadece ilgili cache'i temizle - tüm cache'leri temizlemeye gerek yok
          // Global cache invalidation kullan
          invalidatePurchaseRequestsCache()
          
          // Sadece bu sayfanın cache'ini yenile - gereksiz global yenilemeleri kaldır
          mutate(`purchase_requests/${currentPage}/${pageSize}/${userRole}`)
          
          console.log('✅ PurchaseRequestsTable cache temizlendi ve veri yenilendi')
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [currentPage, pageSize, userRole])

  // Türkçe karakterleri normalize et
  const normalizeTurkish = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'i')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'c')
  }

  // Filter uygulaması
  const filteredRequests = filteredByDeliveryStatus.filter((req: any) => {
    // Site manager için tab bazlı filtreleme
    if (userRole === 'site_manager' && activeTab === 'approval_pending') {
      const approvalPendingStatuses = ['kısmen gönderildi', 'depoda mevcut değil', 'ana depoda yok']
      if (!approvalPendingStatuses.includes(req.status)) {
        return false
      }
    }
    
    // Siparişi verilmemiş talep filtresi - Backend'de yapılıyor, frontend'de tekrar filtrelemeye gerek yok
    
    if (filters.status !== 'all' && req.status !== filters.status) return false
    if (filters.search) {
      const searchTerm = normalizeTurkish(filters.search)
      return (
        normalizeTurkish(req.request_number || '').includes(searchTerm) ||
        normalizeTurkish(req.title || '').includes(searchTerm) ||
        normalizeTurkish(req.description || '').includes(searchTerm)
      )
    }
    return true
  }).sort((a: any, b: any) => {
    // Siparişi verilmemiş filtre aktifse, önce en çok eksiği olanları göster
    if (unorderedOnlyFilter && userRole === 'purchasing_officer') {
      const aCount = a.unordered_materials_count || 0
      const bCount = b.unordered_materials_count || 0
      if (aCount !== bCount) {
        return bCount - aCount // Büyükten küçüğe
      }
    }
    
    const aVal = a[filters.sortBy] || ''
    const bVal = b[filters.sortBy] || ''
    
    if (filters.sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const getStatusBadge = (status: string, notifications?: string[], requestSiteId?: string) => {
    const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
    const isSpecialSiteUser = userSiteIds.includes(SPECIAL_SITE_ID)
    
    // Özel site kullanıcıları için: pending -> "Onaylandı" olarak göster
    if (isSpecialSiteUser && status === 'pending') {
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="bg-green-100 text-green-800 border-0 rounded-full text-xs font-medium px-2 py-1">
            Onaylandı
          </Badge>
        {notifications && notifications.includes('iade var') && (
          <div className="flex flex-wrap gap-1">
            <Badge 
              variant="outline" 
              className="text-red-700 border-red-200 rounded-full text-xs font-medium px-1 py-0.5"
            >
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-red-600" />
                İade Var
              </span>
            </Badge>
          </div>
        )}
        </div>
      )
    }
    
    // Purchasing officer için özel görünüm
    if (userRole === 'purchasing_officer') {
      // satın almaya gönderildi ve eksik malzemeler -> "Beklemede"
      if (status === 'satın almaya gönderildi' || status === 'eksik malzemeler talep edildi') {
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-0 rounded-full text-xs font-medium px-2 py-1">
              Beklemede
            </Badge>
          {notifications && notifications.includes('iade var') && (
            <div className="flex flex-wrap gap-1">
              <Badge 
                variant="outline" 
                className=" text-red-700 border-0 rounded-full text-xs font-medium px-1 py-0.5"
              >
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-red-600" />
                  İade Var
                </span>
              </Badge>
            </div>
          )}
          </div>
        )
      }
      
      // kısmen gönderildi -> "Beklemede"
      // depoda mevcut değil -> gerçek status'u göster (artık mapping yok)
      if (status === 'kısmen gönderildi') {
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-0 rounded-full text-xs font-medium px-2 py-1">
              Beklemede
            </Badge>
          {notifications && notifications.includes('iade var') && (
            <div className="flex flex-wrap gap-1">
              <Badge 
                variant="outline" 
                className=" text-red-700 border-0 rounded-full text-xs font-medium px-1 py-0.5"
              >
                <span className="flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-red-600" />
                  İade Var
                </span>
              </Badge>
            </div>
          )}
          </div>
        )
      }
    }

    const statusConfig = {
      // Temel statuslar
      draft: { label: 'Taslak', className: 'bg-gray-100 text-gray-700 border-0' },
      pending: { label: 'Beklemede', className: 'bg-yellow-100 text-yellow-800 border-0' },
      'onay bekliyor': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      'onay_bekliyor': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      'departman_onayı_bekliyor': { label: '🔔 Departman Onayı Bekliyor', className: 'bg-amber-50 text-amber-700 border-amber-200 border' },
      'teklif bekliyor': { label: 'Teklif Bekliyor', className: 'bg-purple-100 text-purple-800 border-0' },
      'onaylandı': { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      'satın almaya gönderildi': { label: 'Satın Almaya Gönderildi', className: 'bg-blue-100 text-blue-800 border-0' },
      'sipariş verildi': { label: 'Sipariş Verildi', className: 'bg-green-100 text-green-800 border-0' },
      'ordered': { label: 'Sipariş Verildi', className: 'bg-green-100 text-green-800 border-0' },
      'gönderildi': { label: 'Gönderildi', className: 'bg-emerald-100 text-emerald-800 border-0' },
      'kısmen gönderildi': { label: 'Kısmen Gönderildi', className: 'bg-red-100 text-red-800 border-0' },
      'kısmen teslim alındı': { label: 'Kısmen Teslim Alındı', className: 'bg-red-100 text-red-800 border-0' },
      'depoda mevcut değil': { label: 'Depoda Mevcut Değil', className: 'bg-red-100 text-red-800 border-0' },
      'ana depoda yok': { label: 'Ana Depoda Yok', className: 'bg-red-100 text-red-800 border-0' },
      'teslim alındı': { label: 'Teslim Alındı', className: 'bg-green-100 text-green-800 border-0' },
      'iade var': { label: 'İade Var', className: 'bg-red-100 text-red-800 border-0' },
      'iade nedeniyle sipariş': { label: 'İade Nedeniyle Sipariş', className: 'bg-purple-100 text-purple-800 border-0' },
      'reddedildi': { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-0' },
      rejected: { label: 'Reddedildi', className: 'bg-red-100 text-red-800 border-0' },
      cancelled: { label: 'İptal Edildi', className: 'bg-gray-100 text-gray-600 border-0' },
      
      // Eski statuslar için backward compatibility
      'şantiye şefi onayladı': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      awaiting_offers: { label: 'Teklif Bekliyor', className: 'bg-purple-100 text-purple-800 border-0' },
      approved: { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      delivered: { label: 'Teslim Alındı', className: 'bg-green-100 text-green-800 border-0' },
      'eksik onaylandı': { label: 'Onay Bekliyor', className: 'bg-blue-100 text-blue-800 border-0' },
      'alternatif onaylandı': { label: 'Onaylandı', className: 'bg-green-100 text-green-800 border-0' },
      'eksik malzemeler talep edildi': { label: 'Satın Almaya Gönderildi', className: 'bg-blue-100 text-blue-800 border-0' }
    }

    // Database'den gelen status'u direkt kullan - trigger zaten doğru güncelliyor
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft

    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className={`${config.className} rounded-full text-xs font-medium px-2 py-1`}>
          {config.label}
        </Badge>
        {notifications && notifications.includes('iade var') && (
          <div className="flex flex-wrap gap-1">
            <Badge 
              variant="outline" 
              className="border-red-300 text-red-700 border rounded-full text-xs font-medium px-1 py-0.5"
            >
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-red-600" />
                İade Var
              </span>
            </Badge>
          </div>
        )}
      </div>
    )
  }

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      critical: { 
        label: 'Kritik', 
        className: 'bg-red-100 text-red-800 border-0',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      high: { 
        label: 'Yüksek', 
        className: 'bg-red-100 text-red-800 border-0',
        icon: <AlertTriangle className="w-3 h-3" />
      },
      normal: { 
        label: 'Normal', 
        className: 'bg-blue-100 text-blue-800 border-0',
        icon: <Clock className="w-3 h-3" />
      },
      low: { 
        label: 'Düşük', 
        className: 'bg-green-100 text-green-800 border-0',
        icon: <Target className="w-3 h-3" />
      }
    }

    const config = urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig.normal

    return (
      <Badge variant="outline" className={`${config.className} rounded-full text-xs font-medium px-2 py-1 flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSort = (field: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleRequestClick = (request: PurchaseRequest) => {
    // Purchasing officer için "depoda mevcut değil" statusundaki taleplere erişim engeli
    if (userRole === 'purchasing_officer' && request.status === 'depoda mevcut değil') {
      showToast('Bu talep henüz onaylanmadı. Öncelikle yönetici tarafından onaylanması gerekmektedir.', 'info')
      return
    }
    
    // Tüm status'lardaki taleplere gidilebilir (draft, cancelled, rejected hariç)
    // Reddedildi talepler de görüntülenebilir (reddedilme nedeni görmek için)
    if (request.status !== 'draft' && request.status !== 'cancelled' && request.status !== 'rejected') {
      router.push(`/dashboard/requests/${request.id}/offers`)
    }
  }

  // Hover event handler'ları
  const handleMouseEnter = (e: React.MouseEvent, requestId: string) => {
    setTooltipPosition({
      x: e.clientX + 15, // İmlecin 15px sağında
      y: e.clientY - 10  // İmlecin 10px üstünde
    })
    setHoveredRequestId(requestId)
    fetchRequestMaterials(requestId)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredRequestId) {
      setTooltipPosition({
        x: e.clientX + 15, // İmlecin 15px sağında
        y: e.clientY - 10  // İmlecin 10px üstünde
      })
    }
  }

  const handleMouseLeave = () => {
    setHoveredRequestId(null)
  }

  // Dropdown toggle fonksiyonu
  const toggleDropdown = (requestId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenDropdownId(openDropdownId === requestId ? null : requestId)
  }

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownId(null)
    }
    
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openDropdownId])

  // Delete modal açma fonksiyonu
  const openDeleteModal = (request: PurchaseRequest, e: React.MouseEvent) => {
    e.stopPropagation() // Satır tıklamasını engelle
    
    console.log('📋 Delete modal açılıyor:', {
      requestId: request.id,
      status: request.status,
      title: request.title,
      canDelete: canDeleteRequest(request)
    })
    
    setRequestToDelete(request)
    setShowDeleteModal(true)
    setOpenDropdownId(null) // Dropdown'ı kapat
  }

  // Delete modal kapatma fonksiyonu
  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setRequestToDelete(null)
    setIsDeleting(false)
  }

  // Talep silme fonksiyonu
  const handleDeleteRequest = async () => {
    console.log('🚀 handleDeleteRequest çağrıldı')
    
    if (!requestToDelete) {
      console.log('⚠️ requestToDelete null, işlem iptal')
      return
    }

    console.log('🗑️ Talep siliniyor:', {
      id: requestToDelete.id,
      status: requestToDelete.status,
      title: requestToDelete.title
    })

    setIsDeleting(true)

    try {
      const supabase = createClient()

      // Kullanıcı yetkisini kontrol et
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('❌ Kullanıcı oturumu bulunamadı:', userError)
        throw new Error('Kullanıcı oturumu bulunamadı')
      }

      console.log('✅ Kullanıcı oturumu doğrulandı:', user.id)

      // Sadece talebi sil - CASCADE sayesinde tüm ilişkili veriler otomatik silinir
      // (purchase_request_items, offers, orders, invoices, order_deliveries vb.)
      console.log('🎯 Talep satırı siliniyor...')
      const { error: requestError, count } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('id', requestToDelete.id)

      if (requestError) {
        console.error('❌ Talep silme hatası:', requestError)
        throw new Error(`Talep silinirken hata oluştu: ${requestError.message}`)
      }

      console.log('✅ Talep başarıyla silindi. Silinen satır sayısı:', count)

      // Modal'ı hemen kapat
      closeDeleteModal()
      
      // Başarı toast'ı göster
      showToast('Talep başarıyla kaldırıldı!', 'success')

      // Cache'i agresif şekilde temizle
      invalidatePurchaseRequestsCache()
      
      // Tüm purchase_requests key'lerini temizle
      await mutate(
        (key) => typeof key === 'string' && key.includes('purchase_requests'),
        undefined,
        { revalidate: true }
      )
      
      // Stats cache'ini temizle
      await mutate('purchase_requests_stats', undefined, { revalidate: true })
      await mutate('pending_requests_count', undefined, { revalidate: true })
      
      // Sayfayı yeniden yükle (en garantili yöntem)
      await refreshData()
      
      // Next.js router'ı ile server-side verisini de yenile
      router.refresh()
      
      console.log('✅ Cache temizlendi ve sayfa yenilendi')
      
    } catch (error: any) {
      console.error('❌ Talep silme hatası:', error)
      showToast(`Talep silinirken hata oluştu: ${error.message}`, 'error')
      
      // Modal'ı kapat ve state'leri resetle
      closeDeleteModal()
    } finally {
      // Her durumda isDeleting'i false yap
      setIsDeleting(false)
    }
  }

  // Talep silme yetkisi kontrolü
  const canDeleteRequest = (request: PurchaseRequest) => {
    console.log('🔍 Silme yetkisi kontrolü:', {
      requestId: request.id,
      requestStatus: request.status,
      userRole: userRole,
      canDelete: userRole === 'purchasing_officer' || request.status === 'pending'
    })
    
    // Purchasing officer tüm talepleri silebilir
    if (userRole === 'purchasing_officer') {
      return true
    }
    
    // Diğer roller sadece "pending" (beklemede) statusundeki talepleri silebilir
    return request.status === 'pending'
  }

  // Delivery confirmation functions
  // Delivery fonksiyonları kaldırıldı - artık offers sayfasında yönetiliyor

  const handleSiteManagerApproval = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Tıklamanın satır tıklamasına etki etmesini engelle
    
    try {
      setApproving(requestId)
      
      const supabase = createClient()
      
      // Kullanıcı bilgisini al
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Kullanıcı oturumu bulunamadı.')
      }
      
      // Kullanıcı rolünü al
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      const currentUserRole = profile?.role || 'Site Manager'
      const roleLabel = currentUserRole === 'santiye_depo_yonetici' 
        ? 'Şantiye Depo Yöneticisi' 
        : 'Site Manager'
      
      // Request bilgisini al (site_id ve status için)
      const { data: requestData, error: requestError } = await supabase
        .from('purchase_requests')
        .select('site_id, status')
        .eq('id', requestId)
        .single()
      
      if (requestError || !requestData) {
        throw new Error('Talep bilgisi alınamadı.')
      }
      
      // Ana depoda stok kontrolü yap
      console.log('🔍 Ana depoda stok kontrolü yapılıyor...')
      const { data: stockCheckData, error: stockCheckError } = await supabase
        .rpc('check_main_warehouse_stock', { request_id_param: requestId })
      
      if (stockCheckError) {
        console.error('❌ Stok kontrolü hatası:', stockCheckError)
        throw new Error('Stok kontrolü yapılamadı: ' + stockCheckError.message)
      }

      // Tüm ürünlerin stokta olup olmadığını kontrol et
      const allItemsInStock = stockCheckData && stockCheckData.length > 0 
        ? stockCheckData.every((item: any) => item.has_stock === true)
        : false

      console.log('📊 Stok Kontrol Sonucu:', {
        totalItems: stockCheckData?.length || 0,
        allItemsInStock,
        details: stockCheckData
      })

      // Özel site ID'si kontrolü
      const SPECIAL_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
      const isSpecialSite = requestData.site_id === SPECIAL_SITE_ID
      const isAwaitingApproval = requestData.status === 'onay_bekliyor'
      
      let newStatus = 'satın almaya gönderildi'
      let successMessage = 'Talep satın almaya gönderildi!'
      let historyComment = `${roleLabel} tarafından satın almaya gönderildi`
      
      // Genel Merkez Ofisi için stok kontrolü yaparak karar ver
      if (isSpecialSite && isAwaitingApproval) {
        // Özel site (Genel Merkez Ofisi) için stok kontrolüne göre karar ver
        if (allItemsInStock) {
          newStatus = 'onaylandı'
          successMessage = 'Talep onaylandı! Ürünler ana depoda mevcut.'
          historyComment = `${roleLabel} tarafından onaylandı (Ana depoda stok mevcut)`
          console.log('🔐 Genel Merkez Ofisi - Ana depoda stok mevcut, status: onaylandı')
        } else {
          // Ana depoda stok yoksa direkt satın almaya gönderildi
          newStatus = 'satın almaya gönderildi'
          successMessage = 'Talep satın almaya gönderildi! (Ana depoda stok yok)'
          historyComment = `${roleLabel} tarafından satın almaya gönderildi (Genel Merkez Ofisi - Ana depoda stok yok)`
          console.log('🔐 Genel Merkez Ofisi - Ana depoda stok yok, direkt satın almaya gönderiliyor')
        }
      } else {
        // Normal durum (diğer siteler): Stok kontrolüne göre karar ver
        if (allItemsInStock) {
          newStatus = 'onaylandı'
          successMessage = 'Talep onaylandı! Ürünler ana depoda mevcut.'
          historyComment = `${roleLabel} tarafından onaylandı (Ana depoda stok mevcut)`
          console.log('✅ Ana depoda stok mevcut, status: onaylandı')
        } else {
          // Stok yoksa direkt satın almaya gönderildi
          newStatus = 'satın almaya gönderildi'
          successMessage = 'Talep satın almaya gönderildi! (Ana depoda stok yok)'
          historyComment = `${roleLabel} tarafından satın almaya gönderildi (Ana depoda stok yok)`
          console.log('⚠️ Ana depoda stok yok, direkt satın almaya gönderiliyor')
        }
      }
      
      // Optimistic update - UI'ı hemen güncelle
      const optimisticUpdate = data ? {
        ...data,
        requests: data.requests.map((req: any) => 
          req.id === requestId 
            ? { ...req, status: newStatus }
            : req
        )
      } : null
      
      if (optimisticUpdate) {
        mutate(`purchase_requests/${currentPage}/${pageSize}`, optimisticUpdate, false)
      }
      
      const { error } = await supabase
        .from('purchase_requests')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (error) throw error
      
      // Approval history kaydı ekle
      const { error: historyError } = await supabase
        .from('approval_history')
        .insert({
          purchase_request_id: requestId,
          action: 'approved',
          performed_by: user.id,
          comments: historyComment
        })

      if (historyError) {
        console.error('⚠️ Approval history kaydı eklenirken hata:', historyError)
      }
      
      // Teams bildirimi gönder
      try {
        const { handlePurchaseRequestStatusChange } = await import('../lib/teams-webhook')
        await handlePurchaseRequestStatusChange(requestId, newStatus)
      } catch (webhookError) {
        console.error('⚠️ Teams bildirimi gönderilemedi:', webhookError)
        // Webhook hatası ana işlemi etkilemesin
      }
      
      // Agresif cache temizleme ve veri yenileme
      invalidatePurchaseRequestsCache()
      
      // Tüm ilgili cache'leri manuel temizle
      mutate('purchase_requests_stats')
      mutate('pending_requests_count')
      
      // SWR cache'ini birden fazla kez yenile
      setTimeout(() => {
        refreshData()
      }, 100)
      
      setTimeout(() => {
        refreshData()
      }, 300)
      
      // Başarı mesajını göster
      showToast(successMessage, 'success')
      
    } catch (error: any) {
      console.error('❌ Site Manager Onay Hatası:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        requestId
      })
      
      // Hata durumunda kullanıcıyı bilgilendir (console'da detay var)
    } finally {
      setApproving(null)
    }
  }



  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="p-0">
        {/* Search Bar ve Tab Menu */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
           
            
            {/* Tab Menu - Sadece site manager için */}
            {userRole === 'site_manager' && (
              <div className="order-2 sm:order-1">
                <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-lg border border-gray-100">
                  <button
                    onClick={() => setActiveTab('approval_pending')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      activeTab === 'approval_pending'
                        ? 'bg-black text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Onay Bekleyenler
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      activeTab === 'all'
                        ? 'bg-black text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Tümü
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tablo */}
        <div className="space-y-3">
          {/* Header - Desktop Only */}
          {/* Gelişmiş Arama ve Filtre Bölümü */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Arama */}
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Talep ara... (malzeme adı, başlık, talep no)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 h-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Mobile Filtre Butonu */}
              <div className="md:hidden relative">
                <Button
                  data-dropdown-trigger
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                  className="flex items-center gap-2 h-10 bg-white"
                >
                  <Filter className="w-4 h-4" />
                  Filtrele
                  {(statusFilter !== 'all' || locationFilter !== 'all' || deliveryStatusFilter !== 'all') && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isMobileFilterOpen ? 'rotate-180' : ''}`} />
                </Button>
                
                {/* Mobile Dropdown - Apple Style */}
                {isMobileFilterOpen && (
                  <div data-dropdown className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                      {/* Teslimat Durumu */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Teslimat Durumu</div>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setStatusFilter('all')
                              setDeliveryStatusFilter('all')
                              setIsMobileFilterOpen(false)
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                              statusFilter === 'all' && deliveryStatusFilter === 'all'
                                ? 'bg-gray-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-medium text-sm">Tümü</div>
                          </button>
                          
                          <button
                            onClick={() => {
                              setStatusFilter('sipariş verildi')
                              setDeliveryStatusFilter('tamami_teslim_alindi')
                              setIsMobileFilterOpen(false)
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                              deliveryStatusFilter === 'tamami_teslim_alindi'
                                ? 'bg-gray-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2C5444' }}></span>
                              <span className="font-medium text-sm">Tamamı Teslim Alındı</span>
                            </div>
                          </button>
                          
                          <button
                            onClick={() => {
                              setStatusFilter('sipariş verildi')
                              setDeliveryStatusFilter('kismen_teslim_alindi')
                              setIsMobileFilterOpen(false)
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                              deliveryStatusFilter === 'kismen_teslim_alindi'
                                ? 'bg-gray-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                              <span className="font-medium text-sm">Kısmen Teslim Alındı</span>
                            </div>
                          </button>
                          
                          <button
                            onClick={() => {
                              setStatusFilter('sipariş verildi')
                              setDeliveryStatusFilter('siparis_verildi_sadece')
                              setIsMobileFilterOpen(false)
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                              deliveryStatusFilter === 'siparis_verildi_sadece'
                                ? 'bg-gray-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                              <span className="font-medium text-sm">Sipariş Verildi</span>
                            </div>
                          </button>
                        </div>
                      </div>
                      
                      {/* Diğer Durumlar */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Diğer Durumlar</div>
                        <div className="space-y-1">
                          {uniqueStatuses.map(status => (
                            <button
                              key={status}
                              onClick={() => {
                                setStatusFilter(status)
                                setDeliveryStatusFilter('all')
                                setIsMobileFilterOpen(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                                statusFilter === status && deliveryStatusFilter === 'all'
                                  ? 'bg-gray-100 font-medium'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Lokasyon */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lokasyon</div>
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              setLocationFilter('all')
                              setIsMobileFilterOpen(false)
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                              locationFilter === 'all'
                                ? 'bg-gray-100 font-medium'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            Tüm Lokasyonlar
                          </button>
                          {uniqueLocations.map(location => (
                            <button
                              key={location.id}
                              onClick={() => {
                                setLocationFilter(location.id)
                                setIsMobileFilterOpen(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                                locationFilter === location.id
                                  ? 'bg-gray-100 font-medium'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {location.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Temizle Butonu */}
                      {(statusFilter !== 'all' || locationFilter !== 'all' || deliveryStatusFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setStatusFilter('all')
                            setLocationFilter('all')
                            setDeliveryStatusFilter('all')
                          }}
                          className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                        >
                          Filtreleri Temizle
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Aktif Filtreler */}
              {(statusFilter !== 'all' || locationFilter !== 'all' || deliveryStatusFilter !== 'all' || unorderedOnlyFilter || overdueOnlyFilter) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Filtreler:</span>
                  
                  {/* Siparişi Verilmemiş Filtresi */}
                  {unorderedOnlyFilter && (
                    <Badge 
                      variant="outline" 
                      className="bg-red-600 text-white border-0 gap-1 cursor-pointer hover:bg-red-700 animate-pulse"
                      onClick={() => {
                        setUnorderedOnlyFilter(false)
                        if (onUnorderedFilterChange) {
                          onUnorderedFilterChange(false)
                        }
                      }}
                    >
                      Siparişi Verilmemiş Talepler
                      <X className="w-3 h-3" />
                    </Badge>
                  )}
                  
                  {/* Teslim Alınmamış Siparişler Filtresi */}
                  {overdueOnlyFilter && (
                    <Badge 
                      variant="outline" 
                      className="bg-red-600 text-white border-0 gap-1 cursor-pointer hover:bg-red-700 animate-pulse"
                      onClick={() => {
                        setOverdueOnlyFilter(false)
                        if (onOverdueFilterChange) {
                          onOverdueFilterChange(false)
                        }
                      }}
                    >
                      Teslim Alınmamış Siparişler
                      <X className="w-3 h-3" />
                    </Badge>
                  )}
                  
                  {deliveryStatusFilter !== 'all' && (
                    <Badge 
                      variant="outline" 
                      className="gap-1 cursor-pointer hover:bg-gray-100"
                      style={{ 
                        backgroundColor: deliveryStatusFilter === 'tamami_teslim_alindi' ? '#2C5444' : 
                                       deliveryStatusFilter === 'kismen_teslim_alindi' ? '#fb923c' : '#22c55e',
                        color: 'white',
                        borderColor: 'transparent'
                      }}
                      onClick={() => {
                        setDeliveryStatusFilter('all')
                        setStatusFilter('all')
                      }}
                    >
                      {deliveryStatusFilter === 'tamami_teslim_alindi' ? 'Tamamı Teslim Alındı' :
                       deliveryStatusFilter === 'kismen_teslim_alindi' ? 'Kısmen Teslim Alındı' :
                       'Sipariş Verildi'}
                      <X className="w-3 h-3" />
                    </Badge>
                  )}
                  {statusFilter !== 'all' && deliveryStatusFilter === 'all' && (
                    <Badge 
                      variant="outline" 
                      className="bg-blue-50 text-blue-700 border-blue-200 gap-1 cursor-pointer hover:bg-blue-100"
                      onClick={() => setStatusFilter('all')}
                    >
                      {statusFilter}
                      <X className="w-3 h-3" />
                    </Badge>
                  )}
                  {locationFilter !== 'all' && (
                    <Badge 
                      variant="outline" 
                      className="bg-blue-50 text-blue-700 border-blue-200 gap-1 cursor-pointer hover:bg-blue-100"
                      onClick={() => setLocationFilter('all')}
                    >
                      {uniqueLocations.find(l => l.id === locationFilter)?.name}
                      <X className="w-3 h-3" />
                    </Badge>
                  )}
                  <button
                    onClick={() => {
                      setStatusFilter('all')
                      setLocationFilter('all')
                      setDeliveryStatusFilter('all')
                      setUnorderedOnlyFilter(false)
                      if (onUnorderedFilterChange) {
                        onUnorderedFilterChange(false)
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Tümünü Temizle
                  </button>
                </div>
              )}
              
              {/* Sonuç Sayısı */}
              <div className="text-sm text-gray-500 ml-auto">
                {totalCount} sonuç
              </div>
            </div>
          </div>

          <div className="hidden md:grid gap-4 px-4 py-3 bg-white rounded-2xl border border-gray-200" style={{gridTemplateColumns: '1fr 2fr 1.5fr 1.5fr 1.2fr 1fr 200px'}}>
            {/* Durum - Dropdown Filter */}
            <div className="relative">
              <button
                data-dropdown-trigger
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="flex items-center gap-1 text-xs font-medium text-black uppercase tracking-wider hover:text-gray-600 transition-colors"
              >
                Durum
                <ChevronDown className="w-3 h-3" />
                {(statusFilter !== 'all' || deliveryStatusFilter !== 'all') && (
                  <span className="ml-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                )}
              </button>
              {isStatusDropdownOpen && (
                <div data-dropdown className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setStatusFilter('all')
                        setDeliveryStatusFilter('all')
                        setIsStatusDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${statusFilter === 'all' && deliveryStatusFilter === 'all' ? 'bg-gray-100 font-medium' : ''}`}
                    >
                      Tümü
                    </button>
                    
                    {/* Teslimat Durumları - Özel Seçenekler */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Teslimat Durumu</div>
                      <button
                        onClick={() => {
                          setStatusFilter('sipariş verildi')
                          setDeliveryStatusFilter('tamami_teslim_alindi')
                          setIsStatusDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 flex items-center gap-2 ${deliveryStatusFilter === 'tamami_teslim_alindi' ? 'bg-gray-100 font-medium' : ''}`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2C5444' }}></span>
                        Tamamı Teslim Alındı
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter('sipariş verildi')
                          setDeliveryStatusFilter('kismen_teslim_alindi')
                          setIsStatusDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 flex items-center gap-2 ${deliveryStatusFilter === 'kismen_teslim_alindi' ? 'bg-gray-100 font-medium' : ''}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Kısmen Teslim Alındı
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter('sipariş verildi')
                          setDeliveryStatusFilter('siparis_verildi_sadece')
                          setIsStatusDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 flex items-center gap-2 ${deliveryStatusFilter === 'siparis_verildi_sadece' ? 'bg-gray-100 font-medium' : ''}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                        Sipariş Verildi (Teslimat Yok)
                      </button>
                    </div>
                    
                    {/* Normal Statuslar */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Diğer Durumlar</div>
                      {uniqueStatuses.map(status => (
                        <button
                          key={status}
                          onClick={() => {
                            setStatusFilter(status)
                            setDeliveryStatusFilter('all')
                            setIsStatusDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${statusFilter === status && deliveryStatusFilter === 'all' ? 'bg-gray-100 font-medium' : ''}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-xs font-medium text-black uppercase tracking-wider">Başlık</div>
            
            {/* Lokasyon - Dropdown Filter */}
            <div className="relative">
              <button
                data-dropdown-trigger
                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                className="flex items-center gap-1 text-xs font-medium text-black uppercase tracking-wider hover:text-gray-600 transition-colors"
              >
                Lokasyon
                <ChevronDown className="w-3 h-3" />
                {locationFilter !== 'all' && (
                  <span className="ml-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                )}
              </button>
              {isLocationDropdownOpen && (
                <div data-dropdown className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-64 overflow-y-auto">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setLocationFilter('all')
                        setIsLocationDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${locationFilter === 'all' ? 'bg-gray-100 font-medium' : ''}`}
                    >
                      Tümü
                    </button>
                    {uniqueLocations.map(location => (
                      <button
                        key={location.id}
                        onClick={() => {
                          setLocationFilter(location.id)
                          setIsLocationDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${locationFilter === location.id ? 'bg-gray-100 font-medium' : ''}`}
                      >
                        {location.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-xs font-medium text-black uppercase tracking-wider">Talep Eden</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Oluşturma Tarihi</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider">Talep No</div>
            <div className="text-xs font-medium text-black uppercase tracking-wider text-right">İşlemler</div>
          </div>

          {/* Satırlar */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center">
                <Loading size="md" text="Yükleniyor..." />
              </div>
            ) : error ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center text-red-600">
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-red-500/80" />
                  <span>Veriler yüklenirken hata oluştu</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refreshData()}
                    className="mt-2"
                  >
                    Tekrar Dene
                  </Button>
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center text-gray-500">
                <div className="flex flex-col items-center gap-2">
                  <Package className="w-8 h-8 text-gray-300" />
                  <span>
                    {filters.search || filters.status !== 'all' 
                      ? 'Filtre kriterlerinize uygun talep bulunamadı' 
                      : 'Henüz talep bulunamadı'
                    }
                  </span>
                </div>
              </div>
            ) : (
              filteredRequests.map((request, index) => {
                // Purchasing officer için "depoda mevcut değil" statusunda tıklanamaz
                const isClickable = (request.status !== 'draft' && request.status !== 'cancelled' && request.status !== 'rejected') &&
                                   !(userRole === 'purchasing_officer' && request.status === 'depoda mevcut değil')
                
                return (
                <div 
                  key={request.id}
                  className={`bg-white rounded-3xl border border-gray-200 p-4 transition-all duration-200 relative ${
                    isClickable
                      ? 'cursor-pointer hover:border-gray-300 hover:shadow-md' 
                      : userRole === 'purchasing_officer' && request.status === 'depoda mevcut değil'
                      ? 'cursor-not-allowed opacity-75'
                      : 'cursor-default'
                  }`}
                  onClick={() => handleRequestClick(request)}
                >
                  {/* Desktop Layout */}
                  <div className="hidden md:grid gap-4 items-center" style={{gridTemplateColumns: '1fr 2fr 1.5fr 1.5fr 1.2fr 1fr 200px'}}>
                    {/* Durum */}
                    <div className="flex flex-col gap-1">
                      {request.status === 'sipariş verildi' && (() => {
                        const deliveryStatus = calculateMaterialDeliveryStatus(request)
                        if (deliveryStatus) {
                          // Teslimat durumu badge'i varsa sadece onu göster
                          return (
                            <Badge 
                              className={`${deliveryStatus.className} border-0 ${deliveryStatus.rounded || 'rounded-full'} text-xs font-medium px-2 py-1`}
                              style={deliveryStatus.style}
                            >
                              {deliveryStatus.label}
                            </Badge>
                          )
                        }
                        // Teslimat durumu yoksa normal status badge'i göster
                        return getStatusBadge(request.status, request.notifications, request.site_id)
                      })()}
                      {request.status !== 'sipariş verildi' && getStatusBadge(request.status, request.notifications, request.site_id)}
                    </div>

                    {/* Başlık */}
                    <div 
                      onMouseEnter={(e) => handleMouseEnter(e, request.id)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      className="cursor-help"
                    >
                      <div className="font-normal text-gray-800 mb-1">
                        {request.title && request.title.length > 30 
                          ? `${request.title.substring(0, 30)}...` 
                          : request.title
                        }
                      </div>
                      {request.description && (
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {request.description.length > 50 
                            ? `${request.description.substring(0, 50)}...` 
                            : request.description
                          }
                        </div>
                      )}
                    </div>
                    
                    {/* Lokasyon */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 rounded-2xl">
                          <Building2 className="w-3 h-3 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-800">
                            {request.sites?.[0]?.name || request.site_name || 'Atanmamış'}
                          </div>
                          {request.site_id && (
                            <div className="text-xs text-gray-500">
                              ID: {request.site_id.slice(0, 8)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Talep Eden */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-2xl">
                          <User className="w-3 h-3 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-800">
                            {request.profiles?.full_name || 'Kullanıcı bulunamadı'}
                          </div>
                          {request.profiles?.email && (
                            <div className="text-xs text-gray-500">
                              {request.profiles.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Oluşturma Tarihi */}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gray-100 rounded-2xl">
                          <Calendar className="w-3 h-3 text-black" />
                        </div>
                        <div className="text-sm">
                          <div className="font-medium text-gray-800">{formatDate(request.created_at)}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Talep No */}
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-2xl">
                          <FileText className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-semibold text-gray-800">{request.request_number}</span>
                        {/* Siparişi verilmemiş malzeme uyarısı - sadece purchasing_officer için */}
                        {userRole === 'purchasing_officer' && request.unordered_materials_count && request.unordered_materials_count > 0 && (
                          <Badge 
                            variant="outline" 
                            className="bg-red-600 text-white border-0 rounded-full text-xs font-bold px-2 py-0.5 animate-pulse"
                            title={`${request.unordered_materials_count} malzemenin siparişi verilmedi!`}
                          >
                            {request.unordered_materials_count}
                          </Badge>
                        )}
                        {/* Teslim alınmamış sipariş uyarısı - santiye_depo ve santiye_depo_yonetici için */}
                        {(userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici' || userRole === 'site_manager') && request.overdue_deliveries_count && request.overdue_deliveries_count > 0 && (
                          <Badge 
                            variant="outline" 
                            className="bg-red-600 text-white border-0 rounded-full text-xs font-bold px-2 py-0.5 animate-pulse"
                            title={`${request.overdue_deliveries_count} siparişin teslim tarihi geçti!`}
                          >
                            {request.overdue_deliveries_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions - Site Manager ve Santiye Depo Yöneticisi için özel buton + Kebab Menu */}
                    <div className="relative flex justify-center items-center gap-2">
                      {/* Site Manager ve Santiye Depo Yöneticisi için Satın Almaya Gönder / Onayla butonu */}
                      {(userRole === 'site_manager' || userRole === 'santiye_depo_yonetici') && (() => {
                        // Tüm siteler için aynı statuslarda buton göster
                        return (
                          request.status === 'onay_bekliyor' || 
                          request.status === 'kısmen gönderildi' || 
                          request.status === 'depoda mevcut değil' || 
                          request.status === 'ana depoda yok'
                        )
                      })() && (
                        <Button
                          onClick={(e) => handleSiteManagerApproval(request.id, e)}
                          disabled={approving === request.id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                        >
                          {approving === request.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                              {request.status === 'onay_bekliyor' ? 'Onaylanıyor...' : 'Gönderiliyor...'}
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1.5" />
                              {request.status === 'onay_bekliyor' ? 'Onayla' : 'Satın Almaya Gönder'}
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Kebab Menu */}
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 hover:bg-gray-100 relative z-10"
                        onClick={(e) => toggleDropdown(request.id, e)}
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </Button>
                      
                      {openDropdownId === request.id && (
                        <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                          {canDeleteRequest(request) ? (
                            <button
                              onClick={(e) => openDeleteModal(request, e)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Kaldır
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Kaldır (İzin yok)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    {/* Header Row - Status & Title */}
                    <div className="flex items-start justify-between gap-3">
                      <div 
                        className="flex-1 cursor-help"
                        onMouseEnter={(e) => handleMouseEnter(e, request.id)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="font-normal text-gray-800 mb-1">
                          {request.title}
                        </div>
                        {request.description && (
                          <div className="text-sm text-gray-600 line-clamp-2">
                            {request.description.length > 80 
                              ? `${request.description.substring(0, 80)}...` 
                              : request.description
                            }
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-col gap-1">
                          {request.status === 'sipariş verildi' && (() => {
                            const deliveryStatus = calculateMaterialDeliveryStatus(request)
                            if (deliveryStatus) {
                              // Teslimat durumu badge'i varsa sadece onu göster
                              return (
                                <Badge 
                                  className={`${deliveryStatus.className} border-0 ${deliveryStatus.rounded || 'rounded-full'} text-xs font-medium px-2 py-1`}
                                  style={deliveryStatus.style}
                                >
                                  {deliveryStatus.label}
                                </Badge>
                              )
                            }
                            // Teslimat durumu yoksa normal status badge'i göster
                            return getStatusBadge(request.status, request.notifications, request.site_id)
                          })()}
                          {request.status !== 'sipariş verildi' && getStatusBadge(request.status, request.notifications, request.site_id)}
                        </div>
                        
                        {/* Kebab Menu */}
                        <div className="relative">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-gray-100 relative z-10"
                            onClick={(e) => toggleDropdown(request.id, e)}
                          >
                            <MoreVertical className="h-4 w-4 text-gray-500" />
                          </Button>
                          
                          {openDropdownId === request.id && (
                            <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                              {canDeleteRequest(request) ? (
                                <button
                                  onClick={(e) => openDeleteModal(request, e)}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Kaldır
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Kaldır (İzin yok)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Site Manager ve Santiye Depo Yöneticisi için Satın Almaya Gönder / Onayla butonu - Mobile */}
                    {(userRole === 'site_manager' || userRole === 'santiye_depo_yonetici') && (() => {
                      // Tüm siteler için aynı statuslarda buton göster
                      return (
                        request.status === 'onay_bekliyor' || 
                        request.status === 'kısmen gönderildi' || 
                        request.status === 'depoda mevcut değil' || 
                        request.status === 'ana depoda yok'
                      )
                    })() && (
                      <div className="pt-2">
                        <Button
                          onClick={(e) => handleSiteManagerApproval(request.id, e)}
                          disabled={approving === request.id}
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-5 rounded-xl"
                        >
                          {approving === request.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              {request.status === 'onay_bekliyor' ? 'Onaylanıyor...' : 'Gönderiliyor...'}
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              {request.status === 'onay_bekliyor' ? 'Onayla' : 'Satın Almaya Gönder'}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {/* Lokasyon */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Lokasyon</div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-gray-100 rounded-lg">
                            <Building2 className="w-3 h-3 text-gray-600" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {request.sites?.[0]?.name || request.site_name || 'Atanmamış'}
                          </span>
                        </div>
                      </div>

                      {/* Talep Eden */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Talep Eden</div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-blue-100 rounded-lg">
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {request.profiles?.full_name || 'Bilinmiyor'}
                          </span>
                        </div>
                      </div>

                      {/* Tarih */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Tarih</div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-gray-100 rounded-lg">
                            <Calendar className="w-3 h-3 text-black" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {formatDate(request.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Talep No */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Talep No</div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-gray-100 rounded-lg">
                            <FileText className="w-3 h-3 text-black" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">
                            {request.request_number}
                          </span>
                          {/* Siparişi verilmemiş malzeme uyarısı - sadece purchasing_officer için */}
                          {userRole === 'purchasing_officer' && request.unordered_materials_count && request.unordered_materials_count > 0 && (
                            <Badge 
                              variant="outline" 
                              className="bg-red-500 text-white border-0 rounded-full text-xs font-bold px-2 py-0.5 animate-pulse"
                              title={`${request.unordered_materials_count} malzemenin siparişi verilmedi!`}
                            >
                              {request.unordered_materials_count}
                            </Badge>
                          )}
                          {/* Teslim alınmamış sipariş uyarısı - santiye_depo ve santiye_depo_yonetici için */}
                          {(userRole === 'santiye_depo' || userRole === 'santiye_depo_yonetici' || userRole === 'site_manager') && request.overdue_deliveries_count && request.overdue_deliveries_count > 0 && (
                            <Badge 
                              variant="outline" 
                              className="bg-red-500 text-white border-0 rounded-full text-xs font-bold px-2 py-0.5 animate-pulse"
                              title={`${request.overdue_deliveries_count} siparişin teslim tarihi geçti!`}
                            >
                              {request.overdue_deliveries_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600 order-2 sm:order-1">
              {filteredRequests.length} / {totalCount} kayıt - Sayfa {currentPage} / {Math.ceil(totalCount / pageSize)}
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-xl"
              >
                Önceki
              </Button>
              
              {/* Sayfa numaraları */}
              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = Math.ceil(totalCount / pageSize)
                  const pages: (number | string)[] = []
                  
                  if (totalPages <= 7) {
                    // 7 veya daha az sayfa varsa hepsini göster
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // İlk sayfa her zaman göster
                    pages.push(1)
                    
                    if (currentPage <= 3) {
                      // Başta isek: 1, 2, 3, 4, 5, ..., son
                      for (let i = 2; i <= 5; i++) {
                        pages.push(i)
                      }
                      pages.push('...')
                      pages.push(totalPages)
                    } else if (currentPage >= totalPages - 2) {
                      // Sonda isek: 1, ..., son-4, son-3, son-2, son-1, son
                      pages.push('...')
                      for (let i = totalPages - 4; i <= totalPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      // Ortada isek: 1, ..., current-1, current, current+1, ..., son
                      pages.push('...')
                      pages.push(currentPage - 1)
                      pages.push(currentPage)
                      pages.push(currentPage + 1)
                      pages.push('...')
                      pages.push(totalPages)
                    }
                  }
                  
                  return pages.map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                          ...
                        </span>
                      )
                    }
                    
                    const pageNum = page as number
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 p-0 rounded-xl ${
                          currentPage === pageNum 
                            ? 'bg-[#00E676] text-white' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </Button>
                    )
                  })
                })()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="rounded-xl"
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
        
      </CardContent>

      {/* Materials Tooltip */}
      {hoveredRequestId && (
        <div 
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 max-w-sm pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y
          }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <Box className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-900 text-sm">Talep Edilen Malzemeler</span>
          </div>
          
          {loadingMaterials[hoveredRequestId] ? (
            <div className="flex items-center gap-2 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              <span className="text-xs text-gray-500">Yükleniyor...</span>
            </div>
          ) : requestMaterials[hoveredRequestId]?.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {requestMaterials[hoveredRequestId].map((material, index) => (
                <div key={material.id} className="flex items-start gap-2 py-1.5 px-2 bg-gray-50 rounded-lg">
                  <Hash className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-gray-900 truncate">
                      {material.item_name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-600">
                        {material.quantity} {material.unit}
                      </span>
                      {material.brand && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {material.brand}
                        </span>
                      )}
                    </div>
                    {material.material_class && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {material.material_class}
                        {material.material_group && ` • ${material.material_group}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 py-2">
              Malzeme bilgisi bulunamadı
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl border-0 shadow-xl">
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="flex items-center justify-center gap-2 text-gray-800 text-lg font-medium">
              <Trash2 className="w-5 h-5 text-red-600" />
              Talebi Kaldır
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm mt-2">
              Bu işlem geri alınamaz. Talep ve tüm ilgili malzemeler kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          
          {requestToDelete && (
            <div className="py-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Talep No</div>
                  <div className="font-medium text-gray-900">
                    {requestToDelete.request_number ? 
                      (() => {
                        const parts = requestToDelete.request_number.split('-')
                        if (parts.length >= 2) {
                          const lastPart = parts[parts.length - 1]
                          const secondLastPart = parts[parts.length - 2]
                          const lastTwoChars = secondLastPart.slice(-2)
                          return `${lastTwoChars}-${lastPart}`
                        }
                        return requestToDelete.request_number
                      })() :
                      `REQ-${requestToDelete.id.slice(-6)}`
                    }
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Başlık</div>
                  <div className="font-medium text-gray-900 truncate">
                    {requestToDelete.title}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              disabled={isDeleting}
              className="flex-1 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRequest}
              disabled={isDeleting}
              className="flex-1 rounded-xl border-0"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Siliniyor...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Kaldır
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Confirmation Modal - Artık orders'a ihtiyaç yok, direkt order bilgisi geçiliyor */}
    </Card>
  )
}
