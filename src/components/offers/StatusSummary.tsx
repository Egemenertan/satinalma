'use client'

import React from 'react'
import { CheckCircle, Package } from 'lucide-react'

interface StatusSummaryProps {
  request: any
  shipmentData: any
}

export default function StatusSummary({ request, shipmentData }: StatusSummaryProps) {
  if (!request?.purchase_request_items || request.purchase_request_items.length === 0) {
    return null
  }

  const shippedCount = request.purchase_request_items.filter(item => {
    const itemShipments = shipmentData[item.id]
    return (itemShipments?.total_shipped || 0) > 0
  }).length
  
  const totalCount = request.purchase_request_items.length
  
  if (shippedCount === totalCount) {
    return (
      <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-green-900">Tüm Malzemeler Gönderildi</h4>
            <p className="text-sm text-green-700">
              Bu talep için tüm malzemeler başarıyla gönderilmiştir.
            </p>
          </div>
        </div>
      </div>
    )
  } else if (shippedCount > 0) {
    return (
      <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Package className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <h5 className="text-sm font-medium text-yellow-800">
              {shippedCount}/{totalCount} malzeme gönderildi
            </h5>
            <p className="text-xs text-yellow-600 mt-1">
              Kalan malzemelerin gönderimini tamamlayın
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return null
}
