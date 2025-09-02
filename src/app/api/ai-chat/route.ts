import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// OpenAI client - lazy initialization to avoid module level errors
let openai: OpenAI | null = null

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

// AI analiz fonksiyonları
interface DashboardData {
  requests: any[]
  requestItems: any[]
  sites: any[]
  suppliers: any[]
  orders: any[]
  offers: any[]
  offerItems: any[]
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, context, conversationHistory = [] } = await request.json()
    
    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Mesaj gereklidir' },
        { status: 400 }
      )
    }

    // Supabase client - working configuration like test
    const supabase = createSupabaseClient(
      'https://yxzmxfwpgsqabtamnfql.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4em14ZndwZ3NxYWJ0YW1uZnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NDcwMTYsImV4cCI6MjA3MTUyMzAxNn0.EJNLyurCnaA5HY8MgyoLs9RiZvzrGk7eclnYLq56rCE'
    )
    
    console.log('🔑 Using Supabase client with service role for AI access')

    // Dashboard verilerini çek
    const dashboardData = await fetchDashboardData(supabase)
    
    // OpenAI ile akıllı yanıt oluştur
    const response = await generateOpenAIResponse(message, dashboardData, conversationHistory)
    
    return NextResponse.json({
      response: response.content,
      type: response.type,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('AI Chat API Error:', error)
    return NextResponse.json(
      { error: 'İç sunucu hatası: ' + error.message },
      { status: 500 }
    )
  }
}

