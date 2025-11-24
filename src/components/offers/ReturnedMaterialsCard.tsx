'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Calendar } from 'lucide-react'

interface ReturnedMaterialsCardProps {
  request: any
  materialOrders: any[]
  materialSuppliers: { [itemId: string]: any }
  setCurrentImageGallery: (gallery: {images: string[], itemName: string, currentIndex: number}) => void
  setIsImageGalleryOpen: (open: boolean) => void
  onReorder: (item: any, returnedQuantity: number, supplierInfo: any) => void
  onExportPDF: (material: any) => void
  onAssignSupplier: (materialId: string, materialName: string, materialUnit: string) => void
  onCreateOrder: (supplier: any, material: any, returnedQuantity: number) => void
}

export default function ReturnedMaterialsCard({
  request,
  materialOrders,
  materialSuppliers,
  setCurrentImageGallery,
  setIsImageGalleryOpen,
  onReorder,
  onExportPDF,
  onAssignSupplier,
  onCreateOrder
}: ReturnedMaterialsCardProps) {

  // PDF Export fonksiyonu - İade türüne göre
  const handleReturnPDFExport = (item: any, itemOrders: any[], totalReturned: number, totalOrdered: number, isExchange: boolean = false) => {
    if (typeof window !== 'undefined') {
      // İade talebi PDF'i oluştur - pdf-generator.ts stilinde
      const getLogoUrl = () => {
        const storageBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/satinalma`
        return `${storageBaseUrl}/dovecbb.png`
      }

      const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }

      const getCurrentDate = () => {
        return new Date().toLocaleDateString('tr-TR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }

      // Giriş metni - iade türüne göre
      const introText = isExchange 
        ? "Sayın Tedarikçimiz, aşağıda belirtilen malzeme için iade ve değişim talep etmekteyiz. İade sürecinin sorunsuz bir şekilde tamamlanması ve yeni malzemenin gönderilmesi için gerekli işlemlerin başlatılmasını rica ederiz. İşbirliğiniz için teşekkür ederiz."
        : "Sayın Tedarikçimiz, aşağıda belirtilen malzeme için iade nedeni belirtilmiştir. Bu sebeple iade işlemini gerçekleştirmek istiyoruz. İade sürecinin sorunsuz bir şekilde tamamlanması için gerekli işlemlerin başlatılmasını rica ederiz. İşbirliğiniz için teşekkür ederiz."

      const title = isExchange ? "MALZEME İADE VE DEĞİŞİM TALEBİ" : "MALZEME İADE TALEBİ"
      
      // Profesyonel PDF stilini kullan
      const returnHtml = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title} - ${item.item_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            @page {
              size: A4;
              margin: 0;
              background: white;
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', Arial, sans-serif;
              font-size: 10px;
              line-height: 1.4;
              color: #000000;
              background: white;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            
            .page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm;
              background: white;
              display: block;
              margin: 0 auto;
            }
            
            .header {
              background: white;
              color: black;
              padding: 15px 0;
              margin-bottom: 20px;
              border-bottom: 2px solid #000000;
            }
            
            .header-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .logo-section {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            
            .logo {
              width: 85px;
              height: 85px;
              object-fit: contain;
              max-width: 85px;
              max-height: 85px;
              display: block;
            }
            
            .header-title {
              font-size: 12px;
              font-weight: 700;
              color: #000000;
              margin-bottom: 3px;
            }
            
            .header-subtitle {
              font-size: 10px;
              color: #333333;
            }
            
            .header-date {
              text-align: right;
              font-size: 9px;
              color: #333333;
            }
            
            .section {
              margin-bottom: 20px;
            }
            
            .section-title {
              font-size: 12px;
              font-weight: 700;
              color: #000000;
              background: #f5f5f5;
              padding: 8px 12px;
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .info-card {
              background: white;
              padding: 15px;
            }
            
            .info-row {
              display: flex;
              margin-bottom: 8px;
              align-items: flex-start;
            }
            
            .info-row:last-child {
              margin-bottom: 0;
            }
            
            .info-label {
              width: 120px;
              font-size: 9px;
              font-weight: 600;
              color: #333333;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            .info-value {
              flex: 1;
              font-size: 10px;
              color: #000000;
              font-weight: 400;
            }
            
            .return-highlight {
              background: #fee2e2;
              padding: 15px;
              border: 1px solid #fecaca;
              border-left: 3px solid #dc2626;
            }
            
            .material-image {
              width: 100%;
              max-width: 150px;
              height: auto;
              border: 1px solid #dddddd;
              border-radius: 8px;
              object-fit: cover;
              margin: 10px 0;
            }
            
            .footer {
              position: fixed;
              bottom: 10mm;
              left: 15mm;
              right: 15mm;
              border-top: 1px solid #cccccc;
              padding-top: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              color: #333333;
            }
            
            .footer-center {
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <!-- Header -->
            <div class="header">
              <div class="header-content">
                <div class="logo-section">
                  <img src="${getLogoUrl()}" alt="DOVEC Logo" class="logo" onerror="this.onerror=null; this.src='/d.png';" />
                  <div>
                    <div class="header-title">${title}</div>
                    <div class="header-subtitle">İnşaat Malzeme Yönetim Sistemi</div>
                  </div>
                </div>
                <div class="header-date">
                  <div>Talep Tarihi:</div>
                  <div>${getCurrentDate()}</div>
                </div>
              </div>
            </div>

            <!-- Giriş Metni -->
            <div style="margin-bottom: 30px; padding: 20px 0;">
              <p style="font-size: 12px; color: #333333; line-height: 1.6; margin: 0; font-weight: 400; text-align: justify;">
                ${introText}
              </p>
            </div>

            <!-- Malzeme Bilgileri -->
            <div class="section">
              <div class="section-title">MALZEME BİLGİLERİ</div>
              <div class="info-card">
                <div class="info-row">
                  <div class="info-label">MALZEME ADI</div>
                  <div class="info-value">${item.item_name}</div>
                </div>
                ${item.brand ? `
                <div class="info-row">
                  <div class="info-label">MARKA</div>
                  <div class="info-value">${item.brand}</div>
                </div>
                ` : ''}
                ${item.specifications ? `
                <div class="info-row">
                  <div class="info-label">ÖZELLİKLER</div>
                  <div class="info-value">${item.specifications}</div>
                </div>
                ` : ''}
                <div class="info-row">
                  <div class="info-label">BİRİM</div>
                  <div class="info-value">${item.unit}</div>
                </div>
                ${item.image_urls && item.image_urls.length > 0 ? `
                <div class="info-row">
                  <div class="info-label">MALZEME RESMİ</div>
                  <div class="info-value">
                    <img src="${item.image_urls[0]}" alt="Malzeme Resmi" class="material-image" />
                  </div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Tedarikçi Bilgileri -->
            <div class="section">
              <div class="section-title">TEDARİKÇİ BİLGİLERİ</div>
              <div class="info-card">
                <div class="info-row">
                  <div class="info-label">TEDARİKÇİ ADI</div>
                  <div class="info-value">${itemOrders[0].supplier?.name || itemOrders[0].suppliers?.name || 'Test'}</div>
                </div>
                ${itemOrders[0].supplier?.contact_person ? `
                <div class="info-row">
                  <div class="info-label">İLETİŞİM KİŞİSİ</div>
                  <div class="info-value">${itemOrders[0].supplier.contact_person}</div>
                </div>
                ` : ''}
                ${itemOrders[0].supplier?.phone ? `
                <div class="info-row">
                  <div class="info-label">TELEFON</div>
                  <div class="info-value">${itemOrders[0].supplier.phone}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- İade Detayları -->
            <div class="section">
              <div class="section-title">${isExchange ? 'İADE VE DEĞİŞİM DETAYLARI' : 'İADE DETAYLARI'}</div>
              <div class="return-highlight">
                <div class="info-row">
                  <div class="info-label">İADE EDİLEN MİKTAR</div>
                  <div class="info-value" style="font-weight: 600; color: #dc2626;">${totalReturned.toFixed(2)} ${item.unit}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">TOPLAM SİPARİŞ MİKTARI</div>
                  <div class="info-value">${totalOrdered.toFixed(2)} ${item.unit}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">${isExchange ? 'İADE VE DEĞİŞİM NEDENİ' : 'İADE NEDENİ'}</div>
                  <div class="info-value">${itemOrders[0].return_notes || 'İade talebi'}</div>
                </div>
                ${itemOrders[0].delivery_date ? `
                <div class="info-row">
                  <div class="info-label">SİPARİŞ TARİHİ</div>
                  <div class="info-value">${formatDate(itemOrders[0].delivery_date)}</div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div>Bu belge sistem tarafından otomatik olarak oluşturulmuştur.</div>
              <div class="footer-center">İnşaat Malzeme Yönetim Sistemi - DOVEC</div>
              <div>Sayfa 1</div>
            </div>
          </div>
        </body>
        </html>
      `
      
      // PDF'i yeni pencerede aç
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(returnHtml)
        printWindow.document.close()
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus()
            printWindow.print()
          }, 500)
        }
      }
    }
  }

  // Tüm durumlar için kontrol et - status'a bakmadan iade var mı kontrol et
  if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
    return null
  }

  // Sadece "yeniden sipariş istenmiyor" durumundaki iade edilen malzemeleri bul
  const returnedItems = request.purchase_request_items.filter((item: any) => {
    // Bu malzeme için siparişlerde iade var mı kontrol et
    const itemOrders = Array.isArray(materialOrders) 
      ? materialOrders.filter((order: any) => order.material_item_id === item.id)
      : []
    
    // İade var mı ve yeniden sipariş istenmiyor mu kontrol et
    const hasReturns = itemOrders.some((order: any) => (order.returned_quantity || 0) > 0)
    const hasReorderNotRequested = itemOrders.some((order: any) => 
      (order.returned_quantity || 0) > 0 && order.reorder_requested === false
    )
    
    return hasReturns && hasReorderNotRequested
  })

  // İade edilen malzeme yoksa komponenti gösterme
  if (returnedItems.length === 0) return null


  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {returnedItems.map((item: any, index: number) => {
            // Bu malzeme için sadece "yeniden sipariş istenmiyor" durumundaki iade edilen siparişleri bul
            const itemOrders = Array.isArray(materialOrders) 
              ? materialOrders.filter((order: any) => 
                  order.material_item_id === item.id && 
                  (order.returned_quantity || 0) > 0 && 
                  order.reorder_requested === false
                )
              : []

            const totalReturned = itemOrders.reduce((sum: number, order: any) => sum + (order.returned_quantity || 0), 0)
        const totalOrdered = itemOrders.reduce((sum: number, order: any) => sum + (order.quantity || 0), 0)

            return (
          <div key={item.id} className="relative">
            {/* Header with Material Info */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-4">
                {/* Malzeme Görseli */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                        {item.image_urls && item.image_urls.length > 0 ? (
                          <img
                            src={item.image_urls[0]}
                            alt={item.item_name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                            onClick={() => {
                              setCurrentImageGallery({
                                images: item.image_urls,
                                itemName: item.item_name,
                                currentIndex: 0
                              })
                              setIsImageGalleryOpen(true)
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = `
                                <div class="w-full h-full flex items-center justify-center bg-gray-100">
                            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                                  </svg>
                                </div>
                              `;
                            }}
                          />
                        ) : (
                    <Package className="w-6 h-6 text-gray-600" />
                        )}
                      </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.item_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {new Date(request.created_at).toLocaleDateString('tr-TR')} • Sipariş #{request.id.toString().slice(-8)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div></div>
            </div>

            {/* Material Details */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-3">
                  {item.brand && (
                    <div>
                      <span className="text-sm text-gray-600">Marka:</span>
                      <p className="font-medium text-gray-900">{item.brand}</p>
                        </div>
                      )}
                    </div>
                    
                {/* Right Column */}
                <div className="space-y-3">
                  {item.specifications && (
                    <div>
                      <span className="text-sm text-gray-600">Özellikler:</span>
                      <p className="font-medium text-gray-900">{item.specifications}</p>
                          </div>
                        )}
                </div>
              </div>
            </div>

  {/* Return Section - Tedarikçilere göre gruplama */}
  <div className="mx-6 mb-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-semibold text-gray-700">İade Detayları</span>
              </div>
              
              {(() => {
                // Sadece "yeniden sipariş istenmiyor" siparişlerini tedarikçilere göre grupla
                const supplierGroups = itemOrders.reduce((groups: any, order: any) => {
                  // Sadece reorder_requested === false olan siparişleri işle
                  if (order.reorder_requested !== false) return groups
                  
                  const supplierId = order.supplier_id || order.suppliers?.id || 'unknown'
                  const supplierName = order.supplier?.name || order.suppliers?.name || 'Bilinmeyen Tedarikçi'
                  
                  if (!groups[supplierId]) {
                    groups[supplierId] = {
                      supplierName: supplierName,
                      orders: []
                    }
                  }
                  
                  groups[supplierId].orders.push(order)
                  return groups
                }, {})
                
                const suppliers = Object.values(supplierGroups)
                
                return suppliers.map((supplierGroup: any, idx: number) => {
                  const totalReturnedForSupplier = supplierGroup.orders.reduce((sum: number, order: any) => 
                    sum + (order.returned_quantity || 0), 0
                  )
                  
                  return (
                    <div key={idx} className="bg-red-50 rounded-xl p-4 border border-red-100">
                      {/* Tedarikçi Header */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-200">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6"></path>
                            </svg>
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-red-900">{supplierGroup.supplierName}</h5>
                            <p className="text-xs text-red-700">Tedarikçi</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-red-600 font-medium">İade Miktarı</div>
                          <div className="text-lg font-bold text-red-700">
                            {totalReturnedForSupplier.toFixed(2)} {item.unit}
                          </div>
                        </div>
                      </div>
                      
                      {/* İade Notları */}
                      <div className="space-y-2">
                        {supplierGroup.orders.map((order: any, orderIdx: number) => (
                          <div key={order.id} className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-red-600">{orderIdx + 1}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-600">
                                    Sipariş #{order.id.toString().slice(-6)}
                                  </span>
                                  <span className="text-xs font-bold text-red-600">
                                    {(order.returned_quantity || 0).toFixed(2)} {item.unit}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-800">
                                  {order.return_notes || 'İade nedeni belirtilmemiş'}
                                </p>
                                {order.delivery_date && (
                                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                    Sipariş: {new Date(order.delivery_date).toLocaleDateString('tr-TR')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Tedarikçi İşlem Butonları */}
                      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-red-200">
                        {/* Yeniden sipariş istenmiyor durumunda bilgi mesajı */}
                        {(() => {
                          // Bu tedarikçi için yeniden sipariş istenip istenmediğini kontrol et
                          const reorderNotRequestedOrders = supplierGroup.orders.filter((order: any) => 
                            order.reorder_requested === false
                          )
                          const hasReorderNotRequested = reorderNotRequestedOrders.length > 0
                          
                          if (hasReorderNotRequested) {
                            // Yeniden sipariş istenmiyorsa bilgi mesajı göster
                            return (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                                    <span className="text-gray-600 text-xs">⚠</span>
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-700">Yeniden sipariş istenmiyor</div>
                                    <div className="text-xs text-gray-600">İade işlemi sırasında yeniden sipariş istenmediği belirtilmiş</div>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        })()}
                        
                        {/* İade Talebi Butonu - Sadece "yeniden sipariş istenmiyor" durumları için */}
                        <Button
                          onClick={() => {
                            handleReturnPDFExport(item, supplierGroup.orders, totalReturnedForSupplier, supplierGroup.orders.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0), false)
                          }}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                          İade Talebi
                        </Button>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Quantity Summary - Yan Yana */}
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                {/* İade Miktarı */}
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <div className="text-center">
                    <span className="text-sm font-medium text-red-700 block mb-1">İade Miktarı:</span>
                    <span className="text-lg font-bold text-red-600">
                      {totalReturned.toFixed(2)} {item.unit}
                    </span>
                  </div>
                </div>

                {/* Sipariş Miktarı */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <div className="text-center">
                    <span className="text-sm font-medium text-green-700 block mb-1">Sipariş Miktarı:</span>
                    <span className="text-lg font-bold text-green-600">
                      {totalOrdered.toFixed(2)} {item.unit}
                    </span>
                  </div>
                </div>
        </div>
      </div>



          
              </div>
            )
          })}
    </div>
  )
}
