import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Test verisi
    const testPayload = {
      id: 'test-id-123',
      request_number: 'TEST-2024-001',
      site_name: 'Test Şantiye',
      requested_by_name: 'Test Kullanıcı',
      created_at: new Date().toISOString(),
      specifications: 'Test amaçlı gönderilen örnek talep',
      status: 'satın almaya gönderildi',
      items: [
        {
          material_name: 'Çimento',
          quantity: 10,
          unit: 'çuval',
          brand: 'Akçansa',
          specifications: '42.5 Portland çimentosu'
        },
        {
          material_name: 'Demir',
          quantity: 500,
          unit: 'kg',
          brand: 'Kaptan Demir',
          specifications: '12mm nervürlü inşaat demiri'
        }
      ]
    }

    console.log('🧪 Test webhook gönderiliyor...')

    // Kendi API endpoint'imizi çağır
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dovac.app'
    const response = await fetch(`${baseUrl}/api/teams-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Test webhook failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Test webhook başarıyla gönderildi',
      testData: testPayload,
      result
    })

  } catch (error) {
    console.error('❌ Test webhook hatası:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}
