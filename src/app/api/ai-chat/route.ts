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

// AI analiz fonksiyonları - Expanded interface
interface DashboardData {
  requests: any[]
  requestItems: any[]
  sites: any[]
  suppliers: any[]
  orders: any[]
  offers: any[]
  offerItems: any[]
  profiles: any[]
  materialCategories: any[]
  materialSubcategories: any[]
  materialItems: any[]
  supplierMaterials: any[]
  approvalHistory: any[]
  attachments: any[]
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

    // Supabase client - use service role for AI full database access
    // Service role key bypasses RLS and has full access
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    console.log('🔑 Using Supabase client with service role for AI access')

    // Dashboard verilerini çek
    const dashboardData = await fetchDashboardData(supabase)
    
    // Debug: Veri sayılarını logla
    console.log('📊 AI Dashboard Data Summary:', {
      requests: dashboardData.requests?.length || 0,
      sites: dashboardData.sites?.length || 0,
      suppliers: dashboardData.suppliers?.length || 0,
      orders: dashboardData.orders?.length || 0,
      offers: dashboardData.offers?.length || 0
    })
    
    // OpenAI ile akıllı yanıt oluştur - streaming response döner
    return await generateOpenAIResponse(message, dashboardData, conversationHistory)

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
    console.log('🔍 Fetching comprehensive dashboard data with all relationships...')
    
    // İlk olarak tüm ana tabloları ve ilişkileri paralel çek
    const [
      // Ana tablolar
      requestsResult,
      requestItemsResult, 
      sitesResult,
      suppliersResult,
      ordersResult,
      offersResult,
      profilesResult,
      materialCategoriesResult,
      materialSubcategoriesResult,
      materialItemsResult,
      supplierMaterialsResult,
      approvalHistoryResult,
      attachmentsResult
    ] = await Promise.all([
      // Purchase requests - tam ilişkilerle
      supabase.from('purchase_requests').select(`
        *,
        sites(id, name, approved_expenses, total_budget),
        profiles!purchase_requests_requested_by_fkey(id, full_name, role, email),
        profiles!purchase_requests_approved_by_fkey(id, full_name, role, email)
      `),
      
      // Purchase request items - malzeme detaylarıyla
      supabase.from('purchase_request_items').select(`
        *,
        material_items(id, name, description, unit)
      `),
      
      // Sites - basit
      supabase.from('sites').select('*'),
      
      // Suppliers - malzeme ilişkileriyle
      supabase.from('suppliers').select('*'),
      
      // Orders - tam ilişkilerle
      supabase.from('orders').select(`
        *,
        suppliers(id, name, contact_person, email, phone),
        purchase_requests(id, request_number, title, site_id, total_amount)
      `),
      
      // Offers - tedarikçi bilgileriyle
      supabase.from('offers').select(`
        *,
        suppliers(id, name, contact_person, email),
        purchase_requests(id, request_number, title, site_id),
        sites(id, name)
      `),
      
      // Profiles - kullanıcı bilgileri
      supabase.from('profiles').select('*'),
      
      // Material categories
      supabase.from('material_categories').select('*'),
      
      // Material subcategories - kategorilerle
      supabase.from('material_subcategories').select(`
        *,
        material_categories(id, name, description)
      `),
      
      // Material items - tam hiyerarşiyle
      supabase.from('material_items').select(`
        *,
        material_subcategories(
          id, name, 
          material_categories(id, name)
        )
      `),
      
      // Supplier materials - tüm ilişkilerle
      supabase.from('supplier_materials').select(`
        *,
        suppliers(id, name, contact_person),
        material_categories(id, name),
        material_subcategories(id, name),
        material_items(id, name, unit)
      `),
      
      // Approval history - kullanıcı bilgileriyle
      supabase.from('approval_history').select(`
        *,
        purchase_requests(id, request_number, title),
        profiles(id, full_name, role)
      `),
      
      // Attachments - dosya bilgileri
      supabase.from('attachments').select(`
        *,
        purchase_requests(id, request_number),
        purchase_request_items(id, item_name),
        profiles(id, full_name)
      `)
    ])

