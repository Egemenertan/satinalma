export interface MaterialCategory {
  id: string
  name: string
  type: string
  icon?: string
}

export interface MaterialGroup {
  id: string
  name: string
  icon?: string
}

export interface MaterialItem {
  id: string
  name: string
  description?: string
  class?: string
  group?: string
}

export interface CartItem {
  id: string
  material_class: string
  material_group: string
  material_item_name: string
  material_name: string
  material_description: string
  unit: string
  quantity: string
  brand: string
  specifications: string
  purpose: string
  delivery_date: string
  image_urls: string[]
  uploaded_images: File[]
  image_preview_urls: string[]
  product_id?: string
}

export interface Site {
  id: string
  name: string
  image_url?: string
}

export interface ModalState {
  type: 'detail' | 'cart' | 'site' | null
  item?: MaterialItem | CartItem | null
  editIndex?: number
}

export interface CategoryTabsProps {
  categories: MaterialCategory[]
  selectedCategory: string
  onCategorySelect: (category: string) => void
  subCategories: MaterialGroup[]
  selectedSubCategory: string
  onSubCategorySelect: (subCategory: string) => void
  isLoading?: boolean
}

export interface MaterialCardProps {
  item: MaterialItem
  isInCart: boolean
  onClick: () => void
}

export interface MaterialDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MaterialItem | null
  materialClass: string
  materialGroup: string
  onAddToCart: (cartItem: CartItem) => void
  editItem?: CartItem | null
  onUpdateItem?: (cartItem: CartItem) => void
}

export interface CartBottomBarProps {
  itemCount: number
  onViewCart: () => void
  onCheckout: () => void
  isVisible: boolean
}

export interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  onRemoveItem: (id: string) => void
  onEditItem: (item: CartItem, index: number) => void
  onCheckout: () => void
}

export interface RequestSummaryProps {
  items: CartItem[]
  site: Site | null
  siteName: string
  onBack: () => void
  onSubmit: () => void
  onRemoveItem: (id: string) => void
  onEditItem: (item: CartItem, index: number) => void
  isLoading: boolean
}

export type PageStep = 'site-selection' | 'shopping'

export const ICON_MAP: Record<string, string> = {
  'İş Araçları': 'Wrench',
  'İnce İşler (Mimari) Malzemeleri': 'Ruler',
  'Mimari Malzemeler': 'Ruler',
  'Kaba İnşaat Malzemeleri': 'Truck',
  'Kaba İnşaat': 'Truck',
  'Mobilizasyon & Demobilizasyon': 'Package2',
  'Mobilyasyon': 'Package2',
  'Mekanik Malzemeleri': 'Settings',
  'Mekanik': 'Settings',
  'Mekanik Malzemeler': 'Settings',
  'Elektrik Malzemeleri': 'Zap',
  'Elektrik': 'Zap',
  'Temizlik Malzemeleri': 'Sparkles',
  'Temizlik': 'Sparkles',
  'İş Sağlığı ve Güvenliği': 'Shield',
  'İş Güvenliği': 'Shield',
  'Diğer Malzemeler': 'Package',
  'Boyalar': 'Palette',
  'Reklam Ürünleri': 'Sparkles',
  'Kırtasiye Malzemeleri': 'FileText',
  'Ofis Ekipmanları': 'Settings',
  'Promosyon Ürünleri': 'Target',
  'Mutfak Malzemeleri': 'Package2',
  'Hijyen ve Temizlik': 'Sparkles'
}

export const COLOR_MAP: Record<string, string> = {
  'İş Araçları': '#f59e0b',
  'İnce İşler (Mimari) Malzemeleri': '#8b5cf6',
  'Mimari Malzemeler': '#8b5cf6',
  'Kaba İnşaat Malzemeleri': '#ef4444',
  'Kaba İnşaat': '#ef4444',
  'Mobilizasyon & Demobilizasyon': '#06b6d4',
  'Mobilyasyon': '#06b6d4',
  'Mekanik Malzemeleri': '#10b981',
  'Mekanik': '#10b981',
  'Mekanik Malzemeler': '#10b981',
  'Elektrik Malzemeleri': '#f59e0b',
  'Elektrik': '#f59e0b',
  'Temizlik Malzemeleri': '#ec4899',
  'Temizlik': '#ec4899',
  'İş Sağlığı ve Güvenliği': '#6366f1',
  'İş Güvenliği': '#6366f1',
  'Diğer Malzemeler': '#64748b',
  'Boyalar': '#84cc16',
  'Reklam Ürünleri': '#ec4899',
  'Kırtasiye Malzemeleri': '#6366f1',
  'Ofis Ekipmanları': '#10b981',
  'Promosyon Ürünleri': '#f59e0b',
  'Mutfak Malzemeleri': '#06b6d4',
  'Hijyen ve Temizlik': '#8b5cf6'
}

export const CATEGORY_IMAGES: Record<string, string> = {
  'Kırtasiye Malzemeleri': 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80',
  'Reklam Ürünleri': 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&q=80',
  'Ofis Ekipmanları': 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=800&q=80',
  'Promosyon Ürünleri': 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&q=80',
  'Mutfak Malzemeleri': 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80',
  'Hijyen ve Temizlik': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&q=80'
}

export const GROUP_IMAGES: Record<string, string> = {
  'Defter ve Ajandalar': 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&q=80',
  'Kalemler': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80',
  'Zarflar': 'https://images.unsplash.com/photo-1526554850534-7c78330d5f90?w=800&q=80',
  'Genel Kırtasiye': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800&q=80',
  'Kağıt ve Bloklar': 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&q=80',
  'Dosyalama ve Arşivleme': 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&q=80',
  'Yazı ve İşaretleme': 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80',
  'Ofis Araçları': 'https://images.unsplash.com/photo-1625134683123-52e57c251b04?w=800&q=80',
  'Bilgisayar Aksesuarları': 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
  'Bilgisayar Donanımları': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80',
  'Ofis Mobilyaları': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80',
  'Elektronik Cihazlar': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800&q=80',
  'Kurumsal Hediyeler': 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=800&q=80',
  'Ofis Hediyeleri': 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80',
  'İçecek Malzemeleri': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  'Mutfak Temizliği': 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80',
  'Mutfak Eşyaları': 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80',
  'Kişisel Hijyen': 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80',
  'Genel Temizlik': 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&q=80'
}

export function getIconForClass(className: string): string {
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (className.toLowerCase().includes(key.toLowerCase())) {
      return icon
    }
  }
  return 'Package'
}

export function getColorForClass(className: string): string {
  for (const [key, color] of Object.entries(COLOR_MAP)) {
    if (className.toLowerCase().includes(key.toLowerCase())) {
      return color
    }
  }
  return '#6b7280'
}

export function createEmptyCartItem(
  item: MaterialItem,
  materialClass: string,
  materialGroup: string
): CartItem {
  return {
    id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    material_class: materialClass,
    material_group: materialGroup,
    material_item_name: item.name,
    material_name: item.name,
    material_description: item.description || '',
    unit: '',
    quantity: '',
    brand: '',
    specifications: '',
    purpose: '',
    delivery_date: '',
    image_urls: [],
    uploaded_images: [],
    image_preview_urls: []
  }
}
