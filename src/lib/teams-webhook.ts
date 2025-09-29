import { createClient } from './supabase/client'

interface PurchaseRequestData {
  id: string
  request_number: string
  site_name: string
  requested_by_name: string
  created_at: string
  specifications?: string
  status: string
  items?: MaterialItem[]
  profiles?: {
    full_name: string
  }
}

interface MaterialItem {
  material_name: string
  quantity: number
  unit: string
  brand?: string
  specifications?: string
}

interface TeamsCardAction {
  "@type": string
  name: string
  targets: Array<{
    os: string
    uri: string
  }>
}

interface TeamsCard {
  "@type": string
  "@context": string
  themeColor: string
  summary: string
  sections: Array<{
    activityTitle: string
    activitySubtitle: string
    activityImage?: string
    facts: Array<{
      name: string
      value: string
    }>
    markdown?: boolean
  }>
  potentialAction?: TeamsCardAction[]
}

function formatTeamsMessage(request: PurchaseRequestData): TeamsCard {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dovac.app'
  const requestUrl = `${baseUrl}/dashboard/requests/${request.id}`
  
  // Malzeme listesini formatla - farklı field adlarını dene
  const materialsText = request.items?.map((item: any, index: number) => {
    const materialName = item.item_name || item.material_name || item.material_item_name || 'Bilinmeyen Malzeme'
    const quantity = item.quantity || item.original_quantity || 0
    const unit = item.unit || 'adet'
    const brand = item.brand ? ` (${item.brand})` : ''
    
    return `${index + 1}. **${materialName}** - ${quantity} ${unit}${brand}`
  }).join('\n') || 'Malzeme bilgisi bulunamadı'

  const card: TeamsCard = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": `Yeni Satın Alma Talebi: ${request.request_number}`,
    "sections": [
      {
        "activityTitle": "🛒 Yeni Satın Alma Talebi",
        "activitySubtitle": `Talep No: ${request.request_number}`,
        "facts": [
          {
            "name": "Şantiye",
            "value": request.site_name
          },
          {
            "name": "Talep Eden",
            "value": request.requested_by_name
          },
          {
            "name": "Tarih",
            "value": new Date(request.created_at).toLocaleDateString('tr-TR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          },
          {
            "name": "Durum",
            "value": "🔄 Satın Almaya Gönderildi"
          }
        ]
      },
      {
        "activityTitle": "📋 Malzemeler",
        "activitySubtitle": "",
        "facts": [
          {
            "name": "Malzeme Listesi",
            "value": materialsText
          }
        ],
        "markdown": true
      }
    ],
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "Talebi Görüntüle",
        "targets": [
          {
            "os": "default",
            "uri": requestUrl
          }
        ]
      }
    ]
  }

  // Eğer specifications varsa ekle
  if (request.specifications) {
    card.sections[1].facts.push({
      "name": "Özel Notlar",
      "value": request.specifications
    })
  }

  return card
}

/**
 * Teams webhook'una satın alma talebi bildirimi gönderir
 */
export async function sendTeamsNotification(requestId: string) {
  try {
    console.log('🔔 Teams bildirimi gönderiliyor:', requestId)
    
    const supabase = createClient()
    
    // Talep detaylarını al
    const { data: request, error: requestError } = await supabase
      .from('purchase_requests')
      .select(`
        id,
        request_number,
        site_name,
        created_at,
        specifications,
        status,
        profiles!purchase_requests_requested_by_fkey (
          full_name
        )
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      console.error('❌ Talep bulunamadı:', requestError)
      return { success: false, error: 'Talep bulunamadı' }
    }

    // Malzeme listesini al - tüm olası field'ları deneyelim
    const { data: items, error: itemsError } = await supabase
      .from('purchase_request_items')
      .select('*')
      .eq('purchase_request_id', requestId)

    console.log('🔍 Malzeme sorgu sonucu:', { 
      items, 
      itemsError, 
      requestId,
      itemCount: items?.length || 0,
      firstItem: items?.[0] || null
    })

    if (itemsError) {
      console.error('❌ Malzemeler alınamadı:', itemsError)
    }

    // Webhook payload'ını hazırla
    const webhookPayload = {
      id: request.id,
      request_number: request.request_number,
      site_name: request.site_name,
      requested_by_name: (request as any).profiles?.full_name || 'Bilinmeyen',
      created_at: request.created_at,
      specifications: request.specifications,
      status: request.status,
      items: items || []
    }

    console.log('📤 Webhook payload hazırlandı:', webhookPayload)

    // Server-side API endpoint'ine gönder (CORS sorununu çözer)
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'https://dovac.app'
    const webhookUrl = `${baseUrl}/api/teams-webhook`
    
    console.log('🌐 Teams webhook URL:', webhookUrl)
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    })
    
    console.log('📡 Fetch response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Teams webhook API hatası:', {
        status: response.status,
        error: errorText
      })
      return { 
        success: false, 
        error: `API hatası: ${response.status} - ${errorText}` 
      }
    }

    const result = await response.json()
    console.log('✅ Teams bildirimi başarıyla gönderildi:', result)
    
    return { success: true, data: result }

  } catch (error) {
    console.error('❌ Teams bildirimi hatası:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
    }
  }
}

/**
 * Talep durumu "satın almaya gönderildi" olduğunda Teams bildirimi gönder
 */
export async function handlePurchaseRequestStatusChange(
  requestId: string, 
  newStatus: string, 
  oldStatus?: string
) {
  console.log('🔍 handlePurchaseRequestStatusChange çağrıldı:', {
    requestId,
    newStatus,
    oldStatus,
    shouldSend: newStatus === 'satın almaya gönderildi' && oldStatus !== 'satın almaya gönderildi'
  })
  
  // Sadece "satın almaya gönderildi" durumunda bildirim gönder
  if (newStatus === 'satın almaya gönderildi' && oldStatus !== 'satın almaya gönderildi') {
    console.log('🎯 Satın almaya gönderildi durumu tespit edildi, Teams bildirimi gönderiliyor...')
    
    try {
      const result = await sendTeamsNotification(requestId)
      console.log('📤 Teams bildirimi sonucu:', result)
      return result
    } catch (error) {
      console.error('❌ Teams bildirimi hatası:', error)
      return { success: false, error }
    }
  } else {
    console.log('ℹ️ Teams bildirimi gönderilmedi - koşul sağlanmadı')
    return { success: false, error: 'Koşul sağlanmadı' }
  }
}