    // Sonuçları logla
    console.log('📊 Comprehensive data fetch results:')
    console.log('- Purchase Requests:', requestsResult.data?.length, requestsResult.error?.message || 'OK')
    console.log('- Request Items:', requestItemsResult.data?.length, requestItemsResult.error?.message || 'OK')
    console.log('- Sites:', sitesResult.data?.length, sitesResult.error?.message || 'OK')
    console.log('- Suppliers:', suppliersResult.data?.length, suppliersResult.error?.message || 'OK')
    console.log('- Orders:', ordersResult.data?.length, ordersResult.error?.message || 'OK')
    console.log('- Offers:', offersResult.data?.length, offersResult.error?.message || 'OK')
    console.log('- Profiles:', profilesResult.data?.length, profilesResult.error?.message || 'OK')
    console.log('- Material Categories:', materialCategoriesResult.data?.length, materialCategoriesResult.error?.message || 'OK')
    console.log('- Material Subcategories:', materialSubcategoriesResult.data?.length, materialSubcategoriesResult.error?.message || 'OK')
    console.log('- Material Items:', materialItemsResult.data?.length, materialItemsResult.error?.message || 'OK')
    console.log('- Supplier Materials:', supplierMaterialsResult.data?.length, supplierMaterialsResult.error?.message || 'OK')
    console.log('- Approval History:', approvalHistoryResult.data?.length, approvalHistoryResult.error?.message || 'OK')
    console.log('- Attachments:', attachmentsResult.data?.length, attachmentsResult.error?.message || 'OK')
    
    // Manual olarak ilişkileri zenginleştir
    const requestsWithItems = (requestsResult.data || []).map(request => {
      const items = (requestItemsResult.data || []).filter(item => item.purchase_request_id === request.id)
      const approvals = (approvalHistoryResult.data || []).filter(approval => approval.purchase_request_id === request.id)
      const attachments = (attachmentsResult.data || []).filter(att => att.purchase_request_id === request.id)
      
      return {
        ...request,
        purchase_request_items: items,
        approval_history: approvals,
        attachments: attachments
      }
    })
    
    // Offers'ları ilişkilerle zenginleştir  
    const enrichedOffers = (offersResult.data || []).map(offer => {
      const relatedRequest = requestsResult.data?.find(req => req.id === offer.purchase_request_id)
      return {
        ...offer,
        related_request: relatedRequest
      }
    })

    // Orders'ları ilişkilerle zenginleştir
    const enrichedOrders = (ordersResult.data || []).map(order => {
      const relatedRequest = requestsResult.data?.find(req => req.id === order.purchase_request_id)
      const relatedOffers = offersResult.data?.filter(offer => offer.purchase_request_id === order.purchase_request_id)
      
      return {
        ...order,
        related_request: relatedRequest,
        related_offers: relatedOffers
      }
    })

    // Suppliers'ları malzeme bilgileriyle zenginleştir
    const enrichedSuppliers = (suppliersResult.data || []).map(supplier => {
      const materials = (supplierMaterialsResult.data || []).filter(sm => sm.supplier_id === supplier.id)
      const supplierOrders = ordersResult.data?.filter(order => order.supplier_id === supplier.id) || []
      const supplierOffers = offersResult.data?.filter(offer => offer.supplier_id === supplier.id) || []
      
      return {
        ...supplier,
        materials: materials,
        orders: supplierOrders,
        offers: supplierOffers
      }
    })
    
    // Sites'ları tam bilgilerle zenginleştir
    const enrichedSites = (sitesResult.data || []).map(site => {
      const siteRequests = requestsResult.data?.filter(req => req.site_id === site.id) || []
      const siteOffers = offersResult.data?.filter(offer => offer.site_id === site.id) || []
      
      return {
        ...site,
        requests: siteRequests,
        offers: siteOffers
      }
    })
    
    // Return comprehensive results
    const result = {
      requests: requestsWithItems,
      requestItems: requestItemsResult.data || [],
      sites: enrichedSites,
      suppliers: enrichedSuppliers,
      orders: enrichedOrders,
      offers: enrichedOffers,
      offerItems: materialItemsResult.data || [], // Material items as offer items
      profiles: profilesResult.data || [],
      materialCategories: materialCategoriesResult.data || [],
      materialSubcategories: materialSubcategoriesResult.data || [],
      materialItems: materialItemsResult.data || [],
      supplierMaterials: supplierMaterialsResult.data || [],
      approvalHistory: approvalHistoryResult.data || [],
      attachments: attachmentsResult.data || []
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
      offerItems: [],
      profiles: [],
      materialCategories: [],
      materialSubcategories: [],
      materialItems: [],
      supplierMaterials: [],
      approvalHistory: [],
      attachments: []
    }
  }
}

