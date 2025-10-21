'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'
import { Loading, InlineLoading } from '@/components/ui/loading'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { 
  Package, 
  Search, 
  Filter,
  Download,
  FileText,
  Building2,
  User,
  CheckCircle,
  Receipt,
  Image,
  Upload,
  Camera,
  X,
  CalendarIcon,
  XCircle,
  Check
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/components/offers/types'
import { generatePurchaseRequestReport, generatePurchaseRequestReportFast, ReportData } from '@/lib/pdf-generator'

interface OrderData {
  id: string
  purchase_request_id: string
  supplier_id: string
  delivery_date: string
  amount: number
  currency: string
  quantity: number
  returned_quantity?: number
  return_notes?: string
  is_return_reorder?: boolean
  status: string
  is_delivered: boolean
  created_at: string
  delivery_image_urls?: string[]  // order_deliveries.delivery_photos'dan gelir
  delivered_at?: string
  // Relations
  suppliers: {
    name: string
    contact_person?: string
    phone?: string
    email?: string
  } | null
  purchase_requests: {
    title: string
    request_number: string
    site_name?: string
    status: string
    sites?: {
      name: string
    }
  } | null
  purchase_request_items: {
    item_name: string
    unit: string
    brand?: string
    specifications?: string
  } | null
  invoices?: {
    id: string
    amount: number
    currency: string
    invoice_photos: string[]
    created_at: string
  }[]
}

// Siparişleri getiren fetcher - pagination ile
const fetchOrders = async (
  page: number = 1, 
  pageSize: number = 24,
  searchTerm: string = '',
  statusFilter: string = 'all',
  dateRange: { from: Date | undefined; to?: Date | undefined } = { from: undefined, to: undefined }
): Promise<{ orders: OrderData[], totalCount: number, totalPages: number }> => {
  const supabase = createClient()
  
  // Kullanıcı rolünü kontrol et
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Kullanıcı oturumu bulunamadı')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Sadece purchasing_officer, admin ve manager erişebilir
  const allowedRoles = ['purchasing_officer', 'admin', 'manager']
  if (!allowedRoles.includes(profile?.role)) {
    throw new Error('Bu sayfaya erişim yetkiniz yoktur')
  }

  // Query builder oluştur
  let query = supabase
    .from('orders')
    .select(`
      id,
      purchase_request_id,
      supplier_id,
      delivery_date,
      amount,
      currency,
      quantity,
      returned_quantity,
      return_notes,
      is_return_reorder,
      status,
      is_delivered,
      created_at,
      material_item_id,
      delivered_at,
      suppliers!orders_supplier_id_fkey (
        name,
        contact_person,
        phone,
        email
      ),
      purchase_requests!orders_purchase_request_id_fkey (
        title,
        request_number,
        site_name,
        status,
        sites!purchase_requests_site_id_fkey (
          name
        )
      ),
      purchase_request_items!fk_orders_material_item_id (
        item_name,
        unit,
        brand,
        specifications
      )
    `, { count: 'exact' })

  // Durum filtresi
  if (statusFilter !== 'all') {
    // Hem İngilizce hem Türkçe status değerlerini destekle
    if (statusFilter === 'partially_delivered') {
      query = query.or('status.eq.partially_delivered,status.eq.kısmen teslim alındı')
    } else {
      query = query.eq('status', statusFilter)
    }
  }

  // Tarih filtresi
  if (dateRange.from || dateRange.to) {
    if (dateRange.from && dateRange.to) {
      const start = new Date(dateRange.from)
      const end = new Date(dateRange.to)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      query = query.gte('delivery_date', start.toISOString().split('T')[0])
      query = query.lte('delivery_date', end.toISOString().split('T')[0])
    } else if (dateRange.from) {
      const start = new Date(dateRange.from)
      start.setHours(0, 0, 0, 0)
      query = query.gte('delivery_date', start.toISOString().split('T')[0])
    } else if (dateRange.to) {
      const end = new Date(dateRange.to)
      end.setHours(23, 59, 59, 999)
      query = query.lte('delivery_date', end.toISOString().split('T')[0])
    }
  }

  // Arama filtresi - bu kısmı basit tutuyoruz, çünkü join'li tablolarda text search karmaşık
  // Şimdilik sadece pagination ve diğer filtreleri uyguluyoruz
  
  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  query = query
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Sipariş verisi alınırken hata:', error)
    throw new Error('Sipariş verileri alınamadı')
  }

  // Her sipariş için fatura verilerini çek
  const ordersWithInvoices = await Promise.all(
    (data || []).map(async (order: any) => {
      // Fatura verilerini çek
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, amount, currency, invoice_photos, created_at')
        .eq('order_id', order.id)

      if (invoicesError) {
        console.error('Fatura verileri çekilirken hata:', invoicesError)
      }

      // İrsaliye fotoğraflarını order_deliveries tablosundan çek
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('order_deliveries')
        .select('delivery_photos, delivered_at')
        .eq('order_id', order.id)
        .order('delivered_at', { ascending: false })

      if (deliveriesError) {
        console.error('Teslimat verileri çekilirken hata:', deliveriesError)
      }

      // Teslimat fotoğraflarını düzleştir (sadece order_deliveries'den)
      const deliveryPhotosArrays: string[][] = (deliveriesData || [])
        .map((d: { delivery_photos?: string[] | null }) => d.delivery_photos || [])
      const flattenedDeliveryPhotos: string[] = deliveryPhotosArrays.flat().filter(Boolean)

      // En son teslimat tarihini al
      const lastDeliveredAt = deliveriesData?.[0]?.delivered_at || order.delivered_at

      return {
        ...order,
        suppliers: order.suppliers || null,
        purchase_requests: order.purchase_requests || null,
        purchase_request_items: order.purchase_request_items || null,
        invoices: invoicesData || [],
        // İrsaliye fotoğrafları sadece order_deliveries tablosundan
        delivery_image_urls: flattenedDeliveryPhotos,
        delivered_at: lastDeliveredAt
      }
    })
  )

  // Arama filtresi - frontend'de uyguluyoruz çünkü join'li tablolarda backend search karmaşık
  let filteredOrders = ordersWithInvoices
  if (searchTerm) {
    filteredOrders = ordersWithInvoices.filter(order => 
      order.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.purchase_request_items?.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.purchase_requests?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.purchase_requests?.request_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    orders: filteredOrders,
    totalCount,
    totalPages
  }
}

export default function OrdersPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Date filter state
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 24
  
  // Image viewer state
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
  // Invoice modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceCurrency, setInvoiceCurrency] = useState('TRY')
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([])
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false)

  // Invoice viewer state
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([])
  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState(0)

  // Invoice edit state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [editInvoiceAmount, setEditInvoiceAmount] = useState('')
  const [editInvoiceCurrency, setEditInvoiceCurrency] = useState('TRY')
  const [editInvoicePhotos, setEditInvoicePhotos] = useState<string[]>([])
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false)

  // Multi-select state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [orderAmounts, setOrderAmounts] = useState<Record<string, string>>({})
  const [orderCurrencies, setOrderCurrencies] = useState<Record<string, string>>({})
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [loadingPDFOrders, setLoadingPDFOrders] = useState<Set<string>>(new Set())

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  // SWR ile veri çekme - pagination parametreleriyle
  const { data: ordersData, error, isLoading, mutate } = useSWR(
    ['orders_delivered', currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, dateRange],
    () => fetchOrders(currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, dateRange),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 3
    }
  )

  const orders = ordersData?.orders || []
  const totalCount = ordersData?.totalCount || 0
  const totalPagesFromAPI = ordersData?.totalPages || 1

  // Artık filtreleme backend'de yapılıyor, sadece orders'ı kullanıyoruz
  const filteredOrders = orders || []

  // Siparişleri talep bazında gruplandır
  const groupedOrders = filteredOrders.reduce((groups, order) => {
    const requestId = order.purchase_request_id
    if (!groups[requestId]) {
      groups[requestId] = {
        request: order.purchase_requests,
        orders: []
      }
    }
    groups[requestId].orders.push(order)
    return groups
  }, {} as Record<string, { request: any; orders: OrderData[] }>)

  // Grupları düzleştir ve sırala
  const groupedOrdersList = Object.values(groupedOrders).sort((a, b) => {
    // En son oluşturulan siparişe göre sırala
    const aLatest = Math.max(...a.orders.map(o => new Date(o.created_at).getTime()))
    const bLatest = Math.max(...b.orders.map(o => new Date(o.created_at).getTime()))
    return bLatest - aLatest
  })

  // Pagination hesaplamaları - artık backend'den geliyor
  const totalPages = totalPagesFromAPI
  const paginatedGroups = groupedOrdersList // Artık backend'de pagination yapılıyor

  // Filtre değiştiğinde ilk sayfaya dön
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, statusFilter, dateRange])

  // Tarih filtrelerini temizle
  const clearDateFilters = () => {
    setDateRange({ from: undefined, to: undefined })
  }

  // Modal functions
  const handleViewDeliveryPhotos = (photos: string[], index = 0) => {
    setSelectedImages(photos)
    setSelectedImageIndex(index)
    setIsImageViewerOpen(true)
  }

  const handleOpenInvoiceModal = (orderId: string) => {
    setSelectedOrderId(orderId)
    setInvoiceAmount('')
    setInvoicePhotos([])
    setIsInvoiceModalOpen(true)
  }

  const handleCloseInvoiceModal = () => {
    setIsInvoiceModalOpen(false)
    setSelectedOrderId(null)
    setInvoiceAmount('')
    setInvoicePhotos([])
    setOrderAmounts({})
    setOrderCurrencies({})
  }

  // Multi-select functions
  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const selectAllOrdersInGroup = (groupOrders: OrderData[]) => {
    const newSelected = new Set(selectedOrders)
    const groupOrderIds = groupOrders.map(order => order.id)
    
    // Eğer grup içindeki tüm siparişler seçiliyse, hepsini kaldır
    const allSelected = groupOrderIds.every(id => newSelected.has(id))
    
    if (allSelected) {
      groupOrderIds.forEach(id => newSelected.delete(id))
    } else {
      groupOrderIds.forEach(id => newSelected.add(id))
    }
    
    setSelectedOrders(newSelected)
  }

  const handleOpenMultiInvoiceModal = () => {
    if (selectedOrders.size === 0) {
      showToast('Lütfen en az bir sipariş seçin', 'error')
      return
    }
    
    // Seçili siparişleri al ve her biri için boş tutar ve varsayılan para birimi oluştur
    const selectedOrdersArray = Array.from(selectedOrders)
    const orderAmounts: Record<string, string> = {}
    const orderCurrencies: Record<string, string> = {}
    selectedOrdersArray.forEach(orderId => {
      orderAmounts[orderId] = ''
      orderCurrencies[orderId] = 'TRY' // Varsayılan para birimi
    })
    setOrderAmounts(orderAmounts)
    setOrderCurrencies(orderCurrencies)
    
    setSelectedOrderId(null) // Multi-select için null
    setInvoiceAmount('')
    setInvoicePhotos([])
    setIsInvoiceModalOpen(true)
  }

  const clearSelection = () => {
    setSelectedOrders(new Set())
    setIsMultiSelectMode(false)
  }

  // Invoice viewer functions
  const handleViewInvoices = (invoices: any[], index = 0) => {
    setSelectedInvoices(invoices)
    setSelectedInvoiceIndex(index)
    setIsInvoiceViewerOpen(true)
    // Reset edit state
    setEditingInvoiceId(null)
  }

  // Invoice edit functions
  const handleStartEditInvoice = (invoice: any) => {
    setEditingInvoiceId(invoice.id)
    setEditInvoiceAmount(invoice.amount.toString())
    setEditInvoiceCurrency(invoice.currency)
    setEditInvoicePhotos([...invoice.invoice_photos])
  }

  const handleCancelEditInvoice = () => {
    setEditingInvoiceId(null)
    setEditInvoiceAmount('')
    setEditInvoiceCurrency('TRY')
    setEditInvoicePhotos([])
  }

  const handleEditInvoiceAmountChange = (value: string) => {
    const numericValue = parseNumberFromDots(value)
    setEditInvoiceAmount(numericValue)
  }

  const handleEditFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUpdatingInvoice(true)
    
    try {
      const filePromises = Array.from(files).map(async (file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })

      const base64Files = await Promise.all(filePromises)
      setEditInvoicePhotos(prev => [...prev, ...base64Files])
      showToast('Fotoğraflar başarıyla yüklendi', 'success')
      
    } catch (error: any) {
      console.error('Upload error:', error)
      showToast('Fotoğraf yükleme hatası: ' + error.message, 'error')
    } finally {
      setIsUpdatingInvoice(false)
    }
  }

  const handleRemoveEditPhoto = (index: number) => {
    setEditInvoicePhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateInvoice = async () => {
    if (!editingInvoiceId || !editInvoiceAmount || editInvoicePhotos.length === 0) {
      showToast('Lütfen tüm alanları doldurun', 'error')
      return
    }

    setIsUpdatingInvoice(true)
    
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('invoices')
        .update({
          amount: parseFloat(editInvoiceAmount),
          currency: editInvoiceCurrency,
          invoice_photos: editInvoicePhotos,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingInvoiceId)

      if (error) {
        console.error('❌ Fatura güncelleme hatası:', error)
        throw error
      }

      console.log('✅ Fatura başarıyla güncellendi:', data)
      showToast('Fatura başarıyla güncellendi', 'success')
      
      // Reset edit state
      handleCancelEditInvoice()
      
      // Refresh data
      await mutate()
      
      // Update selected invoices for viewer
      const updatedInvoices = selectedInvoices.map(inv => 
        inv.id === editingInvoiceId 
          ? { 
              ...inv, 
              amount: parseFloat(editInvoiceAmount),
              currency: editInvoiceCurrency,
              invoice_photos: editInvoicePhotos 
            }
          : inv
      )
      setSelectedInvoices(updatedInvoices)
      
    } catch (error: any) {
      console.error('❌ Fatura güncelleme hatası:', error)
      showToast('Fatura güncelleme hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setIsUpdatingInvoice(false)
    }
  }

  // Get selected orders data for multi-invoice modal
  const getSelectedOrdersData = () => {
    if (!orders) return []
    return orders.filter(order => selectedOrders.has(order.id))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploadingInvoice(true)
    
    try {
      // Geçici olarak base64 kullan (storage RLS sorunu çözülene kadar)
      const filePromises = Array.from(files).map(async (file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })

      const base64Files = await Promise.all(filePromises)
      setInvoicePhotos(prev => [...prev, ...base64Files])
      showToast('Fotoğraflar başarıyla yüklendi', 'success')
      
    } catch (error: any) {
      console.error('Upload error:', error)
      showToast('Fotoğraf yükleme hatası: ' + error.message, 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const handleSubmitInvoice = async () => {
    // Multi-select mode için kontrol
    const orderIds = selectedOrderId ? [selectedOrderId] : Array.from(selectedOrders)
    
    if (orderIds.length === 0 || invoicePhotos.length === 0) {
      showToast('Lütfen en az bir fotoğraf ekleyin', 'error')
      return
    }

    // Tek sipariş için tutar kontrolü
    if (selectedOrderId && !invoiceAmount) {
      showToast('Lütfen fatura tutarını girin', 'error')
      return
    }

    // Çoklu sipariş için her sipariş tutarı ve para birimi kontrolü
    if (!selectedOrderId) {
      const missingAmounts = orderIds.filter(orderId => !orderAmounts[orderId] || orderAmounts[orderId].trim() === '')
      if (missingAmounts.length > 0) {
        showToast('Lütfen tüm siparişler için fatura tutarını girin', 'error')
        return
      }
      
      const missingCurrencies = orderIds.filter(orderId => !orderCurrencies[orderId])
      if (missingCurrencies.length > 0) {
        showToast('Lütfen tüm siparişler için para birimini seçin', 'error')
        return
      }
    }

    setIsUploadingInvoice(true)
    
    try {
      const supabase = createClient()
      
      // Fatura verilerini hazırla
      const invoiceData = orderIds.map(orderId => ({
        order_id: orderId,
        amount: selectedOrderId 
          ? parseFloat(invoiceAmount) 
          : parseFloat(orderAmounts[orderId]),
        currency: selectedOrderId 
          ? invoiceCurrency 
          : (orderCurrencies[orderId] || 'TRY'),
        invoice_photos: invoicePhotos,
        created_at: new Date().toISOString()
      }))

      // Fatura verilerini veritabanına kaydet
      const { data, error } = await supabase
        .from('invoices')
        .insert(invoiceData)

      if (error) {
        console.error('❌ Fatura kaydetme hatası:', error)
        throw error
      }

      console.log('✅ Fatura başarıyla kaydedildi:', data)
      showToast(
        orderIds.length === 1 
          ? 'Fatura başarıyla eklendi' 
          : `${orderIds.length} sipariş için fatura başarıyla eklendi`, 
        'success'
      )
      handleCloseInvoiceModal()
      clearSelection()
      
      // Siparişleri yeniden yükle (faturanın gösterilmesi için)
      await mutate()
    } catch (error: any) {
      console.error('❌ Fatura ekleme hatası:', error)
      showToast('Fatura ekleme hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const removePhoto = (index: number) => {
    setInvoicePhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Binlik ayırıcı fonksiyonları
  const formatNumberWithDots = (value: string) => {
    // Sadece rakamları al
    const numericValue = value.replace(/[^\d]/g, '')
    if (!numericValue) return ''
    
    // Binlik ayırıcı ekle
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const parseNumberFromDots = (value: string) => {
    // Noktaları kaldır ve sadece rakamları döndür
    return value.replace(/\./g, '')
  }

  const handleInvoiceAmountChange = (value: string) => {
    const numericValue = parseNumberFromDots(value)
    setInvoiceAmount(numericValue)
  }

  const handleOrderAmountChange = (orderId: string, value: string) => {
    const numericValue = parseNumberFromDots(value)
    setOrderAmounts(prev => ({
      ...prev,
      [orderId]: numericValue
    }))
  }

  const handleOrderCurrencyChange = (orderId: string, currency: string) => {
    setOrderCurrencies(prev => ({
      ...prev,
      [orderId]: currency
    }))
  }

  // Toplu PDF Export fonksiyonu
  const handleExportMultiplePDF = async () => {
    if (selectedOrders.size === 0) {
      showToast('Lütfen en az bir sipariş seçin', 'error')
      return
    }

    setIsGeneratingReport(true)
    
    try {
      console.log('📋 Toplu PDF Export başlatılıyor:', {
        selectedCount: selectedOrders.size,
        selectedOrderIds: Array.from(selectedOrders)
      })

      // Seçili siparişleri al
      const selectedOrdersData = orders?.filter(order => selectedOrders.has(order.id)) || []
      
      if (selectedOrdersData.length === 0) {
        showToast('Seçili sipariş bulunamadı', 'error')
        return
      }

      // İlk siparişin request_id'sini al (tüm seçili siparişler aynı talepten olmalı)
      const firstRequestId = selectedOrdersData[0].purchase_request_id
      
      // Timeline verilerini çek
      const response = await fetch(`/api/reports/timeline?requestId=${firstRequestId}`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const timelineData = await response.json()
      console.log('📊 Timeline Data alındı:', timelineData)

      // Sadece seçili siparişlerin verilerini filtrele
      const selectedOrderIds = Array.from(selectedOrders)
      const filteredOrders = timelineData.orders.filter((order: any) => 
        selectedOrderIds.includes(order.id)
      )
      
      const filteredInvoices = timelineData.invoices.filter((invoice: any) => 
        selectedOrderIds.includes(invoice.order_id)
      )

      // Timeline'ı seçili siparişlere göre filtrele
      const filteredTimeline = timelineData.timeline.filter((item: any) => {
        if (item.type === 'order' || item.type === 'shipment') {
          return selectedOrderIds.includes(item.order_id)
        }
        if (item.type === 'invoice') {
          return selectedOrderIds.includes(item.invoice?.order_id)
        }
        return true // request, offer gibi genel olayları dahil et
      })

      // İstatistikleri hesapla
      const totalAmount = filteredOrders.reduce((sum: number, order: any) => {
        const invoiceAmount = order.invoices?.reduce((invSum: number, inv: any) => invSum + inv.amount, 0) || 0
        return sum + (invoiceAmount > 0 ? invoiceAmount : order.amount)
      }, 0)

      const totalDays = Math.ceil(
        (new Date().getTime() - new Date(filteredOrders[filteredOrders.length - 1]?.created_at || new Date()).getTime()) / (1000 * 60 * 60 * 24)
      )

      // PDF verilerini hazırla
      const pdfData: ReportData = {
        request: timelineData.request,
        timeline: filteredTimeline,
        orders: filteredOrders,
        invoices: filteredInvoices,
        statistics: {
          totalDays: totalDays,
          totalOffers: filteredOrders.length,
          totalShipments: filteredOrders.filter((o: any) => o.is_delivered).length,
          totalInvoices: filteredOrders.reduce((sum: number, order: any) => sum + (order.invoices?.length || 0), 0),
          totalAmount: totalAmount,
          currency: filteredOrders[0]?.currency || 'TRY'
        }
      }

      console.log('📄 Toplu PDF Data hazırlandı:', {
        selectedOrdersCount: filteredOrders.length,
        invoicesCount: filteredInvoices.length,
        timelineCount: filteredTimeline.length,
        totalAmount: pdfData.statistics.totalAmount
      })

      // PDF oluştur - Hızlı versiyon
      await generatePurchaseRequestReportFast(pdfData)
      showToast(`${selectedOrders.size} sipariş için PDF başarıyla oluşturuldu`, 'success')

    } catch (error) {
      console.error('Toplu PDF export error:', error)
      showToast('Toplu PDF oluşturulurken hata oluştu', 'error')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  // PDF Export fonksiyonu - Timeline API kullanarak
  const handleExportOrderPDF = async (order: OrderData) => {
    // Loading state'i başlat
    setLoadingPDFOrders(prev => new Set([...prev, order.id]))
    
    try {
      console.log('📋 PDF Export başlatılıyor:', {
        orderId: order.id,
        requestId: order.purchase_request_id,
        supplierName: order.suppliers?.name,
        itemName: order.purchase_request_items?.item_name
      })

      // Timeline API'sini kullan (raporlar sayfasındaki gibi)
      const response = await fetch(`/api/reports/timeline?requestId=${order.purchase_request_id}`)
      
      if (!response.ok) {
        console.error('❌ Timeline API hatası:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        })
        throw new Error('Timeline verileri alınamadı')
      }
      
      const timelineData = await response.json()
      
      console.log('📊 Timeline API Response:', {
        requestId: order.purchase_request_id,
        ordersFound: timelineData.orders?.length || 0,
        timelineLength: timelineData.timeline?.length || 0,
        hasOrdersProperty: 'orders' in timelineData
      })

      // Sadece bu spesifik siparişi filtrele
      const specificOrder = timelineData.orders?.find((o: any) => o.id === order.id)
      const specificInvoices = timelineData.invoices?.filter((inv: any) => 
        inv.orders?.purchase_request_id === order.purchase_request_id &&
        timelineData.orders?.some((o: any) => o.id === order.id && inv.order_id === o.id)
      ) || []

      // Timeline'ı bu sipariş için filtrele
      const filteredTimeline = timelineData.timeline?.filter((item: any) => {
        if (item.type === 'order' && item.order_data) {
          // Bu siparişe ait order timeline'ları
          return item.order_data.supplier_name === order.suppliers?.name &&
                 item.order_data.item_name === order.purchase_request_items?.item_name
        }
        if (item.type === 'invoice' && item.invoice_data) {
          // Bu siparişe ait invoice timeline'ları
          return specificInvoices.some((inv: any) => 
            inv.amount === item.invoice_data.amount &&
            inv.currency === item.invoice_data.currency
          )
        }
        // Diğer timeline itemları (creation, approval, etc.) dahil et
        return ['creation', 'approval', 'shipment'].includes(item.type)
      }) || []

      // PDF verilerini hazırla
      const pdfData: ReportData = {
        request: timelineData.request,
        timeline: filteredTimeline,
        orders: specificOrder ? [specificOrder] : [order], // Spesifik sipariş
        invoices: specificInvoices,
        statistics: {
          totalDays: Math.ceil(
            (new Date().getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
          totalOffers: 1,
          totalShipments: order.is_delivered ? 1 : 0,
          totalInvoices: specificInvoices.length,
          totalAmount: specificInvoices.length > 0 
            ? specificInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
            : order.amount,
          currency: order.currency
        }
      }

      console.log('📄 PDF Data hazırlandı:', {
        ordersCount: pdfData.orders.length,
        invoicesCount: pdfData.invoices.length,
        timelineCount: pdfData.timeline.length,
        totalAmount: pdfData.statistics.totalAmount
      })

      // PDF oluştur - Hızlı versiyon
      await generatePurchaseRequestReportFast(pdfData)
      showToast('PDF başarıyla oluşturuldu', 'success')

    } catch (error: any) {
      console.error('PDF export error:', error)
      showToast('PDF oluşturma hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    } finally {
      // Loading state'i temizle
      setLoadingPDFOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(order.id)
        return newSet
      })
    }
  }


  // Hata durumu
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold">Hata Oluştu</h2>
            <p className="text-gray-600 mt-2">{error.message}</p>
          </div>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Dashboard'a Dön
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-8 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Siparişler</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Teslim alınmış taleplere ait sipariş yönetimi</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs sm:text-sm">
              {filteredOrders.length} Sipariş
            </Badge>
            {selectedOrders.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600 text-white text-xs sm:text-sm">
                  {selectedOrders.size} Seçili
                </Badge>
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Seçimi Temizle
                </Button>
              </div>
            )}
          </div>
          
        </div>
      </div>


      {/* Summary Stats */}
      {filteredOrders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Teslim Edildi</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl md:text-2xl font-bold text-gray-900">
                      {filteredOrders.filter(o => o.status === 'delivered' || o.is_delivered).length}
                    </span>
                    <div className="hidden md:flex items-center text-green-600 text-sm">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Tamamlandı</span>
                    </div>
                  </div>
                  <p className="hidden md:block text-xs text-gray-500 mt-1">Başarıyla teslim edildi</p>
                  <p className="hidden lg:block text-xs text-gray-400">Sipariş süreci tamamlandı</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Kısmi Teslim</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl md:text-2xl font-bold text-gray-900">
                      {filteredOrders.filter(o => o.status === 'partially_delivered' || o.status === 'kısmen teslim alındı').length}
                    </span>
                    <div className="hidden md:flex items-center text-orange-600 text-sm">
                      <Package className="h-3 w-3 mr-1" />
                      <span>Devam Ediyor</span>
                    </div>
                  </div>
                  <p className="hidden md:block text-xs text-gray-500 mt-1">Kısmi teslimat yapıldı</p>
                  <p className="hidden lg:block text-xs text-gray-400">Bekleyen teslimatlar var</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">İade Edildi</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl md:text-2xl font-bold text-gray-900">
                      {filteredOrders.filter(o => o.status === 'iade edildi').length}
                    </span>
                    <div className="hidden md:flex items-center text-red-600 text-sm">
                      <XCircle className="h-3 w-3 mr-1" />
                      <span>İade</span>
                    </div>
                  </div>
                  <p className="hidden md:block text-xs text-gray-500 mt-1">İade edilen siparişler</p>
                  <p className="hidden lg:block text-xs text-gray-400">Yeniden sipariş gerekebilir</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div className="w-full">
                  <p className="text-xs md:text-sm text-gray-600 mb-1">Toplam Sipariş</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl md:text-2xl font-bold text-gray-900">{filteredOrders.length}</span>
                    <div className="hidden md:flex items-center text-blue-600 text-sm">
                      <Building2 className="h-3 w-3 mr-1" />
                      <span>Aktif</span>
                    </div>
                  </div>
                  <p className="hidden md:block text-xs text-gray-500 mt-1">Tüm sipariş kayıtları</p>
                  <p className="hidden lg:block text-xs text-gray-400">Sistem generi toplam</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}


      {/* Orders Table */}
      <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">Sipariş Listesi</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Teslim alınmış taleplere ait sipariş detayları</p>
                </div>
              </div>
              
              {/* Search ve Filtreler */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                  placeholder="Tedarikçi, malzeme adı, talep başlığı veya talep numarası ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 md:h-11 text-sm md:text-base border-gray-200 focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 h-10 md:h-11 text-sm md:text-base border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400 text-gray-900 sm:w-auto w-full"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="pending">Bekliyor</option>
              <option value="delivered">Teslim Edildi</option>
              <option value="partially_delivered">Kısmi Teslim</option>
              <option value="iade edildi">İade Edildi</option>
            </select>

              {/* Tarih Filtresi - Popover */}
              <Popover modal={false}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`h-10 md:h-11 px-4 text-sm md:text-base sm:w-auto w-full inline-flex items-center justify-start gap-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors ${
                      (dateRange.from || dateRange.to) ? 'border-gray-900 text-gray-900' : 'text-gray-700'
                    }`}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      <span className="truncate">
                        {format(dateRange.from, 'dd MMM', { locale: tr })} - {format(dateRange.to, 'dd MMM', { locale: tr })}
                      </span>
                    ) : dateRange.from ? (
                      <span className="truncate">
                        {format(dateRange.from, 'dd MMM yyyy', { locale: tr })}
                      </span>
                    ) : (
                      'Tarih Seç'
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 bg-white shadow-lg border border-gray-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2" 
                  align="start" 
                  side="bottom" 
                  sideOffset={8}
                >
                  <div className="p-3">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                      numberOfMonths={1}
                      locale={tr}
                      classNames={{
                        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
                        day_button: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md transition-colors data-[selected=true]:bg-black data-[selected=true]:text-white data-[selected=true]:hover:bg-gray-800 data-[selected=true]:focus:bg-black",
                        day_selected: "!bg-black !text-white hover:!bg-gray-800 focus:!bg-black",
                        day_today: "bg-gray-100 font-semibold",
                        day_outside: "text-gray-400 opacity-50",
                        day_disabled: "text-gray-400 opacity-50",
                        day_range_middle: "aria-selected:bg-gray-200 aria-selected:text-gray-900",
                        day_range_start: "!bg-black !text-white rounded-l-md",
                        day_range_end: "!bg-black !text-white rounded-r-md",
                        day_hidden: "invisible",
                      }}
                    />
                    {(dateRange.from || dateRange.to) && (
                      <div className="border-t pt-3 mt-3">
                        <button
                          type="button"
                          onClick={clearDateFilters}
                          className="w-full text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md transition-colors inline-flex items-center justify-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Temizle
                        </button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loading size="lg" text="Siparişler yükleniyor..." />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sipariş Bulunamadı</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Arama kriterlerine uygun sipariş bulunamadı.' : 'Henüz teslim alınmış sipariş bulunmuyor.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                {/* Table Header */}
                <div className="grid gap-3 pb-4 text-xs font-medium text-gray-500 border-b border-gray-200" style={{gridTemplateColumns: '40px minmax(160px, 1.8fr) minmax(160px, 1.8fr) minmax(90px, 1fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(50px, 0.7fr) minmax(120px, 1.3fr)'}}>
                  <div></div>
                  <div>Tedarikçi</div>
                  <div>Malzeme</div>
                  <div>Miktar</div>
                  <div>Şantiye</div>
                  <div>Durum</div>
                  <div>Teslimat</div>
                  <div>İrsaliye</div>
                  <div>İşlemler</div>
                </div>
                
                {/* Grouped Table Rows */}
                <div className="space-y-6 pt-4">
                  {paginatedGroups.map((group, groupIndex) => (
                    <div key={group.request?.id || groupIndex} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      {/* Talep Başlığı */}
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-gray-900">
                              Talep: {group.request?.request_number ? 
                                group.request.request_number.slice(-6) : 'Bilinmiyor'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {group.request?.title || 'Başlık belirtilmemiş'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-xs text-gray-500">
                              {group.orders.length} sipariş
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectAllOrdersInGroup(group.orders)}
                              className="text-xs h-7 px-2"
                            >
                              {group.orders.every(order => selectedOrders.has(order.id)) ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Siparişler */}
                      <div className="divide-y divide-gray-100">
                        {group.orders.map((order, orderIndex) => (
                          <div 
                            key={order.id} 
                            className={`grid gap-3 items-start py-3 px-4 text-xs cursor-pointer transition-colors ${
                              selectedOrders.has(order.id) 
                                ? 'bg-gray-100 border-l-4 border-gray-900' 
                                : 'hover:bg-gray-50'
                            }`}
                            style={{gridTemplateColumns: '40px minmax(160px, 1.8fr) minmax(160px, 1.8fr) minmax(90px, 1fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(70px, 0.9fr) minmax(50px, 0.7fr) minmax(120px, 1.3fr)'}}
                            onClick={() => toggleOrderSelection(order.id)}
                          >
                            {/* Checkbox */}
                            <div className="flex items-center justify-center">
                              <div 
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  selectedOrders.has(order.id)
                                    ? 'bg-gray-900 border-gray-900'
                                    : 'border-gray-300 hover:border-gray-500'
                                }`}
                              >
                                {selectedOrders.has(order.id) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                            
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm break-words leading-tight">
                          {order.suppliers?.name || 'Tedarikçi belirtilmemiş'}
                        </div>
                        {order.suppliers?.contact_person && (
                          <div className="text-xs text-gray-500 break-words leading-tight mt-1">{order.suppliers.contact_person}</div>
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm break-words leading-tight">
                          {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                        </div>
                        {order.purchase_request_items?.brand && (
                          <div className="text-xs text-gray-500 break-words leading-tight mt-1">Marka: {order.purchase_request_items.brand}</div>
                        )}
                        {order.is_return_reorder && (
                          <div className="text-xs text-purple-600 font-medium mt-1">İade yeniden siparişi</div>
                        )}
                      </div>
                      
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          {order.quantity} {order.purchase_request_items?.unit || ''}
                        </div>
                        {order.returned_quantity > 0 && (
                          <div className="text-xs text-orange-600">
                            İade: {order.returned_quantity} {order.purchase_request_items?.unit || ''}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-gray-600 text-sm break-words leading-tight min-w-0">
                        {order.purchase_requests?.site_name || order.purchase_requests?.sites?.name || 'Belirtilmemiş'}
                      </div>
                      
                      <div>
                        <Badge
                          className={
                            order.status === 'delivered' || order.is_delivered
                              ? 'bg-green-100 text-green-700 border-0 text-xs'
                              : order.status === 'partially_delivered' || order.status === 'kısmen teslim alındı'
                              ? 'bg-orange-100 text-orange-700 border-0 text-xs'
                              : order.status === 'iade edildi'
                              ? 'bg-red-100 text-red-700 border-0 text-xs'
                              : 'bg-gray-100 text-gray-700 border-0 text-xs'
                          }
                        >
                          {order.status === 'delivered' || order.is_delivered 
                            ? 'Teslim Edildi' 
                            : order.status === 'partially_delivered' || order.status === 'kısmen teslim alındı'
                            ? 'Kısmi Teslim'
                            : order.status === 'iade edildi'
                            ? 'İade Edildi'
                            : 'Bekliyor'
                          }
                        </Badge>
                      </div>
                      
                      <div className="text-gray-600 text-xs">
                        {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                      </div>
                      
                      {/* İrsaliye Fotoğrafları */}
                      <div className="flex items-center">
                        {order.delivery_image_urls && order.delivery_image_urls.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, 0)}
                              className="w-8 h-8 rounded border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 overflow-hidden bg-white"
                            >
                              <img
                                src={order.delivery_image_urls[0]}
                                alt="İrsaliye"
                                className="w-full h-full object-cover"
                              />
                            </button>
                            {order.delivery_image_urls.length > 1 && (
                              <span className="text-xs text-gray-500">
                                +{order.delivery_image_urls.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                      
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              {/* Fatura Durumu */}
                              <div className="flex-1">
                                {order.invoices && order.invoices.length > 0 ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleViewInvoices(order.invoices, 0)
                                    }}
                                    className="w-full flex items-center justify-center gap-1 px-1 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700 hover:bg-green-100 transition-colors cursor-pointer h-9"
                                  >
                                    <Receipt className="h-3 w-3" />
                                    <span className="font-medium text-xs">Fatura ({order.invoices.length})</span>
                                  </button>
                                ) : selectedOrders.size > 0 && selectedOrders.has(order.id) ? (
                                  <div className="w-full flex items-center justify-center gap-1 px-1 py-1 bg-gray-100 border border-gray-300 rounded text-xs text-gray-700 h-7">
                                    <Receipt className="h-3 w-3" />
                                    <span className="font-medium text-xs">Seçili</span>
                                  </div>
                                ) : (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenInvoiceModal(order.id)
                                    }}
                                    size="sm"
                                    className="w-full bg-gray-900 hover:bg-gray-800 text-white text-xs px-1 py-1 h-9"
                                  >
                                    Fatura
                                  </Button>
                                )}
                              </div>
                              
                              {/* PDF Export Butonu */}
                              <div className="flex-1">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleExportOrderPDF(order)
                                  }}
                                  size="sm"
                                  variant="outline"
                                  disabled={loadingPDFOrders.has(order.id)}
                                  className="w-full text-xs px-1 py-1 h-9 border-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {loadingPDFOrders.has(order.id) ? (
                                    <>
                                      <InlineLoading className="mr-1" />
                                      PDF
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="h-3 w-3 mr-1" />
                                      PDF
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-6">
                  {paginatedGroups.map((group, groupIndex) => (
                    <div key={group.request?.id || groupIndex} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                      {/* Talep Başlığı - Mobile */}
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-sm">
                              Talep: {group.request?.request_number ? 
                                group.request.request_number.slice(-6) : 'Bilinmiyor'}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {group.request?.title || 'Başlık belirtilmemiş'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                              {group.orders.length} sipariş
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => selectAllOrdersInGroup(group.orders)}
                                className="text-xs h-6 px-2"
                              >
                                {group.orders.every(order => selectedOrders.has(order.id)) ? 'Kaldır' : 'Tümü'}
                              </Button>
                              {group.orders.some(order => selectedOrders.has(order.id)) && (
                                <>
                                  <Button
                                    onClick={handleOpenMultiInvoiceModal}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-6 px-2"
                                  >
                                    <Receipt className="h-3 w-3 mr-1" />
                                    Fatura
                                  </Button>
                                  <Button
                                    onClick={handleExportMultiplePDF}
                                    size="sm"
                                    variant="outline"
                                    disabled={isGeneratingReport}
                                    className="text-xs h-6 px-2 border-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isGeneratingReport ? (
                                      <>
                                        <InlineLoading className="mr-1" />
                                        PDF
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="h-3 w-3 mr-1" />
                                        PDF
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Siparişler - Mobile */}
                      <div className="divide-y divide-gray-100">
                        {group.orders.map((order) => (
                          <div 
                            key={order.id} 
                            className={`p-4 space-y-3 cursor-pointer transition-colors ${
                              selectedOrders.has(order.id) 
                                ? 'bg-gray-100 border-l-4 border-gray-900' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => toggleOrderSelection(order.id)}
                          >
                        {/* Checkbox - Mobile */}
                        <div className="flex items-center gap-3 mb-3">
                          <div 
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedOrders.has(order.id)
                                ? 'bg-gray-900 border-gray-900'
                                : 'border-gray-300 hover:border-gray-500'
                            }`}
                          >
                            {selectedOrders.has(order.id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {selectedOrders.has(order.id) ? 'Seçili' : 'Seç'}
                          </div>
                        </div>
                        {/* Tedarikçi & Durum */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">
                              {order.suppliers?.name || 'Tedarikçi belirtilmemiş'}
                            </div>
                            {order.suppliers?.contact_person && (
                              <div className="text-xs text-gray-500 mt-1">{order.suppliers.contact_person}</div>
                            )}
                          </div>
                          <Badge
                            className={
                              order.status === 'delivered' || order.is_delivered
                                ? 'bg-green-100 text-green-700 border-0 text-xs'
                                : order.status === 'partially_delivered' || order.status === 'kısmen teslim alındı'
                                ? 'bg-orange-100 text-orange-700 border-0 text-xs'
                                : order.status === 'iade edildi'
                                ? 'bg-red-100 text-red-700 border-0 text-xs'
                                : 'bg-gray-100 text-gray-700 border-0 text-xs'
                            }
                          >
                            {order.status === 'delivered' || order.is_delivered 
                              ? 'Teslim Edildi' 
                              : order.status === 'partially_delivered' || order.status === 'kısmen teslim alındı'
                              ? 'Kısmi Teslim'
                              : order.status === 'iade edildi'
                              ? 'İade Edildi'
                              : 'Bekliyor'
                            }
                          </Badge>
                        </div>

                        {/* Malzeme */}
                        <div className="border-t border-gray-200 pt-3">
                          <div className="text-xs text-gray-500 mb-1">Malzeme</div>
                          <div className="font-medium text-gray-900 text-sm">
                            {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                          </div>
                          {order.purchase_request_items?.brand && (
                            <div className="text-xs text-gray-500 mt-1">Marka: {order.purchase_request_items.brand}</div>
                          )}
                          {order.is_return_reorder && (
                            <div className="text-xs text-purple-600 font-medium mt-1">İade yeniden siparişi</div>
                          )}
                        </div>

                        {/* Miktar & Tutar */}
                        <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Miktar</div>
                            <div className="font-medium text-gray-900 text-sm">
                              {order.quantity} {order.purchase_request_items?.unit || ''}
                            </div>
                            {order.returned_quantity > 0 && (
                              <div className="text-xs text-orange-600 mt-1">
                                İade: {order.returned_quantity} {order.purchase_request_items?.unit || ''}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Tutar</div>
                            {order.amount > 0 ? (
                              <div className="font-medium text-gray-900 text-sm">
                                {getCurrencySymbol(order.currency)}
                                {order.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Belirtilmemiş</span>
                            )}
                          </div>
                        </div>

                        {/* Talep & Şantiye */}
                        <div className="border-t border-gray-200 pt-3">
                          <div className="text-xs text-gray-500 mb-1">Talep</div>
                          <div className="font-medium text-gray-900 text-sm">
                            {order.purchase_requests?.request_number ? 
                              order.purchase_requests.request_number.slice(-6) : 'Bilinmiyor'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {order.purchase_requests?.title || 'Başlık belirtilmemiş'}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Şantiye</div>
                          <div className="text-sm text-gray-900">
                            {order.purchase_requests?.site_name || order.purchase_requests?.sites?.name || 'Belirtilmemiş'}
                          </div>
                        </div>

                        {/* Teslimat Tarihi */}
                        <div className="border-t border-gray-200 pt-3">
                          <div className="text-xs text-gray-500 mb-1">Teslimat Tarihi</div>
                          <div className="text-sm text-gray-900">
                            {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                          </div>
                        </div>

                        {/* İrsaliye Fotoğrafları */}
                        {order.delivery_image_urls && order.delivery_image_urls.length > 0 && (
                          <div className="border-t border-gray-200 pt-3">
                            <div className="text-xs text-gray-500 mb-2">İrsaliye Fotoğrafları</div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViewDeliveryPhotos(order.delivery_image_urls!, 0)}
                                className="w-16 h-16 rounded border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 overflow-hidden bg-white"
                              >
                                <img
                                  src={order.delivery_image_urls[0]}
                                  alt="İrsaliye"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              {order.delivery_image_urls.length > 1 && (
                                <span className="text-sm text-gray-500">
                                  +{order.delivery_image_urls.length - 1} fotoğraf daha
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* İşlemler */}
                        <div className="border-t border-gray-200 pt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                          {/* Fatura ve PDF Butonları */}
                          <div className="flex gap-2">
                            {/* Fatura Durumu */}
                            <div className="flex-1">
                              {order.invoices && order.invoices.length > 0 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleViewInvoices(order.invoices, 0)
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 hover:bg-green-100 transition-colors cursor-pointer h-9"
                                >
                                  <Receipt className="h-4 w-4" />
                                  <span className="font-medium">Fatura ({order.invoices.length})</span>
                                </button>
                              ) : selectedOrders.size > 0 && selectedOrders.has(order.id) ? (
                                <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm text-gray-700 h-9">
                                  <Receipt className="h-4 w-4" />
                                  <span className="font-medium">Seçili</span>
                                </div>
                              ) : (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenInvoiceModal(order.id)
                                  }}
                                  size="sm"
                                  className="w-full bg-gray-900 hover:bg-gray-800 text-white text-xs h-9"
                                >
                                  Fatura Ekle
                                </Button>
                              )}
                            </div>
                            
                            {/* PDF Export Butonu */}
                            <div className="flex-1">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleExportOrderPDF(order)
                                }}
                                size="sm"
                                variant="outline"
                                disabled={loadingPDFOrders.has(order.id)}
                                className="w-full text-xs border-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed h-9"
                              >
                                {loadingPDFOrders.has(order.id) ? (
                                  <>
                                    <InlineLoading className="mr-1" />
                                    PDF
                                  </>
                                ) : (
                                  <>
                                    <FileText className="h-4 w-4 mr-1" />
                                    PDF
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          {/* Detaylar Butonu */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/requests/${order.purchase_request_id}/offers`)
                              }}
                              className="w-full text-xs"
                            >
                              Detaylar
                            </Button>
                          </div>
                        </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 pt-4">
                    <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                      Sayfa {currentPage} / {totalPages} - Toplam {totalCount} sipariş
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="text-xs h-8 px-3"
                      >
                        Önceki
                      </Button>
                      
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 p-0 text-xs ${
                                currentPage === pageNum 
                                  ? 'bg-gray-900 text-white hover:bg-gray-800' 
                                  : ''
                              }`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <div className="sm:hidden text-xs text-gray-600 min-w-[80px] text-center">
                        Sayfa {currentPage} / {totalPages}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="text-xs h-8 px-3"
                      >
                        Sonraki
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        title="İrsaliye Fotoğrafları"
      />

      {/* Invoice Viewer Modal */}
      <Dialog 
        open={isInvoiceViewerOpen} 
        onOpenChange={(open) => {
          // Düzenleme modundayken modal kapanmasını engelle
          if (!open && editingInvoiceId) {
            return
          }
          setIsInvoiceViewerOpen(open)
          if (!open) {
            // Modal kapanırken edit state'i temizle
            handleCancelEditInvoice()
          }
        }}
      >
        <DialogContent className="max-w-4xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Fatura Görüntüle ({selectedInvoices.length} Fatura)
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedInvoices.map((invoice, invoiceIndex) => (
              <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                {/* Fatura Bilgileri */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      Fatura #{invoiceIndex + 1}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(invoice.created_at).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingInvoiceId === invoice.id ? (
                      // Edit mode - Amount input
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="0"
                          value={formatNumberWithDots(editInvoiceAmount)}
                          onChange={(e) => handleEditInvoiceAmountChange(e.target.value)}
                          className="w-32 text-right"
                        />
                        <Select value={editInvoiceCurrency} onValueChange={setEditInvoiceCurrency}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="TRY">TRY</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      // View mode - Amount display
                      <div className="text-right">
                        <div className="font-bold text-lg text-gray-900">
                          {getCurrencySymbol(invoice.currency)}
                          {invoice.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-gray-500">{invoice.currency}</div>
                      </div>
                    )}
                    
                    {/* Edit/Save/Cancel Buttons */}
                    <div className="flex items-center gap-2">
                      {editingInvoiceId === invoice.id ? (
                        <>
                          <Button
                            onClick={handleUpdateInvoice}
                            size="sm"
                            disabled={isUpdatingInvoice}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isUpdatingInvoice ? 'Kaydediliyor...' : 'Kaydet'}
                          </Button>
                          <Button
                            onClick={handleCancelEditInvoice}
                            size="sm"
                            variant="outline"
                            disabled={isUpdatingInvoice}
                          >
                            İptal
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleStartEditInvoice(invoice)}
                          size="sm"
                          variant="outline"
                        >
                          Düzenle
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fatura Fotoğrafları */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-700">
                      Fatura Fotoğrafları ({editingInvoiceId === invoice.id ? editInvoicePhotos.length : invoice.invoice_photos?.length || 0})
                    </div>
                    {editingInvoiceId === invoice.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById(`edit-invoice-file-input-${invoice.id}`)?.click()}
                        disabled={isUpdatingInvoice}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Fotoğraf Ekle
                      </Button>
                    )}
                  </div>
                  
                  {/* Hidden file input for editing */}
                  {editingInvoiceId === invoice.id && (
                    <input
                      id={`edit-invoice-file-input-${invoice.id}`}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleEditFileUpload}
                    />
                  )}
                  
                  {((editingInvoiceId === invoice.id ? editInvoicePhotos : invoice.invoice_photos) || []).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {(editingInvoiceId === invoice.id ? editInvoicePhotos : invoice.invoice_photos || []).map((photo: string, photoIndex: number) => (
                        <div key={photoIndex} className="relative group">
                          <img
                            src={photo}
                            alt={`Fatura ${invoiceIndex + 1} - Fotoğraf ${photoIndex + 1}`}
                            className="w-full h-24 object-cover rounded border border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
                            onClick={() => {
                              if (editingInvoiceId !== invoice.id) {
                                setSelectedImages(invoice.invoice_photos)
                                setSelectedImageIndex(photoIndex)
                                setIsInvoiceViewerOpen(false)
                                setIsImageViewerOpen(true)
                              }
                            }}
                          />
                          
                          {/* Remove button in edit mode */}
                          {editingInvoiceId === invoice.id && (
                            <button
                              onClick={() => handleRemoveEditPhoto(photoIndex)}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                              disabled={isUpdatingInvoice}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          
                          {/* Hover overlay for view mode */}
                          {editingInvoiceId !== invoice.id && (
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded flex items-center justify-center">
                              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">Büyüt</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notlar */}
                {invoice.notes && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Notlar</div>
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {invoice.notes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={() => {
                if (editingInvoiceId) {
                  handleCancelEditInvoice()
                }
                setIsInvoiceViewerOpen(false)
              }}
              variant="outline"
            >
              {editingInvoiceId ? 'İptal ve Kapat' : 'Kapat'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Modal */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className={`${selectedOrderId ? 'max-w-md' : 'max-w-4xl'} bg-white`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {selectedOrderId ? 'Fatura Ekle' : `Toplu Fatura Ekle (${selectedOrders.size} Sipariş)`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Tek Sipariş için Tutar Input */}
            {selectedOrderId && (
            <div className="space-y-2">
              <Label htmlFor="amount">Fatura Tutarı</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="text"
                  placeholder="0"
                  value={formatNumberWithDots(invoiceAmount)}
                  onChange={(e) => handleInvoiceAmountChange(e.target.value)}
                  className="flex-1"
                />
                 <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency}>
                   <SelectTrigger className="w-24">
                     <SelectValue />
                   </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="TRY">TRY</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            )}

            {/* Çoklu Sipariş için Her Sipariş Tutarı */}
            {!selectedOrderId && selectedOrders.size > 0 && (
              <div className="space-y-4">
                <Label>Sipariş Fatura Tutarları</Label>
                
                <div className="max-h-96 overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-4">
                  {getSelectedOrdersData().map((order, index) => (
                     <div key={order.id} className="grid grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg items-center">
                       {/* Sipariş Bilgileri */}
                       <div className="col-span-5 min-w-0">
                         <div className="font-medium text-sm text-gray-900 mb-1">
                           {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                         </div>
                         <div className="text-xs text-gray-500">
                           <div>Tedarikçi: {order.suppliers?.name || 'Belirtilmemiş'}</div>
                           <div>Miktar: {order.quantity} {order.purchase_request_items?.unit || ''}</div>
                           {order.purchase_request_items?.brand && (
                             <div>Marka: {order.purchase_request_items.brand}</div>
                           )}
                         </div>
                       </div>
                       
                       {/* Tutar Input */}
                       <div className="col-span-4">
                         <Label className="text-xs text-gray-600 mb-1 block">Fatura Tutarı</Label>
                         <Input
                           type="text"
                           placeholder="0"
                           value={formatNumberWithDots(orderAmounts[order.id] || '')}
                           onChange={(e) => handleOrderAmountChange(order.id, e.target.value)}
                           className="text-sm"
                         />
                       </div>
                       
                       {/* Para Birimi */}
                       <div className="col-span-3">
                         <Label className="text-xs text-gray-600 mb-1 block">Para Birimi</Label>
                         <Select 
                           value={orderCurrencies[order.id] || 'TRY'} 
                           onValueChange={(currency) => handleOrderCurrencyChange(order.id, currency)}
                         >
                           <SelectTrigger className="w-full">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="bg-white">
                             <SelectItem value="TRY">TRY</SelectItem>
                             <SelectItem value="USD">USD</SelectItem>
                             <SelectItem value="EUR">EUR</SelectItem>
                             <SelectItem value="GBP">GBP</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fotoğraf Yükleme */}
            <div className="space-y-2">
              <Label>
                Fatura Fotoğrafları
                {!selectedOrderId && selectedOrders.size > 0 && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Tüm siparişler için ortak kullanılacak)
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => document.getElementById('invoice-file-input')?.click()}
                  disabled={isUploadingInvoice}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Dosya Seç
                </Button>
              </div>
              
              <input
                id="invoice-file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Yüklenen Fotoğrafları Göster */}
            {invoicePhotos.length > 0 && (
              <div className="space-y-2">
                <Label>Yüklenen Fotoğraflar ({invoicePhotos.length})</Label>
                <div className="grid grid-cols-3 gap-2">
                  {invoicePhotos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`Fatura ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseInvoiceModal}
                className="flex-1"
              >
                İptal
              </Button>
              <Button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={
                  isUploadingInvoice || 
                  invoicePhotos.length === 0 ||
                  (selectedOrderId && !invoiceAmount) ||
                  (!selectedOrderId && selectedOrders.size > 0 && 
                    (Array.from(selectedOrders).some(orderId => !orderAmounts[orderId] || orderAmounts[orderId].trim() === '') ||
                     Array.from(selectedOrders).some(orderId => !orderCurrencies[orderId]))
                  )
                }
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
              >
                {isUploadingInvoice ? 'Kaydediliyor...' : 'Fatura Ekle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fixed Multi-Action Buttons */}
      {selectedOrders.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-black rounded-2xl shadow-2xl border border-gray-800 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <Package className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedOrders.size} sipariş seçildi
                  </p>
                  <p className="text-xs text-gray-300">
                    Toplu işlemler yapabilirsiniz
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
                >
                  İptal
                </Button>
                <Button
                  onClick={handleOpenMultiInvoiceModal}
                  className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-xl font-medium shadow-lg"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Toplu Fatura
                </Button>
                <Button
                  onClick={handleExportMultiplePDF}
                  disabled={isGeneratingReport}
                  className="bg-white hover:bg-gray-100 text-black px-4 py-2 rounded-xl font-medium shadow-lg"
                >
                  {isGeneratingReport ? (
                    <>
                      <InlineLoading className="mr-2" />
                      Rapor Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Rapor
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