async function fetchDashboardData(supabase: any): Promise<DashboardData> {
  try {
    console.log('🔍 Fetching dashboard data...')
    
    // Test: Raw SQL sorgusu deneyelim
    console.log('🔍 Testing direct connection to Supabase...')
    console.log('🔗 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('🔑 Using key prefix:', (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').substring(0, 20))
    
    // Önce basit bir count sorgusu
    const countResult = await supabase.from('purchase_requests').select('*', { count: 'exact', head: true })
    console.log('📊 Count result:', countResult)
    
    // Sonra data sorgusu - tüm verileri çek
    const requestsDataResult = await supabase.from('purchase_requests').select('*')
    console.log('📊 First 5 requests:', { 
      count: requestsDataResult.data?.length, 
      error: requestsDataResult.error,
      data: requestsDataResult.data?.slice(0, 2) // İlk 2 kaydı göster
    })
    
    // Schema kontrol
    const schemaTest = await supabase.from('purchase_requests').select('id,status,created_at').limit(1)
    console.log('🗂️ Schema test:', schemaTest)
    
    const [sitesResult, suppliersResult, ordersResult, offersResult] = await Promise.all([
      supabase.from('sites').select('*'), 
      supabase.from('suppliers').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('offers').select('*')
    ])

    // Hataları detaylı logla
    console.log('🔍 Query results:')
    console.log('Requests DATA result:', { data: requestsDataResult.data?.length, error: requestsDataResult.error })
    console.log('Sites result:', { data: sitesResult.data?.length, error: sitesResult.error })
    console.log('Suppliers result:', { data: suppliersResult.data?.length, error: suppliersResult.error })
    console.log('Orders result:', { data: ordersResult.data?.length, error: ordersResult.error })
    console.log('Offers result:', { data: offersResult.data?.length, error: offersResult.error })

    console.log('📊 Data counts:', {
      requests: requestsDataResult.data?.length || 0,
      sites: sitesResult.data?.length || 0,
      suppliers: suppliersResult.data?.length || 0,
      orders: ordersResult.data?.length || 0,
      offers: offersResult.data?.length || 0
    })

    // Şimdi detaylı veriyi çekelim - tüm ilişkili tablolarla
    console.log('🔗 Fetching detailed data with relationships...')
    
    const [detailedRequestsResult, requestItemsResult, detailedSitesResult, detailedSuppliersResult, detailedOrdersResult, detailedOffersResult, offerItemsResult] = await Promise.all([
      // Purchase requests with relationships - fixed JOIN, remove location
      supabase.from('purchase_requests').select(`
        *,
        sites(name),
        profiles!purchase_requests_requested_by_fkey(full_name, role)
      `),
      // Purchase request items ayrı çek
      supabase.from('purchase_request_items').select('*'),
      supabase.from('sites').select('*'),
      supabase.from('suppliers').select('*'),
      // Orders with relationships  
      supabase.from('orders').select(`
        *,
        suppliers(name, contact_person),
        purchase_requests(request_number, title)
      `),
      // Offers with relationships
      supabase.from('offers').select('*'),
      // Offer items ayrı çek - tablo adını kontrol et  
      supabase.from('material_items').select('*')
    ])
    
    console.log('📊 Detailed query results:')
    console.log('- Detailed requests:', detailedRequestsResult.data?.length, detailedRequestsResult.error)
    console.log('- Request items:', requestItemsResult.data?.length, requestItemsResult.error)
    console.log('- Detailed offers:', detailedOffersResult.data?.length, detailedOffersResult.error)
    console.log('- Offer items:', offerItemsResult.data?.length, offerItemsResult.error)
    console.log('- Detailed orders:', detailedOrdersResult.data?.length, detailedOrdersResult.error)

    console.log('📋 Detailed data counts:', {
      detailedRequests: detailedRequestsResult.data?.length || 0,
      detailedSites: detailedSitesResult.data?.length || 0,
      detailedSuppliers: detailedSuppliersResult.data?.length || 0,
      detailedOrders: detailedOrdersResult.data?.length || 0,
      detailedOffers: detailedOffersResult.data?.length || 0
    })

    // Hataları logla
    if (detailedRequestsResult.error) console.error('Requests error:', detailedRequestsResult.error)
    if (detailedSitesResult.error) console.error('Sites error:', detailedSitesResult.error)
    if (detailedSuppliersResult.error) console.error('Suppliers error:', detailedSuppliersResult.error)
    if (detailedOrdersResult.error) console.error('Orders error:', detailedOrdersResult.error)
    if (detailedOffersResult.error) console.error('Offers error:', detailedOffersResult.error)

    // Manual olarak request items'ları requests'lere bağla
    const requestsWithItems = (detailedRequestsResult.data || []).map(request => {
      const items = (requestItemsResult.data || []).filter(item => item.purchase_request_id === request.id)
      return {
        ...request,
        purchase_request_items: items
      }
    })
    
    // Offers'ları material items ile bağla (offer_items tablosu material_items olabilir)
    const offersWithItems = (detailedOffersResult.data || []).map(offer => {
      const items = (offerItemsResult.data || []).filter(item => item.offer_id === offer.id)
      return {
        ...offer,
        offer_items: items
      }
    })

    // Eğer detailed requests başarısız olduysa, normal requestsDataResult kullan
    const finalRequests = (detailedRequestsResult.data?.length > 0) ? requestsWithItems : requestsDataResult.data || []
    
    // Return results - tüm detaylı verilerle
    const result = {
      requests: finalRequests,
      requestItems: requestItemsResult.data || [],
      sites: detailedSitesResult.data || [],
      suppliers: detailedSuppliersResult.data || [],
      orders: detailedOrdersResult.data || [],
      offers: offersWithItems,
      offerItems: offerItemsResult.data || []
    }
    
    console.log('📤 Final detailed result counts:', {
      requests: result.requests.length,
      requestItems: result.requestItems.length,
      sites: result.sites.length,
      suppliers: result.suppliers.length,
      orders: result.orders.length,
      offers: result.offers.length,
      offerItems: result.offerItems.length
    })
    
    // Debug: Order-Request ilişkisini kontrol et
    console.log('🔗 Order-Request relationship debug:')
    result.orders.forEach((order, index) => {
      console.log(`Order ${index + 1}:`, {
        orderId: order.id?.substring(0, 8),
        purchaseRequestId: order.purchase_request_id,
        hasRelatedRequest: !!result.requests.find(r => r.id === order.purchase_request_id),
        relatedRequestNumber: result.requests.find(r => r.id === order.purchase_request_id)?.request_number
      })
    })
    
    return result
  } catch (error) {
    console.error('Dashboard data fetch error:', error)
    return {
      requests: [],
      requestItems: [],
      sites: [],
      suppliers: [],
      orders: [],
      offers: [],
      offerItems: []
    }
  }
}