async function generateOpenAIResponse(message: string, data: DashboardData, conversationHistory: ChatMessage[]) {
  try {
    // OpenAI client'ı al
    const aiClient = getOpenAIClient()
    
    // API key yoksa fallback - streaming response
    if (!aiClient) {
      const fallbackResponse = `🔑 **API Key Eksik**\n\nOpenAI API key bulunamadı veya geçersiz.\n\n**Şu anlık yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen .env.local dosyasında OPENAI_API_KEY'i kontrol edin.*`
      
      const encoder = new TextEncoder()
      const readableStream = new ReadableStream({
        start(controller) {
          const data = JSON.stringify({ 
            content: fallbackResponse, 
            type: 'error',
            done: true 
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          controller.close()
        }
      })
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
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
- Verilerle destekle
- Eyleme geçirilebilir öneriler ver

ÖNEMLİ: Her yanıtta "Burçin Bey" diye hitap et ve önceki konuşmayı hatırla.`

    // Konuşma geçmişini hazırla
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8), // Son 8 mesajı tut
      { role: 'user', content: message }
    ]

    // OpenAI API çağrısı - streaming ile
    const completion = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini', // Daha hızlı ve ekonomik model
      messages: messages,
      temperature: 0.7,
      max_tokens: 1200,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      stream: true // Streaming aktif
    })

    // Streaming response oluştur
    const encoder = new TextEncoder()
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = ''
          
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullResponse += content
              
              // Her chunk'ı JSON olarak gönder
              const data = JSON.stringify({ 
                content, 
                type: 'streaming',
                done: false 
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          
          // Son mesajı gönder
          const responseType = determineResponseType(fullResponse, message)
          const finalData = JSON.stringify({ 
            content: '', 
            type: responseType,
            done: true,
            fullResponse 
          })
          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
          
        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = JSON.stringify({ 
            error: error.message,
            type: 'error',
            done: true 
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('OpenAI API Error:', error)
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY)
    console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10))
    
    // Error handling için streaming response
    const encoder = new TextEncoder()
    let errorMessage = ''
    
    // API key yoksa özel fallback
    if (!process.env.OPENAI_API_KEY) {
      errorMessage = `🔑 **API Key Eksik**\n\nOpenAI API key environment'ta bulunamadı.\n\n**Şu anlık yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen .env.local dosyasında OPENAI_API_KEY'i kontrol edin.*`
    } else if (error.code === 'invalid_api_key' || error.status === 401) {
      errorMessage = `🔑 **Geçersiz API Key**\n\nOpenAI API key geçersiz görünüyor.\n\n**Şu anlık yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen OpenAI API key'inizi kontrol edin.*`
    } else {
      errorMessage = `🤖 **DOVEC AI - Bağlantı Sorunu**\n\n**Hata:** ${error.message}\n\n**Basit yanıt:** ${generateSimpleResponse(message, data)}\n\n*Lütfen birkaç dakika sonra tekrar deneyin.*`
    }
    
    const readableStream = new ReadableStream({
      start(controller) {
        const data = JSON.stringify({ 
          content: errorMessage, 
          type: 'error',
          done: true 
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        controller.close()
      }
    })
    
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
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
  console.log('🔍 Preparing comprehensive data context with:', {
    requests: data.requests?.length || 0,
    requestItems: data.requestItems?.length || 0,
    sites: data.sites?.length || 0,
    suppliers: data.suppliers?.length || 0,
    orders: data.orders?.length || 0,
    offers: data.offers?.length || 0,
    offerItems: data.offerItems?.length || 0,
    profiles: data.profiles?.length || 0,
    materialCategories: data.materialCategories?.length || 0,
    materialSubcategories: data.materialSubcategories?.length || 0,
    materialItems: data.materialItems?.length || 0,
    supplierMaterials: data.supplierMaterials?.length || 0,
    approvalHistory: data.approvalHistory?.length || 0,
    attachments: data.attachments?.length || 0
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

  // Son taleplerin detayları - Site bilgisini doğru çek
  const recentRequests = allRequests
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 10)
    .map(req => {
      const materials = req.purchase_request_items?.map(item => 
        `${item.item_name || item.material_name || 'Malzeme'} (${item.quantity} ${item.unit})`
      ).join(', ') || 'Malzeme bilgisi yok'
      
      // Site bilgisini üç yöntemle bul
      let siteName = 'Bilinmeyen şantiye'
      if (req.sites?.name) {
        siteName = req.sites.name
      } else if (req.site_name) {
        siteName = req.site_name  
      } else if (req.site_id) {
        const foundSite = allSites.find(s => s.id === req.site_id)
        if (foundSite) {
          siteName = foundSite.name
        }
      }
      
      return {
        id: req.id,
        requestNumber: req.request_number,
        site: siteName,
        siteId: req.site_id,
        requestor: req.profiles?.full_name || req.requested_by || 'Bilinmeyen',
        status: req.status,
        amount: req.total_amount,
        materials: materials,
        urgency: req.urgency_level,
        description: req.description,
        created: req.created_at
      }
    })

  // Bekleyen talepler detayı - Site bilgisini doğru çek
  const pendingRequests = allRequests
    .filter(r => r.status === 'pending')
    .map(req => {
      const daysSince = Math.floor((new Date().getTime() - new Date(req.created_at || '').getTime()) / (1000 * 60 * 60 * 24))
      const materials = req.purchase_request_items?.map(item => 
        `${item.item_name || item.material_name || 'Malzeme'} (${item.quantity} ${item.unit})`
      ).join(', ') || 'Malzeme bilgisi yok'
      
      // Site bilgisini üç yöntemle bul
      let siteName = 'Bilinmeyen şantiye'
      if (req.sites?.name) {
        siteName = req.sites.name
      } else if (req.site_name) {
        siteName = req.site_name  
      } else if (req.site_id) {
        const foundSite = allSites.find(s => s.id === req.site_id)
        if (foundSite) {
          siteName = foundSite.name
        }
      }
      
      return {
        id: req.id,
        requestNumber: req.request_number,
        site: siteName,
        siteId: req.site_id,
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
TAM VERİTABANI RAPORU - TÜM İLİŞKİLER DAHİL:
============================================

TABLO İLİŞKİ HARİTASI:
- purchase_requests.site_id → sites.id (şantiye bilgisi)
- purchase_requests.requested_by → profiles.id (talep eden kişi)
- purchase_requests.approved_by → profiles.id (onaylayan kişi)
- purchase_request_items.purchase_request_id → purchase_requests.id (talep kalemleri)
- orders.purchase_request_id → purchase_requests.id (sipariş-talep ilişkisi)
- orders.supplier_id → suppliers.id (tedarikçi bilgisi)
- offers.purchase_request_id → purchase_requests.id (teklif-talep ilişkisi)
- offers.supplier_id → suppliers.id (teklif veren tedarikçi)
- offers.site_id → sites.id (teklif şantiyesi)

TOPLAM VERİ SAYILARI:
- Talepler: ${allRequests.length}
- Talep Kalemleri: ${data.requestItems?.length || 0}
- Şantiyeler: ${allSites.length}  
- Tedarikçiler: ${data.suppliers?.length || 0}
- Siparişler: ${data.orders?.length || 0}
- Teklifler: ${data.offers?.length || 0}
- Kullanıcılar: ${data.profiles?.length || 0}
- Malzeme Kategorileri: ${data.materialCategories?.length || 0}
- Malzeme Alt Kategorileri: ${data.materialSubcategories?.length || 0}
- Malzeme Öğeleri: ${data.materialItems?.length || 0}
- Tedarikçi-Malzeme İlişkileri: ${data.supplierMaterials?.length || 0}
- Onay Geçmişi: ${data.approvalHistory?.length || 0}
- Ekli Dosyalar: ${data.attachments?.length || 0}

BUGÜNKÜ DURUM:
- ${todayRequests.length} yeni talep
- ${todayOrders.length} yeni sipariş  
- Toplam aktif site: ${allSites.filter(s => s.is_active).length}

BU AY TOPLAM:
- ${monthRequests.length} talep
- ${data.orders?.length || 0} sipariş
- Bekleyen onay: ${allRequests.filter(r => r.status === 'pending').length}

TÜM ŞANTİYELER (ID ve İsim):
${allSites.map(site => `- ID: ${site.id} | ${site.name} | Lokasyon: ${site.location || 'Belirtilmemiş'} | Bütçe: ₺${parseFloat(site.total_budget || 0).toLocaleString('tr-TR')}`).join('\n') || 'Şantiye bulunamadı'}

ÖNEMLİ NOT: Purchase requests tablosundaki site_id değeri, yukarıdaki şantiye ID'leriyle eşleşir!

SON TALEPLER (DETAYLI):
${recentRequests.slice(0, 8).map(req => {
  const requestItems = (data.requestItems || []).filter(item => item.purchase_request_id === req.id)
  const itemsText = requestItems.length > 0 
    ? requestItems.map(item => `${item.item_name || item.material_name || 'Bilinmeyen malzeme'} (${item.quantity || 0} ${item.unit || 'adet'})`).join(', ')
    : req.materials || 'Malzeme bilgisi yok'
  
  return `- ${req.requestNumber} | ${req.site} (ID: ${req.siteId}) | ${itemsText} | ₺${parseFloat(req.amount || 0).toLocaleString('tr-TR')} | ${req.status} | ${req.urgency || 'normal'} | ${req.created?.split('T')[0]}`
}).join('\n') || 'Talep bulunamadı'}

BEKLEYEN TALEPLER:
${pendingRequests.slice(0, 5).map(req => {
  const requestItems = (data.requestItems || []).filter(item => item.purchase_request_id === req.id)
  const itemsText = requestItems.length > 0 
    ? requestItems.map(item => `${item.item_name || item.material_name || 'Bilinmeyen malzeme'} (${item.quantity || 0} ${item.unit || 'adet'})`).join(', ')
    : req.materials || 'Malzeme bilgisi yok'
  
  return `- ${req.requestNumber} | ${req.site} (ID: ${req.siteId}) | ${itemsText} | ₺${parseFloat(req.amount || 0).toLocaleString('tr-TR')} | ${req.daysSince} gün önce | ${req.urgency || 'normal'}`
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

KULLANICI VE ROL DAĞILIMI:
${(data.profiles || []).map(profile => 
  `- ${profile.full_name || 'İsimsiz'} (${profile.email}) - ${profile.role || 'rol belirtilmemiş'} - ${profile.department || 'birim belirtilmemiş'}`
).join('\n') || 'Kullanıcı bulunamadı'}

MALZEME KATEGORİ HİYERARŞİSİ:
${(data.materialCategories || []).map(category => {
  const subcategories = (data.materialSubcategories || []).filter(sub => sub.category_id === category.id)
  const subcatText = subcategories.map(sub => {
    const items = (data.materialItems || []).filter(item => item.subcategory_id === sub.id)
    return `  • ${sub.name} (${items.length} malzeme)`
  }).join('\n')
  return `- ${category.name}: ${category.description || 'açıklama yok'}\n${subcatText}`
}).join('\n\n') || 'Kategori bulunamadı'}

TEDARİKÇİ-MALZEME İLİŞKİLERİ:
${(data.supplierMaterials || []).slice(0, 15).map(sm => {
  const supplier = data.suppliers?.find(s => s.id === sm.supplier_id)
  const category = data.materialCategories?.find(c => c.id === sm.material_category_id)
  const subcategory = data.materialSubcategories?.find(sc => sc.id === sm.material_subcategory_id)
  const item = data.materialItems?.find(i => i.id === sm.material_item_id)
  
  return `- ${supplier?.name || 'Bilinmeyen tedarikçi'}: ${category?.name || 'kategori yok'} > ${subcategory?.name || 'alt kategori yok'} > ${item?.name || 'malzeme yok'} | Min. Sipariş: ₺${parseFloat(sm.minimum_order_amount || 0).toLocaleString('tr-TR')} | Teslimat: ${sm.delivery_time_days || 0} gün`
}).join('\n') || 'Tedarikçi-malzeme ilişkisi bulunamadı'}

ONAY SÜREÇLERİ GEÇMİŞİ:
${(data.approvalHistory || []).slice(0, 10).map(approval => {
  const request = data.requests?.find(r => r.id === approval.purchase_request_id)
  const performer = data.profiles?.find(p => p.id === approval.performed_by)
  
  return `- ${approval.action?.toUpperCase()} | ${request?.request_number || 'bilinmeyen talep'} | ${performer?.full_name || 'bilinmeyen kullanıcı'} | ${approval.created_at?.split('T')[0]} | ${approval.comments || 'yorum yok'}`
}).join('\n') || 'Onay geçmişi bulunamadı'}

EKLI DOSYALAR:
${(data.attachments || []).slice(0, 10).map(att => {
  const request = data.requests?.find(r => r.id === att.purchase_request_id)
  const uploader = data.profiles?.find(p => p.id === att.uploaded_by)
  
  return `- ${att.file_name || 'dosya adı yok'} (${Math.round((att.file_size || 0) / 1024)} KB) | ${request?.request_number || 'bilinmeyen talep'} | ${uploader?.full_name || 'bilinmeyen yükleyici'} | ${att.created_at?.split('T')[0]}`
}).join('\n') || 'Ek dosya bulunamadı'}

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