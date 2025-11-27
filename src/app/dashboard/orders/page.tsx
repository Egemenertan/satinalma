'use client'

/**
 * Orders Page - Refactored Version
 * Modern, maintainable ve senior-level kod yapısı
 * 
 * Özellikler:
 * - React Query ile data management
 * - Custom hooks ile logic separation
 * - Component-based architecture
 * - Full type safety
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Receipt, Eye, Edit, Trash2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/components/offers/types'

// Components
import { OrderFilters } from './components/OrderFilters'
import { OrderStatsCards } from './components/OrderStats'
import { OrdersTable } from './components/OrdersTable'
import { InvoiceGroupView } from './components/OrdersTable/InvoiceGroupView'
import { MultiSelectActions } from './components/MultiSelect'
import { InvoiceModal } from './components/InvoiceModal'
import { InvoiceSelectionModal } from './components/PDF/InvoiceSelectionModal'

// Hooks
import { useOrders, useOrderFilters, useMultiSelect, usePDFExport } from './hooks'

// Utils
import { formatNumberWithDots, parseNumberFromDots, parseToNumber } from './utils'

// Modern, refactored architecture
// Invoice Modal artık ayrı bir component olarak organize edildi

export default function OrdersPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  // Filters Hook
  const {
    filters,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    clearDateFilters,
    currentPage,
    setCurrentPage,
  } = useOrderFilters()

  // Orders Data Hook
  const { data: ordersData, error, isLoading } = useOrders(filters)

  // Multi-Select Hook
  const {
    selectedOrders,
    toggleOrderSelection,
    selectAllOrdersInGroup,
    clearSelection,
    getSelectedOrdersData,
  } = useMultiSelect()

  // PDF Export Hook
  const {
    loadingPDFOrders,
    isGeneratingReport,
    exportSingleOrder,
    exportMultipleOrders,
    isPDFInvoiceSelectionOpen,
    setIsPDFInvoiceSelectionOpen,
    pdfOrderContext,
    selectedPDFInvoices,
    setSelectedPDFInvoices,
  } = usePDFExport()

  // View Mode State - Fatura bazlı görünüm
  const [viewMode, setViewMode] = useState<'default' | 'invoice'>('default')

  // Image Viewer State
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceCurrency, setInvoiceCurrency] = useState('TRY')
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([])
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false)
  
  // Toplu fatura özet bilgileri
  const [invoiceSubtotals, setInvoiceSubtotals] = useState<Record<string, string>>({})
  const [invoiceDiscount, setInvoiceDiscount] = useState('')
  const [invoiceDiscountCurrency, setInvoiceDiscountCurrency] = useState('TRY')
  const [invoiceTax, setInvoiceTax] = useState('')
  const [invoiceTaxCurrency, setInvoiceTaxCurrency] = useState('TRY')
  const [invoiceGrandTotal, setInvoiceGrandTotal] = useState('')
  const [invoiceGrandTotalCurrency, setInvoiceGrandTotalCurrency] = useState('TRY')
  const [invoiceNotes, setInvoiceNotes] = useState('')

  // Multi-select invoice state
  const [orderAmounts, setOrderAmounts] = useState<Record<string, string>>({})
  const [orderCurrencies, setOrderCurrencies] = useState<Record<string, string>>({})

  // Invoice Viewer State
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([])
  const [invoiceGroupInfo, setInvoiceGroupInfo] = useState<any>(null)

  // Invoice Edit State
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [editInvoiceAmount, setEditInvoiceAmount] = useState('')
  const [editInvoiceCurrency, setEditInvoiceCurrency] = useState('TRY')
  const [editInvoicePhotos, setEditInvoicePhotos] = useState<string[]>([])
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false)

  // Invoice Group Edit State
  const [editingInvoiceGroupId, setEditingInvoiceGroupId] = useState<string | null>(null)
  
  // Individual Invoice Details - Birden fazla fatura varsa her birinin detayı
  const [individualInvoiceDetails, setIndividualInvoiceDetails] = useState<Array<{
    id: string
    amount: number
    currency: string
    subtotal: number | null
    discount: number | null
    tax: number | null
    grand_total: number | null
    created_at: string
  }>>([])
  
  // Her faturanın düzenlenmiş değerlerini tut
  const [editedInvoiceValues, setEditedInvoiceValues] = useState<Record<string, {
    subtotal: string
    discount: string
    tax: string
  }>>({})

  const orders = ordersData?.orders || []
  const totalCount = ordersData?.totalCount || 0
  const totalPages = ordersData?.totalPages || 1

  // Eğer mevcut sayfa totalPages'den büyükse ve veri yüklendiyse, 1. sayfaya git
  useEffect(() => {
    if (!isLoading && orders.length === 0 && totalPages > 0 && currentPage > totalPages) {
      console.log(`⚠️ Sayfa ${currentPage} mevcut değil (toplam ${totalPages} sayfa). 1. sayfaya yönlendiriliyor.`)
      setCurrentPage(1)
    }
  }, [isLoading, orders.length, totalPages, currentPage, setCurrentPage])

  // Fatura bazlı gruplama - aynı invoice_photos'a sahip siparişleri birleştir
  const groupOrdersByInvoice = (orders: any[]) => {
    const invoiceGroups: Record<string, any[]> = {}
    const noInvoiceOrders: any[] = []

    orders.forEach(order => {
      if (order.invoices && order.invoices.length > 0) {
        const invoice = order.invoices[0]
        
        // Önce invoice_group_id'ye göre grupla
        if (invoice.invoice_group_id) {
          const groupId = invoice.invoice_group_id
          if (!invoiceGroups[groupId]) {
            invoiceGroups[groupId] = []
          }
          invoiceGroups[groupId].push(order)
        } else {
          // invoice_group_id yoksa, invoice_photos'a göre grupla
          // Aynı fatura fotoğraflarına sahip siparişleri birleştir
          const photoKey = JSON.stringify(invoice.invoice_photos?.sort() || [])
          const groupId = `photo_${photoKey}_${invoice.id}`
          
          // Aynı fotoğraflara sahip başka bir grup var mı kontrol et
          let foundGroup = false
          for (const [existingGroupId, existingOrders] of Object.entries(invoiceGroups)) {
            if (existingGroupId.startsWith('photo_')) {
              const existingInvoice = existingOrders[0]?.invoices[0]
              const existingPhotoKey = JSON.stringify(existingInvoice?.invoice_photos?.sort() || [])
              
              if (photoKey === existingPhotoKey && photoKey !== '[]') {
                // Aynı fotoğraflar, bu gruba ekle
                invoiceGroups[existingGroupId].push(order)
                foundGroup = true
                break
              }
            }
          }
          
          if (!foundGroup) {
            if (!invoiceGroups[groupId]) {
              invoiceGroups[groupId] = []
            }
            invoiceGroups[groupId].push(order)
          }
        }
      } else {
        noInvoiceOrders.push(order)
      }
    })

    return { invoiceGroups, noInvoiceOrders }
  }

  const { invoiceGroups, noInvoiceOrders } = groupOrdersByInvoice(orders)

  // Handlers
  const handleViewDeliveryPhotos = (photos: string[], index = 0) => {
    setSelectedImages(photos)
    setSelectedImageIndex(index)
    setIsImageViewerOpen(true)
  }

  const handleViewInvoices = (invoices: any[], index = 0) => {
    // Yeni davranış: Toplu fatura için düzenleme modalını aç
    handleOpenInvoiceEditModal(invoices)
  }

  const handleOpenMultiInvoiceModal = () => {
    if (selectedOrders.size === 0) {
      showToast('Lütfen en az bir sipariş seçin', 'error')
      return
    }

    console.log('➕ Fatura ekleme modalı açılıyor:', {
      selectedCount: selectedOrders.size,
      selectedOrderIds: Array.from(selectedOrders)
    })

    // Eğer sadece 1 sipariş seçiliyse, tek sipariş modu
    if (selectedOrders.size === 1) {
      const orderId = Array.from(selectedOrders)[0]
      const order = orders.find(o => o.id === orderId)
      
      if (order) {
        console.log('➕ Tek sipariş için fatura ekleme modalı açılıyor:', {
          orderId: order.id,
          supplierName: order.suppliers?.name,
          itemName: order.purchase_request_items?.item_name
        })
        
        // Tek sipariş modu - selectedOrderId'yi set et
        setSelectedOrderId(order.id)
        setEditingInvoiceGroupId(null)
        setInvoiceAmount('')
        setInvoiceCurrency(order.currency || 'TRY')
        setInvoicePhotos([])
        setInvoiceNotes('')
        setOrderAmounts({})
        setOrderCurrencies({})
        // Tek sipariş için de ara toplam başlat (fatura tutarı girilince otomatik güncellenecek)
        setInvoiceSubtotals({ [order.currency || 'TRY']: '0,00' })
        setInvoiceDiscount('')
        setInvoiceTax('')
        setInvoiceGrandTotal('0,00')
        setInvoiceGrandTotalCurrency(order.currency || 'TRY')
        setIsInvoiceModalOpen(true)
        return
      }
    }

    // Toplu sipariş modu
    console.log('➕ Toplu fatura ekleme modalı açılıyor:', {
      selectedCount: selectedOrders.size
    })
    
    // State'leri temizle
    setSelectedOrderId(null)
    setEditingInvoiceGroupId(null)
    setOrderAmounts({})
    setOrderCurrencies({})
    setInvoicePhotos([])
    setInvoiceSubtotals({})
    setInvoiceDiscount('')
    setInvoiceTax('')
    setInvoiceGrandTotal('')
    setInvoiceNotes('')
    setIsInvoiceModalOpen(true)
  }

  const handleExportMultiplePDF = async () => {
    if (selectedOrders.size === 0) {
      showToast('Lütfen en az bir sipariş seçin', 'error')
      return
    }

    try {
      await exportMultipleOrders(orders, Array.from(selectedOrders))
      showToast(`${selectedOrders.size} sipariş için PDF başarıyla oluşturuldu`, 'success')
    } catch (error) {
      showToast('Toplu PDF oluşturulurken hata oluştu', 'error')
    }
  }

  const handleExportOrderPDF = async (order: any) => {
    try {
      await exportSingleOrder(order)
      showToast('PDF başarıyla oluşturuldu', 'success')
    } catch (error: any) {
      showToast('PDF oluşturma hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    }
  }
  
  const handleConfirmPDFInvoiceSelection = async () => {
    if (!pdfOrderContext) return
    
    try {
      setIsPDFInvoiceSelectionOpen(false)
      const selectedIds = Array.from(selectedPDFInvoices)
      await exportSingleOrder(pdfOrderContext, selectedIds)
      showToast('PDF başarıyla oluşturuldu', 'success')
    } catch (error: any) {
      showToast('PDF oluşturma hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    }
  }
  
  const handleTogglePDFInvoice = (invoiceId: string) => {
    setSelectedPDFInvoices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId)
      } else {
        newSet.add(invoiceId)
      }
      return newSet
    })
  }

  const handleExportGroupPDF = async (groupOrders: any[]) => {
    try {
      const orderIds = groupOrders.map(o => o.id)
      await exportMultipleOrders(orders, orderIds)
      showToast(`${groupOrders.length} sipariş için toplu rapor başarıyla oluşturuldu`, 'success')
    } catch (error: any) {
      showToast('Toplu rapor oluşturma hatası: ' + (error?.message || 'Bilinmeyen hata'), 'error')
    }
  }

  // Invoice handlers
  const handleInvoiceAmountChange = (formatted: string) => {
    setInvoiceAmount(formatted)
    
    // Tek sipariş için ara toplamı da güncelle
    if (selectedOrderId) {
      setInvoiceSubtotals({ [invoiceCurrency]: formatted })
    }
  }

  const handleOrderAmountChange = (orderId: string, formatted: string) => {
    setOrderAmounts(prev => ({ ...prev, [orderId]: formatted }))
  }
  
  const handleIndividualInvoiceChange = (invoiceId: string, field: 'subtotal' | 'discount' | 'tax', value: string) => {
    setEditedInvoiceValues(prev => {
      const currentValues = prev[invoiceId] || { subtotal: '', discount: '', tax: '' }
      return {
        ...prev,
        [invoiceId]: {
          ...currentValues,
          [field]: value
        }
      }
    })
  }

  const handleOrderCurrencyChange = (orderId: string, currency: string) => {
    setOrderCurrencies(prev => ({ ...prev, [orderId]: currency }))
  }

  // Fotoğraf yükleme
  const handleInvoicePhotoUpload = async (files: FileList) => {
    const supabase = createClient()
    setIsUploadingInvoice(true)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `invoice-photos/${fileName}`

        const { error: uploadError, data } = await supabase.storage
          .from('satinalma')
          .upload(filePath, file)

        if (uploadError) {
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage
          .from('satinalma')
          .getPublicUrl(filePath)

        return publicUrl
      })

      const urls = await Promise.all(uploadPromises)
      setInvoicePhotos(prev => [...prev, ...urls])
      showToast('Fotoğraflar başarıyla yüklendi', 'success')
    } catch (error) {
      console.error('Fotoğraf yükleme hatası:', error)
      showToast('Fotoğraflar yüklenirken hata oluştu', 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  const handleRemoveInvoicePhoto = (index: number) => {
    setInvoicePhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Toplu fatura için ara toplamları hesapla - TEK PARA BİRİMİ
  useEffect(() => {
    if (!selectedOrderId && (selectedOrders.size > 0 || editingInvoiceGroupId)) {
      // İlk para birimini baz al (veya en çok kullanılan para birimini)
      const currencyCount: Record<string, number> = {}
      Object.values(orderCurrencies).forEach(currency => {
        currencyCount[currency] = (currencyCount[currency] || 0) + 1
      })
      
      // En çok kullanılan para birimini bul
      const baseCurrency = Object.keys(currencyCount).sort((a, b) => 
        currencyCount[b] - currencyCount[a]
      )[0] || 'TRY'
      
      // Tüm tutarları topla (para birimi farkı gözetmeksizin - kullanıcı aynı para birimini kullanmalı)
      let totalAmount = 0
      Object.keys(orderAmounts).forEach(orderId => {
        const amount = orderAmounts[orderId]
        if (amount) {
          const numAmount = parseToNumber(amount)
          if (!isNaN(numAmount)) {
            totalAmount += numAmount
          }
        }
      })
      
      // Tek para birimi ile subtotal
      const formattedSubtotals: Record<string, string> = {}
      formattedSubtotals[baseCurrency] = totalAmount.toFixed(2).replace('.', ',')
      
      setInvoiceSubtotals(formattedSubtotals)
      
      // Para birimlerini de güncelle (hepsi aynı olmalı)
      if (!editingInvoiceGroupId) {
        setInvoiceDiscountCurrency(baseCurrency)
        setInvoiceTaxCurrency(baseCurrency)
        setInvoiceGrandTotalCurrency(baseCurrency)
      }
    }
  }, [orderAmounts, orderCurrencies, selectedOrderId, selectedOrders, editingInvoiceGroupId])

  // Genel Toplam otomatik hesaplama: Ara Toplam - İndirim + KDV
  useEffect(() => {
    if (Object.keys(invoiceSubtotals).length > 0) {
      // İlk para birimini al (genelde hepsi aynı olmalı)
      const firstCurrency = Object.keys(invoiceSubtotals)[0]
      const subtotal = parseToNumber(invoiceSubtotals[firstCurrency] || '0')
      const discount = invoiceDiscount ? parseToNumber(invoiceDiscount) : 0
      const tax = invoiceTax ? parseToNumber(invoiceTax) : 0
      
      // Genel Toplam = Ara Toplam - İndirim + KDV
      const grandTotal = subtotal - discount + tax
      
      // Format ve set et
      const formattedGrandTotal = grandTotal.toFixed(2).replace('.', ',')
      setInvoiceGrandTotal(formattedGrandTotal)
      
      // Para birimini de set et (ara toplam ile aynı olmalı)
      setInvoiceGrandTotalCurrency(firstCurrency)
    }
  }, [invoiceSubtotals, invoiceDiscount, invoiceTax])

  // Invoice viewer açıldığında invoice group bilgisini çek
  useEffect(() => {
    const fetchInvoiceGroupInfo = async () => {
      if (isInvoiceViewerOpen && selectedInvoices.length > 0) {
        const firstInvoice = selectedInvoices[0]
        if (firstInvoice.invoice_group_id) {
          const supabase = createClient()
          const { data, error } = await supabase
            .from('invoice_groups_with_orders')
            .select('*')
            .eq('id', firstInvoice.invoice_group_id)
            .single()

          if (!error && data) {
            setInvoiceGroupInfo(data)
          }
        } else {
          setInvoiceGroupInfo(null)
        }
      }
    }

    fetchInvoiceGroupInfo()
  }, [isInvoiceViewerOpen, selectedInvoices])

  // Yeşil fatura butonuna basıldığında - HER ZAMAN toplu fatura düzenleme modalını aç
  const handleOpenInvoiceEditModal = async (invoices: any[]) => {
    if (invoices.length === 0) return

    const supabase = createClient()
    const firstInvoice = invoices[0]
    
    // Önce bu siparişin TÜM faturalarını çek (grup olsun olmasın)
    // Order bilgilerini bul
    const order = orders.find(o => {
      return o.invoices?.some(inv => inv.id === firstInvoice.id)
    })

    if (!order) {
      showToast('Sipariş bilgisi bulunamadı', 'error')
      return
    }

    // Bu siparişin TÜM faturalarını Supabase'den çek (tüm detaylarıyla)
    const { data: allOrderInvoices, error: allInvoicesError } = await supabase
      .from('invoices')
      .select('id, order_id, amount, currency, invoice_photos, notes, invoice_group_id, subtotal, discount, tax, grand_total, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })

    if (allInvoicesError || !allOrderInvoices) {
      showToast('Fatura bilgileri alınamadı', 'error')
      return
    }

    console.log(`📋 Sipariş ${order.id} için ${allOrderInvoices.length} fatura bulundu`)
    
    // Individual invoice details'i kaydet (birden fazla fatura varsa göstermek için)
    if (allOrderInvoices.length > 1) {
      const invoiceDetails = allOrderInvoices.map(inv => ({
        id: inv.id,
        amount: parseFloat(inv.amount) || 0,
        currency: inv.currency || 'TRY',
        subtotal: inv.subtotal ? parseFloat(inv.subtotal) : null,
        discount: inv.discount ? parseFloat(inv.discount) : null,
        tax: inv.tax ? parseFloat(inv.tax) : null,
        grand_total: inv.grand_total ? parseFloat(inv.grand_total) : null,
        created_at: inv.created_at
      }))
      
      setIndividualInvoiceDetails(invoiceDetails)
      
      // Her fatura için başlangıç değerlerini set et
      const initialValues: Record<string, { subtotal: string; discount: string; tax: string }> = {}
      invoiceDetails.forEach(inv => {
        initialValues[inv.id] = {
          subtotal: inv.subtotal !== null 
            ? inv.subtotal.toFixed(2).replace('.', ',')
            : inv.amount.toFixed(2).replace('.', ','),
          discount: inv.discount !== null && inv.discount > 0
            ? inv.discount.toFixed(2).replace('.', ',')
            : '',
          tax: inv.tax !== null && inv.tax > 0
            ? inv.tax.toFixed(2).replace('.', ',')
            : ''
        }
      })
      setEditedInvoiceValues(initialValues)
    } else {
      setIndividualInvoiceDetails([])
      setEditedInvoiceValues({})
    }
    
    // Eğer invoice_group_id varsa, grup bilgilerini de çek
    if (firstInvoice.invoice_group_id) {
      // Invoice group bilgilerini çek
      const { data: groupData, error: groupError } = await supabase
        .from('invoice_groups_with_orders')
        .select('*')
        .eq('id', firstInvoice.invoice_group_id)
        .single()

      if (groupError || !groupData) {
        showToast('Fatura grubu bilgileri alınamadı', 'error')
        return
      }

      // Düzenleme modunu aktif et
      setEditingInvoiceGroupId(firstInvoice.invoice_group_id)

      // Tüm faturaların toplam tutarını hesapla
      const totalAmount = allOrderInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
      
      // Sipariş için tutarları doldur
      const amounts: Record<string, string> = {}
      const currencies: Record<string, string> = {}
      
      amounts[order.id] = totalAmount.toFixed(2).replace('.', ',')
      currencies[order.id] = firstInvoice.currency || 'TRY'
      
      setOrderAmounts(amounts)
      setOrderCurrencies(currencies)

      // Özet bilgileri doldur
      const subtotals: Record<string, string> = {}
      subtotals[groupData.currency] = groupData.subtotal?.toFixed(2).replace('.', ',') || '0,00'
      setInvoiceSubtotals(subtotals)
      
      setInvoiceDiscount(groupData.discount?.toFixed(2).replace('.', ',') || '')
      setInvoiceDiscountCurrency(groupData.currency)
      
      setInvoiceTax(groupData.tax?.toFixed(2).replace('.', ',') || '')
      setInvoiceTaxCurrency(groupData.currency)
      
      setInvoiceGrandTotal(groupData.grand_total?.toFixed(2).replace('.', ',') || '')
      setInvoiceGrandTotalCurrency(groupData.currency)
      
      // TÜM faturaların notlarını birleştir
      const allNotes = allOrderInvoices
        .map(inv => inv.notes)
        .filter(Boolean)
        .join('\n---\n')
      setInvoiceNotes(allNotes || groupData.notes || '')
      
      // TÜM faturaların fotoğraflarını birleştir (unique yap - tekrar eden fotoğrafları kaldır)
      const invoicePhotos = allOrderInvoices
        .flatMap(inv => inv.invoice_photos || [])
        .filter(Boolean)
      const groupPhotos = groupData.invoice_photos || []
      const allPhotos = [...invoicePhotos, ...groupPhotos]
      // Unique yap - aynı URL'leri kaldır
      const uniquePhotos = Array.from(new Set(allPhotos))
      setInvoicePhotos(uniquePhotos)

      // Siparişi seç
      toggleOrderSelection(order.id)
    } else {
      // Invoice group yok - TÜM faturaları göster (zaten yukarıda çektik)
      // Tüm faturaların toplam tutarını hesapla
      const totalAmount = allOrderInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
      
      // Sipariş için tutarları ayarla (toplam tutar)
      const amounts: Record<string, string> = {}
      const currencies: Record<string, string> = {}
      
      amounts[order.id] = totalAmount.toFixed(2).replace('.', ',')
      currencies[order.id] = firstInvoice.currency || 'TRY'
      
      setOrderAmounts(amounts)
      setOrderCurrencies(currencies)

      // Özet bilgileri doldur (toplam tutar)
      const subtotals: Record<string, string> = {}
      subtotals[firstInvoice.currency] = totalAmount.toFixed(2).replace('.', ',')
      setInvoiceSubtotals(subtotals)
      
      // Diğer alanları temizle
      setInvoiceDiscount('')
      setInvoiceTax('')
      
      // TÜM faturaların notlarını birleştir
      const allNotes = allOrderInvoices
        .map(inv => inv.notes)
        .filter(Boolean)
        .join('\n---\n')
      setInvoiceNotes(allNotes || '')
      
      // TÜM faturaların fotoğraflarını birleştir (unique yap - tekrar eden fotoğrafları kaldır)
      const allPhotos = allOrderInvoices
        .flatMap(inv => inv.invoice_photos || [])
        .filter(Boolean)
      // Unique yap - aynı URL'leri kaldır
      const uniquePhotos = Array.from(new Set(allPhotos))
      setInvoicePhotos(uniquePhotos)

      // Siparişi seç
      toggleOrderSelection(order.id)

      // Düzenleme modu - mevcut invoice'ları düzenliyoruz
      setEditingInvoiceGroupId(null) // Grup yok, ama düzenleme yapılacak
    }

    // Modal'ı aç
    setIsInvoiceModalOpen(true)
  }

  // Invoice edit handlers
  const handleStartEditInvoice = (invoice: any) => {
    setEditingInvoiceId(invoice.id)
    setEditInvoiceAmount(invoice.amount.toFixed(2).replace('.', ','))
    setEditInvoiceCurrency(invoice.currency)
    setEditInvoicePhotos(invoice.invoice_photos || [])
  }

  const handleCancelEditInvoice = () => {
    setEditingInvoiceId(null)
    setEditInvoiceAmount('')
    setEditInvoiceCurrency('TRY')
    setEditInvoicePhotos([])
  }

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const supabase = createClient()
    setIsUpdatingInvoice(true)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `invoice-photos/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('satinalma')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('satinalma')
          .getPublicUrl(filePath)

        return publicUrl
      })

      const urls = await Promise.all(uploadPromises)
      setEditInvoicePhotos(prev => [...prev, ...urls])
      showToast('Fotoğraflar başarıyla yüklendi', 'success')
    } catch (error) {
      console.error('Fotoğraf yükleme hatası:', error)
      showToast('Fotoğraflar yüklenirken hata oluştu', 'error')
    } finally {
      setIsUpdatingInvoice(false)
    }
  }

  const handleRemoveEditPhoto = (index: number) => {
    setEditInvoicePhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateInvoice = async () => {
    if (!editingInvoiceId) return

    const supabase = createClient()
    setIsUpdatingInvoice(true)

    try {
      const numAmount = parseToNumber(editInvoiceAmount)

      const { error } = await supabase
        .from('invoices')
        .update({
          amount: numAmount,
          currency: editInvoiceCurrency,
          invoice_photos: editInvoicePhotos,
        })
        .eq('id', editingInvoiceId)

      if (error) throw error

      showToast('Fatura başarıyla güncellendi', 'success')
      handleCancelEditInvoice()
      setIsInvoiceViewerOpen(false)
      // React Query cache'i yenile
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (error) {
      console.error('Fatura güncelleme hatası:', error)
      showToast('Fatura güncellenirken hata oluştu', 'error')
    } finally {
      setIsUpdatingInvoice(false)
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Bu faturayı silmek istediğinizden emin misiniz?')) return

    const supabase = createClient()

    try {
      // 1. Önce invoice'ın grup bilgisini al
      const { data: invoiceData, error: fetchError } = await supabase
        .from('invoices')
        .select('invoice_group_id')
        .eq('id', invoiceId)
        .single()

      if (fetchError) throw fetchError

      const invoiceGroupId = invoiceData?.invoice_group_id

      // 2. Invoice'ı sil
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId)

      if (deleteError) throw deleteError

      // 3. Eğer invoice_group_id varsa, grupta başka invoice kaldı mı kontrol et
      if (invoiceGroupId) {
        const { data: remainingInvoices, error: checkError } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_group_id', invoiceGroupId)
          .limit(1)

        if (checkError) {
          console.warn('Grup kontrolü yapılamadı:', checkError)
        } else if (!remainingInvoices || remainingInvoices.length === 0) {
          // Grup boş kaldı, grubu da sil
          const { error: groupDeleteError } = await supabase
            .from('invoice_groups')
            .delete()
            .eq('id', invoiceGroupId)

          if (groupDeleteError) {
            console.warn('Boş invoice group silinemedi:', groupDeleteError)
          } else {
            console.log('✅ Boş invoice group başarıyla silindi:', invoiceGroupId)
          }
        }
      }

      showToast('Fatura başarıyla silindi', 'success')
      setIsInvoiceViewerOpen(false)
      // React Query cache'i yenile
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (error) {
      console.error('Fatura silme hatası:', error)
      showToast('Fatura silinirken hata oluştu', 'error')
    }
  }

  // Fatura kaydetme - YENİ YAPI: invoice_groups kullanarak
  const handleSaveInvoice = async () => {
    const supabase = createClient()
    setIsUploadingInvoice(true)

    try {
      // Kullanıcı bilgilerini kontrol et
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('❌ Authentication hatası:', authError)
        showToast('Oturum hatası. Lütfen tekrar giriş yapın.', 'error')
        return
      }

      // Kullanıcı profilini ve rolünü kontrol et
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('❌ Profil hatası:', profileError)
        showToast('Kullanıcı profili bulunamadı', 'error')
        return
      }

      console.log('👤 Kullanıcı bilgileri:', {
        id: user.id,
        email: user.email,
        role: profile.role,
        full_name: profile.full_name
      })
      // DÜZENLEME MODU - Toplu fatura güncelleme (invoice_group_id varsa)
      if (editingInvoiceGroupId) {
        const firstCurrency = Object.keys(invoiceSubtotals)[0] || 'TRY'
        const subtotal = parseToNumber(invoiceSubtotals[firstCurrency] || '0')
        const discount = invoiceDiscount ? parseToNumber(invoiceDiscount) : null
        const tax = invoiceTax ? parseToNumber(invoiceTax) : null
        const grandTotal = invoiceGrandTotal ? parseToNumber(invoiceGrandTotal) : subtotal

        // 1. Invoice group'u güncelle
        const { error: groupError } = await supabase
          .from('invoice_groups')
          .update({
            subtotal: subtotal,
            discount: discount,
            tax: tax,
            grand_total: grandTotal,
            currency: invoiceGrandTotalCurrency || firstCurrency,
            notes: invoiceNotes || null,
            invoice_photos: invoicePhotos,
          })
          .eq('id', editingInvoiceGroupId)

        if (groupError) {
          console.error('❌ Invoice group güncelleme hatası:', groupError)
          throw groupError
        }

        // 2. Her bir invoice'ı güncelle
        const updatePromises = Object.keys(orderAmounts).map(async (orderId) => {
          const amount = parseToNumber(orderAmounts[orderId] || '0')
          const currency = orderCurrencies[orderId] || 'TRY'

          // Bu order_id'ye ait invoice'ı bul ve güncelle
          return supabase
            .from('invoices')
            .update({
              amount: amount,
              currency: currency,
              invoice_photos: invoicePhotos,
            })
            .eq('order_id', orderId)
            .eq('invoice_group_id', editingInvoiceGroupId)
        })

        await Promise.all(updatePromises)

        showToast('Toplu fatura başarıyla güncellendi', 'success')
        setIsInvoiceModalOpen(false)
        setEditingInvoiceGroupId(null)
        setOrderAmounts({})
        setOrderCurrencies({})
        setInvoicePhotos([])
        setInvoiceSubtotals({})
        setInvoiceDiscount('')
        setInvoiceTax('')
        setInvoiceGrandTotal('')
        setInvoiceNotes('')
        clearSelection()
        
        // React Query cache'i yenile
        await queryClient.invalidateQueries({ queryKey: ['orders'] })
        return
      }

      // DÜZENLEME MODU - Tek fatura güncelleme (invoice_group_id yok ama selectedOrders dolu)
      if (!selectedOrderId && selectedOrders.size === 1 && Object.keys(orderAmounts).length === 1) {
        const orderId = Array.from(selectedOrders)[0]
        const amount = parseToNumber(orderAmounts[orderId] || '0')
        const currency = orderCurrencies[orderId] || 'TRY'

        // Mevcut invoice'ı güncelle
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            amount: amount,
            currency: currency,
            invoice_photos: invoicePhotos,
            notes: invoiceNotes || null,
          })
          .eq('order_id', orderId)

        if (updateError) throw updateError

        showToast('Fatura başarıyla güncellendi', 'success')
        setIsInvoiceModalOpen(false)
        setOrderAmounts({})
        setOrderCurrencies({})
        setInvoicePhotos([])
        setInvoiceSubtotals({})
        setInvoiceDiscount('')
        setInvoiceTax('')
        setInvoiceGrandTotal('')
        setInvoiceNotes('')
        clearSelection()
        
        // React Query cache'i yenile
        await queryClient.invalidateQueries({ queryKey: ['orders'] })
        return
      }

      // Tek sipariş için fatura
      if (selectedOrderId) {
        if (!invoiceAmount || invoicePhotos.length === 0) {
          showToast('Lütfen tutar ve fotoğraf ekleyin', 'error')
          return
        }

        const numAmount = parseToNumber(invoiceAmount)
        
        // Ara toplam, indirim, KDV ve genel toplam hesapla
        const firstCurrency = Object.keys(invoiceSubtotals)[0] || invoiceCurrency
        const subtotal = invoiceSubtotals[firstCurrency] ? parseToNumber(invoiceSubtotals[firstCurrency]) : numAmount
        const discount = invoiceDiscount ? parseToNumber(invoiceDiscount) : null
        const tax = invoiceTax ? parseToNumber(invoiceTax) : null
        const grandTotal = invoiceGrandTotal ? parseToNumber(invoiceGrandTotal) : subtotal
        
        console.log('💾 Tek fatura kaydediliyor:', {
          order_id: selectedOrderId,
          amount: numAmount,
          currency: invoiceCurrency,
          invoice_photos_count: invoicePhotos.length,
          notes: invoiceNotes,
          hasInvoiceGroup: !!(discount || tax || (grandTotal !== subtotal)),
          subtotal,
          discount,
          tax,
          grandTotal
        })

        // Eğer indirim veya KDV girilmişse, invoice_group oluştur
        if (discount || tax || (grandTotal !== subtotal)) {
          // 1. Invoice group oluştur
          const invoiceGroupData = {
            created_by: user?.id || null,
            group_name: `Fatura - ${new Date().toLocaleDateString('tr-TR')}`,
            notes: invoiceNotes || null,
            subtotal: subtotal,
            discount: discount,
            tax: tax,
            grand_total: grandTotal,
            currency: invoiceGrandTotalCurrency || firstCurrency,
            invoice_photos: invoicePhotos,
          }

          const { data: invoiceGroup, error: groupError } = await supabase
            .from('invoice_groups')
            .insert(invoiceGroupData)
            .select()
            .single()

          if (groupError) {
            console.error('❌ Invoice group kaydetme hatası:', groupError)
            throw groupError
          }

          console.log('✅ Invoice group kaydedildi:', invoiceGroup.id)

          // 2. Invoice kaydı oluştur (group ile)
          const { data: insertedInvoice, error } = await supabase
            .from('invoices')
            .insert({
              order_id: selectedOrderId,
              amount: numAmount,
              currency: invoiceCurrency,
              invoice_photos: invoicePhotos,
              notes: invoiceNotes || null,
              invoice_group_id: invoiceGroup.id,
            })
            .select()

          if (error) {
            console.error('❌ Fatura kaydetme hatası:', error)
            // Invoice group'u geri al
            await supabase.from('invoice_groups').delete().eq('id', invoiceGroup.id)
            throw error
          }

          console.log('✅ Fatura başarıyla kaydedildi (invoice group ile):', insertedInvoice)
        } else {
          // Basit fatura (invoice group olmadan)
          const { data: insertedInvoice, error } = await supabase
            .from('invoices')
            .insert({
              order_id: selectedOrderId,
              amount: numAmount,
              currency: invoiceCurrency,
              invoice_photos: invoicePhotos,
              notes: invoiceNotes || null,
              invoice_group_id: null,
            })
            .select()

          if (error) {
            console.error('❌ Fatura kaydetme hatası:', error)
            throw error
          }

          console.log('✅ Fatura başarıyla kaydedildi:', insertedInvoice)
        }

        showToast('Fatura başarıyla kaydedildi', 'success')
        setIsInvoiceModalOpen(false)
        setInvoiceAmount('')
        setInvoiceCurrency('TRY')
        setInvoicePhotos([])
        setInvoiceNotes('')
        setInvoiceSubtotals({})
        setInvoiceDiscount('')
        setInvoiceTax('')
        setInvoiceGrandTotal('')
        
        // React Query cache'i yenile
        await queryClient.invalidateQueries({ queryKey: ['orders'] })
      } else {
        // Toplu sipariş için fatura - invoice_groups kullan
        if (selectedOrders.size === 0) {
          showToast('Lütfen sipariş seçin', 'error')
          return
        }

        if (invoicePhotos.length === 0) {
          showToast('Lütfen fotoğraf ekleyin', 'error')
          return
        }

        const selectedOrdersData = getSelectedOrdersData(orders)
        
        // Ara toplam hesapla
        const firstCurrency = Object.keys(invoiceSubtotals)[0] || 'TRY'
        const subtotal = parseToNumber(invoiceSubtotals[firstCurrency] || '0')
        const discount = invoiceDiscount ? parseToNumber(invoiceDiscount) : null
        const tax = invoiceTax ? parseToNumber(invoiceTax) : null
        const grandTotal = invoiceGrandTotal ? parseToNumber(invoiceGrandTotal) : subtotal

        // 1. Invoice group oluştur
        const { data: { user } } = await supabase.auth.getUser()
        
        const invoiceGroupData = {
          created_by: user?.id || null,
          group_name: `Toplu Fatura - ${new Date().toLocaleDateString('tr-TR')}`,
          notes: invoiceNotes || null,
          subtotal: subtotal,
          discount: discount,
          tax: tax,
          grand_total: grandTotal,
          currency: invoiceGrandTotalCurrency || firstCurrency,
          invoice_photos: invoicePhotos,
        }

        const { data: invoiceGroup, error: groupError } = await supabase
          .from('invoice_groups')
          .insert(invoiceGroupData)
          .select()
          .single()

        if (groupError) {
          console.error('❌ Invoice group kaydetme hatası:', groupError)
          throw groupError
        }

        console.log('✅ Invoice group kaydedildi:', invoiceGroup.id)

        // 2. Tüm siparişler için invoice kayıtları oluştur
        const invoices = selectedOrdersData.map(order => ({
          order_id: order.id,
          amount: parseToNumber(orderAmounts[order.id] || '0'),
          currency: orderCurrencies[order.id] || 'TRY',
          invoice_photos: invoicePhotos,
          invoice_group_id: invoiceGroup.id,
        }))

        console.log('💾 Toplu faturalar kaydediliyor:', {
          invoiceCount: invoices.length,
          groupId: invoiceGroup.id,
          invoices: invoices.map(inv => ({
            order_id: inv.order_id.slice(0, 8),
            amount: inv.amount,
            currency: inv.currency
          }))
        })

        const { data: insertedInvoices, error: invoicesError } = await supabase
          .from('invoices')
          .insert(invoices)
          .select()

        if (invoicesError) {
          console.error('❌ Faturalar kaydetme hatası:', invoicesError)
          console.error('❌ Hata detayları:', {
            message: invoicesError.message,
            details: invoicesError.details,
            hint: invoicesError.hint,
            code: invoicesError.code
          })
          // Invoice group'u geri al
          await supabase.from('invoice_groups').delete().eq('id', invoiceGroup.id)
          throw invoicesError
        }

        console.log('✅ Toplu faturalar başarıyla kaydedildi:', {
          count: insertedInvoices?.length,
          invoices: insertedInvoices
        })

        showToast(`${selectedOrders.size} sipariş için fatura başarıyla kaydedildi`, 'success')
        setIsInvoiceModalOpen(false)
        setOrderAmounts({})
        setOrderCurrencies({})
        setInvoicePhotos([])
        setInvoiceSubtotals({})
        setInvoiceDiscount('')
        setInvoiceTax('')
        setInvoiceGrandTotal('')
        setInvoiceNotes('')
        clearSelection()
        
        // React Query cache'i yenile
        await queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    } catch (error: any) {
      console.error('❌ Fatura kaydetme hatası:', error)
      console.error('❌ Hata detayları:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        stack: error?.stack
      })
      
      // Kullanıcıya daha detaylı hata mesajı göster
      const errorMessage = error?.message || 'Fatura kaydedilirken hata oluştu'
      const errorHint = error?.hint ? ` (${error.hint})` : ''
      showToast(`${errorMessage}${errorHint}`, 'error')
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <h2 className="text-xl font-semibold">Hata Oluştu</h2>
            <p className="text-gray-600 mt-2">{error.message}</p>
          </div>
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
              {orders.length} Sipariş
            </Badge>
            {selectedOrders.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600 text-white text-xs sm:text-sm">
                  {selectedOrders.size} Seçili
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {orders.length > 0 && <OrderStatsCards orders={orders} />}

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
            
            {/* Filters */}
            <OrderFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onClearDateFilters={clearDateFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loading size="lg" text="Siparişler yükleniyor..." />
            </div>
          ) : viewMode === 'invoice' ? (
            <InvoiceGroupView
              invoiceGroups={invoiceGroups}
              noInvoiceOrders={noInvoiceOrders}
              selectedOrders={selectedOrders}
              loadingPDFOrders={loadingPDFOrders}
              onToggleOrderSelect={toggleOrderSelection}
              onViewInvoices={handleViewInvoices}
              onExportPDF={handleExportOrderPDF}
              onExportGroupPDF={handleExportGroupPDF}
              isGeneratingReport={isGeneratingReport}
              orders={orders}
            />
          ) : (
            <OrdersTable
              orders={orders}
              selectedOrders={selectedOrders}
              loadingPDFOrders={loadingPDFOrders}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              isGeneratingReport={isGeneratingReport}
              onToggleOrderSelect={toggleOrderSelection}
              onSelectAllInGroup={selectAllOrdersInGroup}
              onViewInvoices={handleViewInvoices}
              onViewDeliveryPhotos={handleViewDeliveryPhotos}
              onExportPDF={handleExportOrderPDF}
              onPageChange={setCurrentPage}
              onOpenMultiInvoiceModal={handleOpenMultiInvoiceModal}
              onExportMultiplePDF={handleExportMultiplePDF}
            />
          )}
        </CardContent>
      </Card>

      {/* Multi-Select Actions */}
      <MultiSelectActions
        selectedCount={selectedOrders.size}
        onClearSelection={clearSelection}
        onOpenInvoiceModal={handleOpenMultiInvoiceModal}
        onExportPDF={handleExportMultiplePDF}
        isGeneratingReport={isGeneratingReport}
      />

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        title="İrsaliye Fotoğrafları"
      />

      {/* Invoice Modal - Modern Component */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false)
          // Modal kapandığında state'leri temizle
          setSelectedOrderId(null)
          setEditingInvoiceGroupId(null)
          setOrderAmounts({})
          setOrderCurrencies({})
          setInvoicePhotos([])
          setInvoiceSubtotals({})
          setInvoiceDiscount('')
          setInvoiceTax('')
          setInvoiceGrandTotal('')
          setInvoiceNotes('')
          setIndividualInvoiceDetails([])
          setEditedInvoiceValues({})
          clearSelection()
        }}
        onSave={handleSaveInvoice}
        selectedOrderId={selectedOrderId}
        editingInvoiceGroupId={editingInvoiceGroupId}
        selectedOrdersCount={selectedOrders.size}
        invoiceAmount={invoiceAmount}
        invoiceCurrency={invoiceCurrency}
        onInvoiceAmountChange={handleInvoiceAmountChange}
        onInvoiceCurrencyChange={setInvoiceCurrency}
        selectedOrder={selectedOrderId ? orders.find(o => o.id === selectedOrderId) : undefined}
        selectedOrders={getSelectedOrdersData(orders)}
        orderAmounts={orderAmounts}
        orderCurrencies={orderCurrencies}
        onOrderAmountChange={handleOrderAmountChange}
        onOrderCurrencyChange={handleOrderCurrencyChange}
        invoiceSubtotals={invoiceSubtotals}
        invoiceDiscount={invoiceDiscount}
        invoiceTax={invoiceTax}
        invoiceGrandTotal={invoiceGrandTotal}
        invoiceGrandTotalCurrency={invoiceGrandTotalCurrency}
        onSubtotalChange={(currency, value) => setInvoiceSubtotals({ [currency]: value })}
        onSubtotalCurrencyChange={(newCurrency) => {
          const currentAmount = Object.values(invoiceSubtotals)[0] || '0,00'
          setInvoiceSubtotals({ [newCurrency]: currentAmount })
          setInvoiceDiscountCurrency(newCurrency)
          setInvoiceTaxCurrency(newCurrency)
          setInvoiceGrandTotalCurrency(newCurrency)
          const updatedCurrencies: Record<string, string> = {}
          Object.keys(orderCurrencies).forEach(orderId => {
            updatedCurrencies[orderId] = newCurrency
          })
          setOrderCurrencies(updatedCurrencies)
        }}
        onDiscountChange={setInvoiceDiscount}
        onTaxChange={setInvoiceTax}
        invoicePhotos={invoicePhotos}
        onPhotoUpload={handleInvoicePhotoUpload}
        onPhotoRemove={handleRemoveInvoicePhoto}
        isUploadingInvoice={isUploadingInvoice}
        invoiceNotes={invoiceNotes}
        onNotesChange={setInvoiceNotes}
        individualInvoiceDetails={individualInvoiceDetails}
        editedInvoiceValues={editedInvoiceValues}
        onIndividualInvoiceChange={handleIndividualInvoiceChange}
      />


      {/* Invoice Viewer Modal */}
      <Dialog open={isInvoiceViewerOpen} onOpenChange={setIsInvoiceViewerOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Faturalar ({selectedInvoices.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Invoice Group Bilgileri - Toplu fatura için */}
            {invoiceGroupInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Toplu Fatura Grubu</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Grup Adı:</span>
                    <div className="font-medium text-gray-900">{invoiceGroupInfo.group_name}</div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Sipariş Sayısı:</span>
                    <div className="font-medium text-gray-900">{invoiceGroupInfo.invoice_count} sipariş</div>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">Ara Toplam:</span>
                    <div className="font-medium text-gray-900">
                      {getCurrencySymbol(invoiceGroupInfo.currency)}
                      {invoiceGroupInfo.subtotal?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoiceGroupInfo.currency}
                    </div>
                  </div>
                  
                  {invoiceGroupInfo.discount && invoiceGroupInfo.discount > 0 && (
                    <div>
                      <span className="text-gray-600">İndirim:</span>
                      <div className="font-medium text-red-600">
                        -{getCurrencySymbol(invoiceGroupInfo.currency)}
                        {invoiceGroupInfo.discount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoiceGroupInfo.currency}
                      </div>
                    </div>
                  )}
                  
                  {invoiceGroupInfo.tax && invoiceGroupInfo.tax > 0 && (
                    <div>
                      <span className="text-gray-600">KDV:</span>
                      <div className="font-medium text-gray-900">
                        {getCurrencySymbol(invoiceGroupInfo.currency)}
                        {invoiceGroupInfo.tax?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoiceGroupInfo.currency}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-gray-600">Genel Toplam:</span>
                    <div className="font-bold text-lg text-green-600">
                      {getCurrencySymbol(invoiceGroupInfo.currency)}
                      {invoiceGroupInfo.grand_total?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoiceGroupInfo.currency}
                    </div>
                  </div>
                </div>
                
                {invoiceGroupInfo.notes && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <span className="text-gray-600 text-sm">Notlar:</span>
                    <div className="text-sm text-gray-700 mt-1">{invoiceGroupInfo.notes}</div>
                  </div>
                )}
              </div>
            )}
            
            {/* Her bir fatura detayı */}
            {selectedInvoices.map((invoice, invoiceIndex) => (
              <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                {/* Fatura Başlığı ve Tutar */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-gray-500 mb-1">
                      Fatura {invoiceIndex + 1}
                    </div>
                    
                    {editingInvoiceId === invoice.id ? (
                      <div className="space-y-2">
                        <Label className="text-xs">Fatura Tutarı</Label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            value={editInvoiceAmount}
                            onChange={(e) => {
                              const formatted = formatNumberWithDots(e.target.value)
                              setEditInvoiceAmount(formatted)
                            }}
                            className="flex-1"
                          />
                          <Select value={editInvoiceCurrency} onValueChange={setEditInvoiceCurrency}>
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
                    ) : (
                      <div className="text-2xl font-bold text-gray-900">
                        {getCurrencySymbol(invoice.currency)}
                        {invoice.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(invoice.created_at).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  
                  {/* Edit/Save/Cancel/Delete Buttons */}
                  <div className="flex items-center gap-2 justify-end">
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
                        <Button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          size="sm"
                          disabled={isUpdatingInvoice}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Sil
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleStartEditInvoice(invoice)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Düzenle
                        </Button>
                        <Button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Sil
                        </Button>
                      </>
                    )}
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

                {/* Toplu Fatura Özet Bilgileri */}
                {invoice.is_master && (invoice.subtotal || invoice.discount || invoice.tax || invoice.grand_total) && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-sm font-semibold text-gray-900 mb-3">Fatura Özeti</div>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                      {invoice.subtotal !== null && invoice.subtotal !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Ara Toplam:</span>
                          <span className="font-medium text-gray-900">
                            {getCurrencySymbol(invoice.currency)}
                            {invoice.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}
                          </span>
                        </div>
                      )}
                      
                      {invoice.discount !== null && invoice.discount !== undefined && invoice.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">İndirim:</span>
                          <span className="font-medium text-red-600">
                            -{getCurrencySymbol(invoice.currency)}
                            {invoice.discount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}
                          </span>
                        </div>
                      )}
                      
                      {invoice.tax !== null && invoice.tax !== undefined && invoice.tax > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">KDV:</span>
                          <span className="font-medium text-gray-900">
                            {getCurrencySymbol(invoice.currency)}
                            {invoice.tax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}
                          </span>
                        </div>
                      )}
                      
                      {invoice.grand_total !== null && invoice.grand_total !== undefined && (
                        <div className="flex justify-between text-sm border-t border-gray-300 pt-2 mt-2">
                          <span className="font-semibold text-gray-900">Genel Toplam:</span>
                          <span className="font-bold text-lg text-gray-900">
                            {getCurrencySymbol(invoice.currency)}
                            {invoice.grand_total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoice.currency}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

          <div className="flex justify-end items-center pt-4 border-t border-gray-200">
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
      
      {/* PDF Fatura Seçim Modalı */}
      <InvoiceSelectionModal
        isOpen={isPDFInvoiceSelectionOpen}
        onClose={() => setIsPDFInvoiceSelectionOpen(false)}
        order={pdfOrderContext}
        selectedInvoiceIds={selectedPDFInvoices}
        onToggleInvoice={handleTogglePDFInvoice}
        onConfirm={handleConfirmPDFInvoiceSelection}
      />
    </div>
  )
}