async function generateOpenAIResponse(message: string, data: DashboardData, conversationHistory: ChatMessage[]) {
  try {
    // OpenAI client'ı al
    const aiClient = getOpenAIClient()
    
    // API key yoksa fallback
    if (!aiClient) {
      return {
        content: `🔑 **API Key Eksik**\n\nOpenAI API key bulunamadı veya geçersiz.\n\n**Şu anlık yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen .env.local dosyasında OPENAI_API_KEY'i kontrol edin.*`,
        type: 'error'
      }
    }

    // Dashboard verilerini özetle
    const dataContext = prepareDataContext(data)
    
    // Sistem prompt'u oluştur
    const systemPrompt = `Sen DOVEC AI, gelişmiş bir satın alma sistemi asistanısın. 

KULLANICI PROFİLİ:
- Adı: Burçin Bey (her zaman bu şekilde hitap et)
- Satın alma ve tedarik süreçlerini yönetir

GÖREVLER:
1. Satın alma dashboard verilerini analiz et
2. Türkçe yanıt ver ve her yanıtta "Burçin Bey" diye hitap et
3. Önceki konuşmaları hatırla ve devam ettir
4. Veriye dayalı öneriler sun
5. Emoji kullanarak görsel zenginlik kat

MEVCUT VERİLER:
${dataContext}

YANIT STİLİ:
- Sıcak ve samimi ton, her yanıtta "Burçin Bey" diye hitap et
- Markdown formatında 
- Emoji kullan (📊 📈 💰 🏗️ 🚚 vb.)
- Verilerle destekle
- Eyleme geçirilebilir öneriler ver

ÖNEMLİ: Her yanıtta "Burçin Bey" diye hitap et ve önceki konuşmayı hatırla.`

    // Konuşma geçmişini hazırla
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8), // Son 8 mesajı tut
      { role: 'user', content: message }
    ]

    // OpenAI API çağrısı
    const completion = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini', // Daha hızlı ve ekonomik model
      messages: messages,
      temperature: 0.7,
      max_tokens: 1200,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    })

    const aiResponse = completion.choices[0]?.message?.content || 'Üzgünüm, yanıt oluşturamadım.'
    
    // Yanıt tipini belirle
    const responseType = determineResponseType(aiResponse, message)

    return {
      content: aiResponse,
      type: responseType
    }

  } catch (error) {
    console.error('OpenAI API Error:', error)
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY)
    console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10))
    
    // API key yoksa özel fallback
    if (!process.env.OPENAI_API_KEY) {
      return {
        content: `🔑 **API Key Eksik**\n\nOpenAI API key environment'ta bulunamadı.\n\n**Şu anlık yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen .env.local dosyasında OPENAI_API_KEY'i kontrol edin.*`,
        type: 'error'
      }
    }
    
    if (error.code === 'invalid_api_key' || error.status === 401) {
      return {
        content: `🔑 **Geçersiz API Key**\n\nOpenAI API key geçersiz görünüyor.\n\n**Şu anlık yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen OpenAI API key'inizi kontrol edin.*`,
        type: 'error'
      }
    }
    
    // Diğer hatalar için fallback
    return {
      content: `🤖 **DOVEC AI - Bağlantı Sorunu**\n\n**Hata:** ${error.message}\n\n**Basit yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen birkaç dakika sonra tekrar deneyin.*`,
      type: 'error'
    }
  }
}

