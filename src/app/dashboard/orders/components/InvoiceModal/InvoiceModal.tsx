'use client'

/**
 * InvoiceModal Component - Apple Design Inspired
 * Geniş, ferah, modern ve minimal fatura yönetim modal'ı
 * 
 * Tasarım Prensipleri:
 * - Geniş, rahat kullanım alanı
 * - Temiz, minimal arayüz
 * - Yumuşak geçişler ve hover efektleri
 * - İyi organize edilmiş bilgi hiyerarşisi
 * - Apple'ın tasarım dilini yansıtan renk paleti
 */

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Receipt, Upload, X, Image as ImageIcon, FileText, ZoomIn, Scan } from 'lucide-react'
import { InlineLoading } from '@/components/ui/loading'
import { formatNumberWithDots, parseToNumber } from '../../utils'
import FullScreenImageViewer from '@/components/FullScreenImageViewer'
import DocumentScanner from '@/components/DocumentScanner'

// Types
interface InvoiceModalProps {
  // Modal State
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  
  // Mode
  selectedOrderId: string | null
  editingInvoiceGroupId: string | null
  selectedOrdersCount: number
  
  // Single Order State
  invoiceAmount: string
  invoiceCurrency: string
  onInvoiceAmountChange: (value: string) => void
  onInvoiceCurrencyChange: (value: string) => void
  
  // Single Order Data (for display)
  selectedOrder?: any
  
  // Multiple Orders State
  selectedOrders: any[]
  orderAmounts: Record<string, string>
  orderCurrencies: Record<string, string>
  onOrderAmountChange: (orderId: string, value: string) => void
  onOrderCurrencyChange: (orderId: string, value: string) => void
  
  // Summary State
  invoiceSubtotals: Record<string, string>
  invoiceDiscount: string
  invoiceTax: string
  invoiceGrandTotal: string
  invoiceGrandTotalCurrency: string
  onSubtotalChange: (currency: string, value: string) => void
  onSubtotalCurrencyChange: (newCurrency: string) => void
  onDiscountChange: (value: string) => void
  onTaxChange: (value: string) => void
  
  // Photos State
  invoicePhotos: string[]
  onPhotoUpload: (files: FileList) => Promise<void>
  onPhotoRemove: (index: number) => void
  isUploadingInvoice: boolean
  
  // Notes State
  invoiceNotes: string
  onNotesChange: (value: string) => void
  
  // Individual Invoice Details (for multiple invoices on same order)
  individualInvoiceDetails?: Array<{
    id: string
    amount: number
    currency: string
    subtotal: number | null
    discount: number | null
    tax: number | null
    grand_total: number | null
    created_at: string
  }>
  
  // Edited values for individual invoices
  editedInvoiceValues?: Record<string, {
    subtotal: string
    discount: string
    tax: string
  }>
  onIndividualInvoiceChange?: (invoiceId: string, field: 'subtotal' | 'discount' | 'tax', value: string) => void
}

