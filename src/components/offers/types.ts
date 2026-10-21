export interface Offer {
  supplier_name: string
  unit_price: number
  total_price: number
  delivery_days: number
  delivery_date: string
  notes: string
  currency: string
  documents: File[]
  documentPreviewUrls: string[]
}

export interface PurchaseRequestItem {
  id: string
  item_name: string
  description: string
  quantity: number
  unit: string
  specifications: string
  brand?: string
  purpose: string  // Her malzeme için ayrı kullanım amacı - ZORUNLU
  delivery_date?: string  // Her malzeme için ayrı teslimat tarihi
  original_quantity?: number  // İlk talep edilen miktar - hiç değişmez
  image_urls?: string[]  // Malzeme görselleri
  contract_item_id?: string | null
  purchasing_rejection_reason?: string | null
}

export interface PurchaseRequest {
  id: string
  request_number: string
  title: string
  description: string
  department: string
  urgency_level: string
  status: string
  created_at: string
  updated_at?: string
  requested_by?: string
  delivery_date?: string
  site_id?: string
  site_name?: string
  construction_site_id?: string
  category_name?: string
  subcategory_name?: string
  material_class?: string
  material_group?: string
  image_urls?: string[]
  sent_quantity?: number
  rejection_reason?: string
  notes?: string
  original_request_id?: string
  return_order_id?: string
  it_workflow_applies?: boolean
  purchase_request_items: PurchaseRequestItem[]
  profiles: {
    full_name: string
    email: string
  }
  sites?: {
    id: string
    name: string
    code?: string
    location?: string
  }
  construction_sites?: {
    id: string
    name: string
    code?: string
    location?: string
  }
}

export interface SupplierInfo {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
}

export interface MaterialSupplier {
  isRegistered: boolean
  suppliers: SupplierInfo[]
}

export interface OrderInfo {
  id: string
  delivery_date: string
  supplier_name: string
  created_at: string
  material_item_id: string
}

export interface ShipmentInfo {
  total_shipped: number
  shipments: any[]
}

export interface OffersPageProps {
  request: PurchaseRequest
  existingOffers: any[]
  userRole: string
  materialSuppliers: {[itemId: string]: MaterialSupplier}
  materialOrders: any[]
  shipmentData: {[key: string]: ShipmentInfo}
  onRefresh: () => Promise<void>
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const CURRENCIES = [
  { value: 'TRY', label: 'Türk Lirası', symbol: '₺' },
  { value: 'USD', label: 'Amerikan Doları', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'İngiliz Sterlini', symbol: '£' }
]

export const getCurrencySymbol = (currency: string) => {
  const curr = CURRENCIES.find(c => c.value === currency)
  return curr ? curr.symbol : '₺'
}

export const getUrgencyColor = (level: string) => {
  switch (level) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200'
    case 'high': return 'bg-red-100 text-red-800 border-red-200'
    case 'normal': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'low': return 'bg-green-100 text-green-800 border-green-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'beklemede':
      return 'bg-[#FACC15] text-[#422006] border-[#EAB308]'
    case 'pending':
    case 'onay bekliyor':
    case 'onay_bekliyor':
    case 'departman_onayı_bekliyor':
    case 'it_incelemesinde':
    case 'teklif bekliyor':
    case 'kısmen gönderildi':
    case 'kısmen teslim alındı':
    case 'şantiye şefi onayladı':
    case 'awaiting_offers':
    case 'eksik onaylandı':
      return 'bg-[#FEF08A] text-[#713F12] border-[#FDE047]'
    case 'onaylandı':
    case 'approved':
    case 'it_onaylandi':
    case 'satın almaya gönderildi':
    case 'sipariş verildi':
    case 'ordered':
    case 'gönderildi':
    case 'teslim alındı':
    case 'delivered':
    case 'alternatif onaylandı':
    case 'eksik malzemeler talep edildi':
      return 'bg-[#86EFAC] text-[#052E16] border-[#4ADE80]'
    case 'depoda mevcut değil':
    case 'ana depoda yok':
    case 'iade var':
    case 'iade nedeniyle sipariş':
    case 'reddedildi':
    case 'rejected':
      return 'bg-[#FECACA] text-[#7F1D1D] border-[#FCA5A5]'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}
