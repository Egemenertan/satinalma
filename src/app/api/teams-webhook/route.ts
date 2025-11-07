import { NextRequest, NextResponse } from 'next/server'

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL

interface PurchaseRequest {
  id: string
  request_number: string
  site_name: string
  requested_by_name: string
  created_at: string
  specifications?: string
  status?: string
  isRejection?: boolean
  items?: Array<{
    material_name: string
    quantity: number
    unit: string
    brand?: string
    specifications?: string
  }>
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

function formatTeamsRejectionMessage(request: PurchaseRequest): TeamsCard {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dovac.app'
  const requestUrl = `${baseUrl}/dashboard/requests/${request.id}`
  
  // Malzeme listesini formatla
  const materialsText = request.items?.map((item: any, index) => {
    const materialName = item.item_name || item.material_name || item.material_item_name || 'Bilinmeyen Malzeme'
    const quantity = item.quantity || item.original_quantity || 0
    const unit = item.unit || 'adet'
    const brand = item.brand ? ` (${item.brand})` : ''
    
    return `${index + 1}. **${materialName}** - ${quantity} ${unit}${brand}`
  }).join('\n') || 'Malzeme bilgisi bulunamadı'

  const card: TeamsCard = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "FF0000", // Kırmızı tema
    "summary": `Talep Reddedildi: ${request.request_number}`,
    "sections": [
      {
        "activityTitle": "🚫 Talep Reddedildi",
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
            "value": "❌ Site Manager Tarafından Reddedildi"
          }
        ]
      },
      {
        "activityTitle": "📋 Reddedilen Malzemeler",
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

function formatTeamsMessage(request: PurchaseRequest): TeamsCard {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dovac.app'
  const requestUrl = `${baseUrl}/dashboard/requests/${request.id}`
  
  // Malzeme listesini formatla
  const materialsText = request.items?.map((item: any, index) => {
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

export async function POST(request: NextRequest) {
  try {
    // Teams webhook URL kontrolü
    if (!TEAMS_WEBHOOK_URL) {
      console.warn('⚠️ TEAMS_WEBHOOK_URL environment variable tanımlı değil - bildirim atlanıyor')
      return NextResponse.json(
        { 
          success: true, 
          message: 'Teams webhook URL yapılandırılmamış, bildirim atlandı',
          skipped: true
        },
        { status: 200 }
      )
    }

    const body = await request.json()
    console.log('🔔 Teams webhook isteği alındı:', body)

    // Request verilerini validate et
    if (!body.id || !body.request_number || !body.site_name) {
      return NextResponse.json(
        { error: 'Gerekli talep bilgileri eksik' },
        { status: 400 }
      )
    }

    // Teams mesajını formatla (red bildirimi mi kontrol et)
    const teamsMessage = body.isRejection 
      ? formatTeamsRejectionMessage(body)
      : formatTeamsMessage(body)
    console.log('📤 Teams mesajı hazırlandı:', JSON.stringify(teamsMessage, null, 2))

    // Teams webhook'una gönder
    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamsMessage)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Teams webhook hatası:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`Teams webhook failed: ${response.status} - ${errorText}`)
    }

    console.log('✅ Teams bildirimi başarıyla gönderildi')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Teams bildirimi gönderildi' 
    })

  } catch (error) {
    console.error('❌ Teams webhook hatası:', error)
    return NextResponse.json(
      { 
        error: 'Teams bildirimi gönderilemedi',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}

// Test endpoint'i
export async function GET() {
  return NextResponse.json({
    message: 'Teams Webhook API çalışıyor',
    webhook_url: TEAMS_WEBHOOK_URL ? 'Yapılandırılmış' : 'Yapılandırılmamış',
    url_length: TEAMS_WEBHOOK_URL ? TEAMS_WEBHOOK_URL.length : 0
  })
}