export function InvoiceModal({
  isOpen,
  onClose,
  onSave,
  selectedOrderId,
  editingInvoiceGroupId,
  selectedOrdersCount,
  invoiceAmount,
  invoiceCurrency,
  onInvoiceAmountChange,
  onInvoiceCurrencyChange,
  selectedOrder,
  selectedOrders,
  orderAmounts,
  orderCurrencies,
  onOrderAmountChange,
  onOrderCurrencyChange,
  invoiceSubtotals,
  invoiceDiscount,
  invoiceTax,
  invoiceGrandTotal,
  invoiceGrandTotalCurrency,
  onSubtotalChange,
  onSubtotalCurrencyChange,
  onDiscountChange,
  onTaxChange,
  invoicePhotos,
  onPhotoUpload,
  onPhotoRemove,
  isUploadingInvoice,
  invoiceNotes,
  onNotesChange,
  individualInvoiceDetails = [],
  editedInvoiceValues = {},
  onIndividualInvoiceChange,
}: InvoiceModalProps) {
  
  // Image viewer state
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
  // Document scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  
  // Modal başlığını belirle
  const getModalTitle = () => {
    if (editingInvoiceGroupId) return 'Fatura Düzenle'
    if (selectedOrderId) return 'Yeni Fatura'
    return `Toplu Fatura Oluştur`
  }

  const getModalSubtitle = () => {
    if (editingInvoiceGroupId) return 'Mevcut fatura bilgilerini güncelleyin'
    if (selectedOrderId) return 'Sipariş için fatura bilgilerini girin'
    return `${selectedOrdersCount} sipariş için fatura oluşturun`
  }
  
  // Handle photo click to open viewer
  const handlePhotoClick = (index: number) => {
    setSelectedImageIndex(index)
    setIsImageViewerOpen(true)
  }
  
  // Handle scanner complete
  const handleScanComplete = async (files: File[]) => {
    // FileList benzeri bir obje oluştur
    const fileList = {
      length: files.length,
      item: (index: number) => files[index],
      [Symbol.iterator]: function* () {
        for (let i = 0; i < files.length; i++) {
          yield files[i]
        }
      }
    } as FileList
    
    await onPhotoUpload(fileList)
    setIsScannerOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false}
        className="!max-w-[90vw] !w-[1100px] bg-white !max-h-[90vh] flex flex-col p-0 gap-0 border-0 shadow-2xl [&]:!rounded-[2rem]"
        style={{ borderRadius: '2rem' }}
      >
        {/* Apple Style Header - Siyah Beyaz */}
        <div className="relative bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-8 py-6 flex-shrink-0 rounded-t-[2rem]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
               
                <div>
                  <DialogTitle className="text-4xl font-semibold text-gray-900 tracking-tight">
                    {getModalTitle()}
                  </DialogTitle>
                  <p className="text-sm text-gray-500 mt-0.5">{getModalSubtitle()}</p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full w-8 h-8 p-0 hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Body - Geniş ve ferah */}
        <div className="overflow-y-auto flex-1 px-8 py-6">
          <div className="max-w-[1200px] mx-auto space-y-8">
          
          {/* TEK SİPARİŞ BİLGİLERİ */}
          {selectedOrderId && selectedOrder && (
            <OrderInfoCard order={selectedOrder} />
          )}

          {/* TEK SİPARİŞ İÇİN TUTAR */}
          {selectedOrderId && (
            <SingleOrderInvoice
              invoiceAmount={invoiceAmount}
              invoiceCurrency={invoiceCurrency}
              onAmountChange={onInvoiceAmountChange}
              onCurrencyChange={onInvoiceCurrencyChange}
            />
          )}

          {/* ÇOKLU SİPARİŞ İÇİN TUTARLAR */}
          {!selectedOrderId && (selectedOrders.length > 0 || editingInvoiceGroupId) && (
            <MultipleOrdersInvoice
              orders={selectedOrders}
              orderAmounts={orderAmounts}
              orderCurrencies={orderCurrencies}
              onAmountChange={onOrderAmountChange}
              onCurrencyChange={onOrderCurrencyChange}
            />
          )}

          {/* FATURA ÖZETİ - Hem tek hem toplu fatura için göster */}
          {(selectedOrderId || Object.keys(invoiceSubtotals).length > 0) && (
            <InvoiceSummary
              invoiceSubtotals={invoiceSubtotals}
              invoiceDiscount={invoiceDiscount}
              invoiceTax={invoiceTax}
              invoiceGrandTotal={invoiceGrandTotal}
              invoiceGrandTotalCurrency={invoiceGrandTotalCurrency}
              onSubtotalChange={onSubtotalChange}
              onSubtotalCurrencyChange={onSubtotalCurrencyChange}
              onDiscountChange={onDiscountChange}
              onTaxChange={onTaxChange}
              individualInvoiceDetails={individualInvoiceDetails}
              editedInvoiceValues={editedInvoiceValues}
              onIndividualInvoiceChange={onIndividualInvoiceChange}
            />
          )}

          {/* FATURA FOTOĞRAFLARI */}
          <InvoicePhotos
            invoicePhotos={invoicePhotos}
            onPhotoUpload={onPhotoUpload}
            onPhotoRemove={onPhotoRemove}
            onPhotoClick={handlePhotoClick}
            isUploadingInvoice={isUploadingInvoice}
            onOpenScanner={() => setIsScannerOpen(true)}
          />

          {/* NOTLAR */}
          <InvoiceNotes
            invoiceNotes={invoiceNotes}
            onNotesChange={onNotesChange}
          />
          </div>
        </div>

        {/* Apple Style Footer - Minimal ve ferah */}
        <div className="relative bg-gray-50 border-t border-gray-200 px-8 py-5 flex-shrink-0 rounded-b-[2rem]">
          <div className="max-w-[1000px] mx-auto flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {selectedOrdersCount > 1 && `${selectedOrdersCount} sipariş seçildi`}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isUploadingInvoice}
                className="px-6 h-11 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                İptal
              </Button>
              <Button
                onClick={onSave}
                disabled={isUploadingInvoice}
                className="px-8 h-11 rounded-xl font-medium bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white shadow-lg shadow-gray-900/30 transition-all hover:shadow-xl hover:scale-[1.02]"
              >
                {isUploadingInvoice ? (
                  <>
                    <InlineLoading className="mr-2" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Kaydet
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      
      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={invoicePhotos}
        initialIndex={selectedImageIndex}
        title="Fatura Fotoğrafları"
      />
      
      {/* Document Scanner */}
      <DocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScanComplete}
        maxPages={10}
        title="Fatura Tara"
        description="Faturayı kamera ile tarayın, otomatik olarak iyileştirilecektir"
      />
    </Dialog>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================

// Sipariş Bilgi Kartı - Tek sipariş için
function OrderInfoCard({ order }: { order: any }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-blue-200">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Sipariş Bilgileri</h3>
              <p className="text-sm text-gray-600">Fatura eklenecek sipariş detayları</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Sol Kolon */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Malzeme</div>
                <div className="text-base font-semibold text-gray-900">
                  {order.purchase_request_items?.item_name || 'Belirtilmemiş'}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tedarikçi</div>
                <div className="text-base font-medium text-gray-900">
                  {order.suppliers?.name || 'Belirtilmemiş'}
                </div>
              </div>
              
              {order.purchase_request_items?.brand && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Marka</div>
                  <div className="text-base font-medium text-gray-900">
                    {order.purchase_request_items.brand}
                  </div>
                </div>
              )}
            </div>
            
            {/* Sağ Kolon */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Miktar</div>
                <div className="text-base font-semibold text-gray-900">
                  {order.quantity} {order.purchase_request_items?.unit || 'adet'}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sipariş Tutarı</div>
                <div className="text-base font-semibold text-gray-900">
                  {order.amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {order.currency}
                </div>
              </div>
              
              {order.delivery_date && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Teslimat Tarihi</div>
                  <div className="text-base font-medium text-gray-900">
                    {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {order.purchase_request_items?.description && (
            <div className="pt-3 border-t border-blue-200">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Açıklama</div>
              <div className="text-sm text-gray-700">
                {order.purchase_request_items.description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Tek Sipariş Fatura Formu - Siyah Beyaz, Düzgün Input
function SingleOrderInvoice({
  invoiceAmount,
  invoiceCurrency,
  onAmountChange,
  onCurrencyChange,
}: {
  invoiceAmount: string
  invoiceCurrency: string
  onAmountChange: (value: string) => void
  onCurrencyChange: (value: string) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
        <FileText className="w-5 h-5 text-gray-900" />
        <h3 className="font-semibold text-gray-900">Fatura Bilgileri</h3>
      </div>
      <div className="space-y-3">
        <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
          Fatura Tutarı
        </Label>
        <div className="flex gap-3">
          <Input
            id="amount"
            type="text"
            placeholder="0,00"
            value={invoiceAmount}
            onFocus={(e) => {
              if (e.target.value === '0' || e.target.value === '0,00') {
                onAmountChange('')
              }
            }}
            onChange={(e) => {
              const formatted = formatNumberWithDots(e.target.value)
              onAmountChange(formatted)
            }}
            className="flex-1 h-12 rounded-xl border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-lg"
          />
          <Select value={invoiceCurrency} onValueChange={onCurrencyChange}>
            <SelectTrigger className="w-28 h-12 rounded-xl border-gray-300 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-xl border-gray-200 shadow-xl">
              <SelectItem value="TRY" className="rounded-lg font-medium">TRY</SelectItem>
              <SelectItem value="USD" className="rounded-lg font-medium">USD</SelectItem>
              <SelectItem value="EUR" className="rounded-lg font-medium">EUR</SelectItem>
              <SelectItem value="GBP" className="rounded-lg font-medium">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

// Çoklu Sipariş Fatura Formu - Siyah Beyaz, Düzgün Input
function MultipleOrdersInvoice({
  orders,
  orderAmounts,
  orderCurrencies,
  onAmountChange,
  onCurrencyChange,
}: {
  orders: any[]
  orderAmounts: Record<string, string>
  orderCurrencies: Record<string, string>
  onAmountChange: (orderId: string, value: string) => void
  onCurrencyChange: (orderId: string, value: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
         
          <h3 className="font-semibold text-gray-900">Sipariş Fatura Tutarları</h3>
        </div>
        <div className="text-sm text-gray-500">{orders.length} sipariş</div>
      </div>
      
      <div className="max-h-[450px] overflow-y-auto space-y-3 pr-2">
        {orders.map((order, index) => (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-400 hover:shadow-md transition-all duration-200">
            <div className="grid grid-cols-12 gap-6 items-center">
              {/* Sipariş Numarası ve Bilgileri */}
              <div className="col-span-6 min-w-0">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-900 font-semibold text-sm">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base text-gray-900 mb-2 truncate">
                      {order.purchase_request_items?.item_name || 'Malzeme belirtilmemiş'}
                    </div>
                    <div className="space-y-1 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Tedarikçi: <span className="text-gray-700">{order.suppliers?.name || 'Belirtilmemiş'}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">•</span>
                        <span>Miktar: <span className="text-gray-700 font-medium">{order.quantity} {order.purchase_request_items?.unit || ''}</span></span>
                      </div>
                      {order.purchase_request_items?.brand && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">•</span>
                          <span>Marka: <span className="text-gray-700">{order.purchase_request_items.brand}</span></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Tutar Input - Düzgün ve temiz */}
              <div className="col-span-4">
                <Label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wide">Fatura Tutarı</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={orderAmounts[order.id] || ''}
                  onFocus={(e) => {
                    if (e.target.value === '0' || e.target.value === '0,00') {
                      onAmountChange(order.id, '')
                    }
                  }}
                  onChange={(e) => {
                    const formatted = formatNumberWithDots(e.target.value)
                    onAmountChange(order.id, formatted)
                  }}
                  className="h-11 rounded-xl border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-base font-medium"
                />
              </div>
              
              {/* Para Birimi */}
              <div className="col-span-2">
                <Label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wide">Para Birimi</Label>
                <Select 
                  value={orderCurrencies[order.id] || 'TRY'} 
                  onValueChange={(currency) => onCurrencyChange(order.id, currency)}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl border-gray-300 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-xl border-gray-200 shadow-xl">
                    <SelectItem value="TRY" className="rounded-lg font-medium">TRY</SelectItem>
                    <SelectItem value="USD" className="rounded-lg font-medium">USD</SelectItem>
                    <SelectItem value="EUR" className="rounded-lg font-medium">EUR</SelectItem>
                    <SelectItem value="GBP" className="rounded-lg font-medium">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Fatura Özeti - Siyah Beyaz, Düzgün Input
function InvoiceSummary({
  invoiceSubtotals,
  invoiceDiscount,
  invoiceTax,
  invoiceGrandTotal,
  invoiceGrandTotalCurrency,
  onSubtotalChange,
  onSubtotalCurrencyChange,
  onDiscountChange,
  onTaxChange,
  individualInvoiceDetails = [],
  editedInvoiceValues = {},
  onIndividualInvoiceChange,
}: {
  invoiceSubtotals: Record<string, string>
  invoiceDiscount: string
  invoiceTax: string
  invoiceGrandTotal: string
  invoiceGrandTotalCurrency: string
  onSubtotalChange: (currency: string, value: string) => void
  onSubtotalCurrencyChange: (newCurrency: string) => void
  onDiscountChange: (value: string) => void
  onTaxChange: (value: string) => void
  individualInvoiceDetails?: Array<{
    id: string
    amount: number
    currency: string
    subtotal: number | null
    discount: number | null
    tax: number | null
    grand_total: number | null
    created_at: string
  }>
  editedInvoiceValues?: Record<string, {
    subtotal: string
    discount: string
    tax: string
  }>
  onIndividualInvoiceChange?: (invoiceId: string, field: 'subtotal' | 'discount' | 'tax', value: string) => void
}) {
  const currentCurrency = Object.keys(invoiceSubtotals)[0] || 'TRY'
  const currentSubtotal = Object.values(invoiceSubtotals)[0] || '0,00'

  // Birden fazla fatura varsa, her birinin detaylarını ayrı göster
  if (individualInvoiceDetails.length > 1) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-gray-200">
          <Receipt className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900 text-lg">Fatura Özeti ({individualInvoiceDetails.length} Adet)</h3>
        </div>
        
        {/* Her fatura için ayrı kart */}
        <div className="space-y-4">
          {individualInvoiceDetails.map((invoice, index) => {
            // Her fatura için değerleri al (düzenlenmiş veya orijinal)
            const invoiceValues = editedInvoiceValues[invoice.id] || {
              subtotal: invoice.subtotal !== null 
                ? invoice.subtotal.toFixed(2).replace('.', ',')
                : invoice.amount.toFixed(2).replace('.', ','),
              discount: invoice.discount !== null && invoice.discount > 0
                ? invoice.discount.toFixed(2).replace('.', ',')
                : '',
              tax: invoice.tax !== null && invoice.tax > 0
                ? invoice.tax.toFixed(2).replace('.', ',')
                : ''
            }
            
            // Genel toplam hesaplama
            const calculateGrandTotal = () => {
              const subtotalNum = parseToNumber(invoiceValues.subtotal)
              const discountNum = parseToNumber(invoiceValues.discount)
              const taxNum = parseToNumber(invoiceValues.tax)
              const total = subtotalNum - discountNum + taxNum
              return total.toFixed(2).replace('.', ',')
            }
            
            const grandTotal = calculateGrandTotal()
            
            return (
              <div key={invoice.id} className="bg-white rounded-xl border-2 border-gray-200 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-gray-600" />
                    <span className="font-semibold text-gray-900">Fatura {index + 1}</span>
                    <span className="text-xs text-gray-500">
                      ({new Date(invoice.created_at).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })})
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    Tutar: {invoice.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {invoice.currency}
                  </span>
                </div>
                
                {/* Fatura detayları - Düzenlenebilir */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Ara Toplam */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Ara Toplam
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={invoiceValues.subtotal}
                        onFocus={(e) => {
                          if (e.target.value === '0' || e.target.value === '0,00') {
                            onIndividualInvoiceChange?.(invoice.id, 'subtotal', '')
                          }
                        }}
                        onChange={(e) => {
                          const formatted = formatNumberWithDots(e.target.value)
                          onIndividualInvoiceChange?.(invoice.id, 'subtotal', formatted)
                        }}
                        className="flex-1 h-11 rounded-lg border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-sm font-medium"
                      />
                      <div className="w-20 h-11 flex items-center justify-center text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg">
                        {invoice.currency}
                      </div>
                    </div>
                  </div>
                  
                  {/* İndirim */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      İndirim <span className="text-gray-400 normal-case">(Opsiyonel)</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={invoiceValues.discount}
                        onFocus={(e) => {
                          if (e.target.value === '0' || e.target.value === '0,00') {
                            onIndividualInvoiceChange?.(invoice.id, 'discount', '')
                          }
                        }}
                        onChange={(e) => {
                          const formatted = formatNumberWithDots(e.target.value)
                          onIndividualInvoiceChange?.(invoice.id, 'discount', formatted)
                        }}
                        className="flex-1 h-11 rounded-lg border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-sm"
                      />
                      <div className="w-20 h-11 flex items-center justify-center text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg">
                        {invoice.currency}
                      </div>
                    </div>
                  </div>
                  
                  {/* KDV */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      KDV <span className="text-gray-400 normal-case">(Opsiyonel)</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={invoiceValues.tax}
                        onFocus={(e) => {
                          if (e.target.value === '0' || e.target.value === '0,00') {
                            onIndividualInvoiceChange?.(invoice.id, 'tax', '')
                          }
                        }}
                        onChange={(e) => {
                          const formatted = formatNumberWithDots(e.target.value)
                          onIndividualInvoiceChange?.(invoice.id, 'tax', formatted)
                        }}
                        className="flex-1 h-11 rounded-lg border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-sm"
                      />
                      <div className="w-20 h-11 flex items-center justify-center text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg">
                        {invoice.currency}
                      </div>
                    </div>
                  </div>
                  
                  {/* Genel Toplam - Otomatik */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Genel Toplam <span className="text-gray-400 normal-case">(Otomatik)</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={grandTotal}
                        readOnly
                        className="flex-1 h-11 rounded-lg font-semibold bg-gray-100 border-2 border-gray-300 text-gray-900 text-sm"
                      />
                      <div className="w-20 h-11 flex items-center justify-center text-xs font-semibold text-gray-900 bg-gray-200 border-2 border-gray-300 rounded-lg">
                        {invoice.currency}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Genel Toplam */}
        <div className="bg-black text-white rounded-xl p-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Tüm Faturalar Toplamı</span>
            <span className="text-2xl font-bold">
              {individualInvoiceDetails.reduce((sum, inv) => sum + (inv.grand_total || inv.amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currentCurrency}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Tek fatura için mevcut görünüm
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-gray-200">
        
        <h3 className="font-semibold text-gray-900 text-lg">Fatura Özeti</h3>
      </div>
      
      {/* Grid Layout - 2 Kolon */}
      <div className="grid grid-cols-2 gap-6">
        {/* Sol Kolon */}
        <div className="space-y-6">
          {/* Ara Toplam */}
          <div className="space-y-2">
            <Label htmlFor="invoice-subtotal" className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Ara Toplam
            </Label>
            <div className="flex gap-3">
              <Input
                id="invoice-subtotal"
                type="text"
                value={currentSubtotal}
                onFocus={(e) => {
                  if (e.target.value === '0' || e.target.value === '0,00') {
                    onSubtotalChange(currentCurrency, '')
                  }
                }}
                onChange={(e) => {
                  const formatted = formatNumberWithDots(e.target.value)
                  onSubtotalChange(currentCurrency, formatted)
                }}
                className="flex-1 h-12 rounded-xl border-gray-300 bg-white focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-base font-medium"
              />
              <Select 
                value={currentCurrency} 
                onValueChange={onSubtotalCurrencyChange}
              >
                <SelectTrigger className="w-28 h-12 rounded-xl border-gray-300 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl border-gray-200 shadow-xl">
                  <SelectItem value="TRY" className="rounded-lg font-medium">TRY</SelectItem>
                  <SelectItem value="USD" className="rounded-lg font-medium">USD</SelectItem>
                  <SelectItem value="EUR" className="rounded-lg font-medium">EUR</SelectItem>
                  <SelectItem value="GBP" className="rounded-lg font-medium">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* İndirim */}
          <div className="space-y-2">
            <Label htmlFor="invoice-discount" className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              İndirim <span className="text-gray-400 normal-case">(Opsiyonel)</span>
            </Label>
            <div className="flex gap-3">
              <Input
                id="invoice-discount"
                type="text"
                placeholder="0,00"
                value={invoiceDiscount}
                onFocus={(e) => {
                  if (e.target.value === '0' || e.target.value === '0,00') {
                    onDiscountChange('')
                  }
                }}
                onChange={(e) => {
                  const formatted = formatNumberWithDots(e.target.value)
                  onDiscountChange(formatted)
                }}
                className="flex-1 h-12 rounded-xl border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-base"
              />
              <div className="w-28 h-12 flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-xl">
                {currentCurrency}
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Kolon */}
        <div className="space-y-6">
          {/* KDV */}
          <div className="space-y-2">
            <Label htmlFor="invoice-tax" className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              KDV <span className="text-gray-400 normal-case">(Opsiyonel)</span>
            </Label>
            <div className="flex gap-3">
              <Input
                id="invoice-tax"
                type="text"
                placeholder="0,00"
                value={invoiceTax}
                onFocus={(e) => {
                  if (e.target.value === '0' || e.target.value === '0,00') {
                    onTaxChange('')
                  }
                }}
                onChange={(e) => {
                  const formatted = formatNumberWithDots(e.target.value)
                  onTaxChange(formatted)
                }}
                className="flex-1 h-12 rounded-xl border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-base"
              />
              <div className="w-28 h-12 flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-xl">
                {currentCurrency}
              </div>
            </div>
          </div>

          {/* Genel Toplam - Vurgulu */}
          <div className="space-y-2">
            <Label htmlFor="invoice-grand-total" className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Genel Toplam <span className="text-gray-400 normal-case">(Otomatik)</span>
            </Label>
            <div className="flex gap-3">
              <Input
                id="invoice-grand-total"
                type="text"
                placeholder="0,00"
                value={invoiceGrandTotal}
                readOnly
                className="flex-1 h-12 rounded-xl font-semibold bg-gray-100 border-2 border-gray-300 text-gray-900 text-lg shadow-sm"
              />
              <div className="w-28 h-12 flex items-center justify-center text-sm font-semibold text-gray-900 bg-gray-200 border-2 border-gray-300 rounded-xl">
                {invoiceGrandTotalCurrency}
              </div>
            </div>
            <p className="text-xs text-gray-500 italic pl-1">
              Ara Toplam - İndirim + KDV
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Fatura Fotoğrafları - Siyah Beyaz
function InvoicePhotos({
  invoicePhotos,
  onPhotoUpload,
  onPhotoRemove,
  onPhotoClick,
  isUploadingInvoice,
  onOpenScanner,
}: {
  invoicePhotos: string[]
  onPhotoUpload: (files: FileList) => Promise<void>
  onPhotoRemove: (index: number) => void
  onPhotoClick?: (index: number) => void
  isUploadingInvoice: boolean
  onOpenScanner?: () => void
}) {
  // Mobil cihaz kontrolü
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-gray-900" />
        <Label className="font-semibold text-gray-900">Fatura Fotoğrafları</Label>
      </div>
      
      {/* Upload Butonu */}
      <div 
        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-gray-400 hover:bg-gray-50 transition-all cursor-pointer group"
        onClick={() => document.getElementById('invoice-upload')?.click()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8 text-gray-900" />
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-1">
              {isUploadingInvoice ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
            </p>
            <p className="text-sm text-gray-500">
              Tıklayın veya sürükleyip bırakın
            </p>
          </div>
        </div>
      </div>
      
      <input
        id="invoice-upload"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onPhotoUpload(e.target.files)
            e.target.value = ''
          }
        }}
      />

      {/* Fotoğraf Önizlemeleri - Modern Grid */}
      {invoicePhotos.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs text-gray-500 uppercase tracking-wide">
            Yüklenen Fotoğraflar ({invoicePhotos.length})
          </Label>
          <div className="grid grid-cols-4 gap-4">
            {invoicePhotos.map((photo, index) => (
              <div key={index} className="relative group">
                <div 
                  className="aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group-hover:border-gray-400 transition-all shadow-sm group-hover:shadow-md cursor-pointer"
                  onClick={() => onPhotoClick?.(index)}
                >
                  <img
                    src={photo}
                    alt={`Fatura ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  
                  {/* Hover overlay - Büyütme ikonu */}
                  {onPhotoClick && (
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPhotoRemove(index)
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 hover:scale-110 transition-all shadow-lg z-10"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Notlar - Siyah Beyaz
function InvoiceNotes({
  invoiceNotes,
  onNotesChange,
}: {
  invoiceNotes: string
  onNotesChange: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-gray-900" />
        <Label htmlFor="invoice-notes" className="font-semibold text-gray-900">
          Notlar <span className="text-sm text-gray-400 font-normal">(Opsiyonel)</span>
        </Label>
      </div>
      <Textarea
        id="invoice-notes"
        placeholder="Fatura ile ilgili notlarınızı buraya yazabilirsiniz..."
        value={invoiceNotes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={4}
        className="resize-none rounded-xl border-gray-300 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
      />
    </div>
  )
}

