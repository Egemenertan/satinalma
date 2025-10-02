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
  purpose?: string  // Her malzeme için ayrı kullanım amacı
  delivery_date?: string  // Her malzeme için ayrı teslimat tarihi
  original_quantity?: number  // İlk talep edilen miktar - hiç değişmez
  image_urls?: string[]  // Malzeme görselleri
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
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'normal': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'low': return 'bg-gray-100 text-gray-700 border-gray-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'şantiye şefi onayladı': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'awaiting_offers': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'approved': return 'bg-green-100 text-green-700 border-green-200'
    case 'sipariş verildi': return 'bg-green-100 text-green-700 border-green-200'
    case 'gönderildi': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'kısmen gönderildi': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'depoda mevcut değil': return 'bg-red-100 text-red-700 border-red-200'
    case 'eksik onaylandı': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'alternatif onaylandı': return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'satın almaya gönderildi': return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'eksik malzemeler talep edildi': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}