// API key olmadığında basit yanıtlar için fallback fonksiyonu
function generateSimpleResponse(message: string, data: DashboardData): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('bugün') && lowerMessage.includes('talep')) {
    const today = new Date().toISOString().split('T')[0]
    const todayRequests = data.requests.filter(r => r.created_at?.startsWith(today))
    return `📊 Bugün ${todayRequests.length} yeni talep geldi.`
  }
  
  if (lowerMessage.includes('toplam')) {
    return `📈 Toplam ${data.requests.length} talep, ${data.sites.length} şantiye, ${data.suppliers.length} tedarikçi bulunuyor.`
  }
  
  if (lowerMessage.includes('şantiye')) {
    const activeSites = data.sites.filter(s => s.is_active)
    return `🏗️ ${activeSites.length} aktif şantiye bulunuyor.`
  }
  
  return `Anlayamadım. Lütfen daha spesifik bir soru sorun.`
}

function prepareDataContext(data: DashboardData): string {
  console.log('🔍 Preparing data context with:', {
    requests: data.requests?.length || 0,
    requestItems: data.requestItems?.length || 0,
    sites: data.sites?.length || 0,
    suppliers: data.suppliers?.length || 0,
    orders: data.orders?.length || 0,
    offers: data.offers?.length || 0,
    offerItems: data.offerItems?.length || 0
  })

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  // Raw data log
  console.log('📊 Sample request data:', data.requests?.slice(0, 2))
  console.log('🏗️ Sample site data:', data.sites?.slice(0, 2))
  console.log('🔢 Data lengths in context:', {
    requests: data.requests?.length,
    requestItems: data.requestItems?.length,
    orders: data.orders?.length,
    offers: data.offers?.length
  })

  // Bugünkü veriler
  const todayRequests = data.requests?.filter(r => r.created_at?.startsWith(today)) || []
  const todayOrders = data.orders?.filter(o => o.created_at?.startsWith(today)) || []

  // Bu ayki veriler
  const monthRequests = data.requests?.filter(r => {
    const date = new Date(r.created_at)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  }) || []

  // Tüm siteler
  const allSites = data.sites || []
  
  // Tüm talepler
  const allRequests = data.requests || []
  
  // En aktif siteler
  const topSites = allSites
    .map(site => ({
      name: site.name,
      location: site.location,
      requestCount: allRequests.filter(r => r.site_id === site.id).length
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 5)

  // Son taleplerin detayları
  const recentRequests = allRequests
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 10)
    .map(req => {
      const materials = req.purchase_request_items?.map(item => 
        `${item.material_name} (${item.quantity} ${item.unit})`
      ).join(', ') || 'Malzeme bilgisi yok'
      
      return {
        id: req.id,
        site: req.sites?.name || allSites.find(s => s.id === req.site_id)?.name || 'Bilinmeyen şantiye',
        requestor: req.profiles?.full_name || 'Bilinmeyen',
        status: req.status,
        amount: req.total_amount,
        materials: materials,
        urgency: req.urgency_level,
        description: req.description,
        created: req.created_at
      }
    })

  // Bekleyen talepler detayı
  const pendingRequests = allRequests
    .filter(r => r.status === 'pending')
    .map(req => {
      const daysSince = Math.floor((new Date().getTime() - new Date(req.created_at || '').getTime()) / (1000 * 60 * 60 * 24))
      const materials = req.purchase_request_items?.map(item => 
        `${item.material_name} (${item.quantity} ${item.unit})`
      ).join(', ') || 'Malzeme bilgisi yok'
      
      return {
        id: req.id,
        site: req.sites?.name || allSites.find(s => s.id === req.site_id)?.name || 'Bilinmeyen',
        materials: materials,
        amount: req.total_amount,
        daysSince: daysSince,
        urgency: req.urgency_level
      }
    })

  // Tedarikçi listesi
  const supplierList = (data.suppliers || [])
    .filter(s => s.is_approved)
    .slice(0, 5)
    .map(s => `${s.name} (${s.total_orders || 0} sipariş)`)
    .join(', ')

  // Siparişler detayı - purchase request items ile eşleştir
  const orderDetails = (data.orders || [])
    .slice(0, 5)
    .map(order => {
      const supplier = data.suppliers?.find(s => s.id === order.supplier_id)
      const relatedRequest = data.requests?.find(r => r.id === order.purchase_request_id)
      const orderItems = (data.requestItems || []).filter(item => item.purchase_request_id === order.purchase_request_id)
      
      const itemsText = orderItems.length > 0 
        ? orderItems.map(item => `${item.item_name || item.material_name || 'Bilinmeyen malzeme'} (${item.quantity || 0} ${item.unit || 'adet'}) - ₺${parseFloat(item.price || item.unit_price || 0).toLocaleString('tr-TR')}`).join(', ')
        : 'Ürün detayı yok'
      
      return `${supplier?.name || 'Bilinmeyen tedarikçi'}: ${itemsText} | ₺${parseFloat(order.amount || 0).toLocaleString('tr-TR')} | ${order.status} | ${order.created_at?.split('T')[0]} | Talep: ${relatedRequest?.request_number || 'Bilinmeyen'}`
    })

  // Teklif detayları
  const offerDetails = (data.offers || [])
    .slice(0, 5)
    .map(offer => {
      const offerItems = offer.offer_items?.map(item => 
        `${item.material_name} (${item.quantity} adet - ₺${parseFloat(item.unit_price || 0).toLocaleString('tr-TR')})`
      ).join(', ') || 'Kalem bilgisi yok'
      
      return `${offer.supplier_name}: ${offerItems} | Toplam: ₺${parseFloat(offer.total_price || 0).toLocaleString('tr-TR')} | ${offer.delivery_days} gün teslimat`
    })

  return `
VERİTABANI DURUM RAPORU:
========================

RAW DATA SAYILARI:
- Talepler: ${allRequests.length}
- Talep Kalemleri: ${data.requestItems?.length || 0}
- Şantiyeler: ${allSites.length}  
- Tedarikçiler: ${data.suppliers?.length || 0}
- Siparişler: ${data.orders?.length || 0}
- Teklifler: ${data.offers?.length || 0}
- Teklif Kalemleri: ${data.offerItems?.length || 0}

BUGÜNKÜ DURUM:
- ${todayRequests.length} yeni talep
- ${todayOrders.length} yeni sipariş  
- Toplam aktif site: ${allSites.filter(s => s.is_active).length}

BU AY TOPLAM:
- ${monthRequests.length} talep
- ${data.orders?.length || 0} sipariş
- Bekleyen onay: ${allRequests.filter(r => r.status === 'pending').length}

TÜM ŞANTİYELER:
${allSites.map(site => `- ${site.name} (${site.location || 'Konum belirtilmemiş'})`).join('\n') || 'Şantiye bulunamadı'}

SON TALEPLER (DETAYLI):
${recentRequests.slice(0, 8).map(req => {
  const requestItems = (data.requestItems || []).filter(item => item.purchase_request_id === req.id)
  const itemsText = requestItems.length > 0 
    ? requestItems.map(item => `${item.item_name || item.material_name || 'Bilinmeyen malzeme'} (${item.quantity || 0} ${item.unit || 'adet'})`).join(', ')
    : req.materials || 'Malzeme bilgisi yok'
  
  return `- ${req.site}: ${itemsText} | ₺${parseFloat(req.amount || 0).toLocaleString('tr-TR')} | ${req.status} | ${req.urgency || 'normal'} | ${req.created?.split('T')[0]}`
}).join('\n') || 'Talep bulunamadı'}

BEKLEYEN TALEPLER:
${pendingRequests.slice(0, 5).map(req => {
  const requestItems = (data.requestItems || []).filter(item => item.purchase_request_id === req.id)
  const itemsText = requestItems.length > 0 
    ? requestItems.map(item => `${item.item_name || item.material_name || 'Bilinmeyen malzeme'} (${item.quantity || 0} ${item.unit || 'adet'})`).join(', ')
    : req.materials || 'Malzeme bilgisi yok'
  
  return `- ${req.site}: ${itemsText} | ₺${parseFloat(req.amount || 0).toLocaleString('tr-TR')} | ${req.daysSince} gün önce | ${req.urgency || 'normal'}`
}).join('\n') || 'Bekleyen talep yok'}

SON SİPARİŞLER:
${orderDetails.join('\n') || 'Sipariş bulunamadı'}

AKTİF TEKLİFLER:
${offerDetails.join('\n') || 'Teklif bulunamadı'}

ONAYLANMIŞ TEDARİKÇİLER:
${supplierList || 'Tedarikçi bulunamadı'}

ACIL DURUMLAR:
- Kritik talepler: ${allRequests.filter(r => r.urgency_level === 'critical').length}
- 7+ gün bekleyen: ${allRequests.filter(r => {
    const daysDiff = Math.floor((new Date().getTime() - new Date(r.created_at || '').getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff > 7 && r.status === 'pending'
  }).length}

TALEP KALEMI DETAYLARI:
${(data.requestItems || []).slice(0, 15).map(item => {
  const request = data.requests?.find(r => r.id === item.purchase_request_id)
  const siteName = request?.site_name || request?.sites?.name || 'Bilinmeyen şantiye'
  return `- ${item.item_name || item.material_name || 'Malzeme belirtilmemiş'} (${item.quantity || 0} ${item.unit || 'adet'}) - ${siteName} - ${request?.status || 'durum belirsiz'}`
}).join('\n') || 'Talep kalemi bulunamadı'}

TOPLAM TALEP KALEMI SAYISI: ${data.requestItems?.length || 0}

SİPARİŞ ÜRÜN DETAYLARI:
${(data.orders || []).map(order => {
  const supplier = data.suppliers?.find(s => s.id === order.supplier_id)
  const relatedRequest = data.requests?.find(r => r.id === order.purchase_request_id)
  const orderItems = (data.requestItems || []).filter(item => item.purchase_request_id === order.purchase_request_id)
  
  const itemsText = orderItems.length > 0 
    ? orderItems.map(item => 
        `  • ${item.item_name || item.material_name || 'Bilinmeyen malzeme'} (${item.quantity || 0} ${item.unit || 'adet'}) - ₺${parseFloat(item.price || item.unit_price || 0).toLocaleString('tr-TR')}`
      ).join('\n')
    : '  • Ürün detayı yok'
  
  return `- SİPARİŞ ${order.id?.substring(0,8)}... | ${supplier?.name || 'Bilinmeyen tedarikçi'} | ${order.status} | ₺${parseFloat(order.amount || 0).toLocaleString('tr-TR')}
${itemsText}
  Talep No: ${relatedRequest?.request_number || 'Bilinmeyen'} | Şantiye: ${relatedRequest?.site_name || 'Bilinmeyen'}`
}).join('\n\n') || 'Sipariş bulunamadı'}

TEKLİF KALEMI DETAYLARI (ÖRNEKLER):
${(data.offerItems || []).slice(0, 10).map(item => 
  `- ${item.material_name || 'Malzeme belirtilmemiş'} (${item.quantity || 0} adet) - ₺${parseFloat(item.unit_price || 0).toLocaleString('tr-TR')}`
).join('\n') || 'Teklif kalemi bulunamadı'}
`
}

function determineResponseType(aiResponse: string, userMessage: string): string {
  const lowerResponse = aiResponse.toLowerCase()
  const lowerMessage = userMessage.toLowerCase()

  if (lowerResponse.includes('öneri') || lowerResponse.includes('iyileştir') || lowerResponse.includes('tavsiye')) {
    return 'suggestion'
  }
  
  if (lowerResponse.includes('₺') || lowerResponse.includes('talep') || lowerResponse.includes('sipariş') || 
      lowerMessage.includes('kaç') || lowerMessage.includes('toplam') || lowerMessage.includes('ne kadar')) {
    return 'data'
  }

  return 'normal'
}