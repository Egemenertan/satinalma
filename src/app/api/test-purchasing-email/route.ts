import { NextResponse } from 'next/server';
import EmailService from '@/lib/email';

/**
 * Test endpoint for purchasing officer email
 * GET /api/test-purchasing-email
 */
export async function GET() {
  try {
    const testEmail = 'ertanegemenyusuf@gmail.com';
    const requestId = 'test-123';
    const requestNumber = 'REQ-2024-TEST';
    const materialName = 'Test Malzeme';
    const requesterName = 'Test Kullanıcı';
    
    console.log(`📧 Test email gönderiliyor: ${testEmail}...`);
    
    const emailService = new EmailService();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const template = {
      subject: `🔔 Yeni Satın Alma Talebi: ${requestNumber}`,
      text: `
Yeni Satın Alma Talebi

Talep Numarası: ${requestNumber}
Malzeme: ${materialName}
Talep Eden: ${requesterName}
Durum: Satın Almaya Gönderildi

Talebi görüntülemek için: ${baseUrl}/dashboard/requests/${requestId}

Bu bildirim Satın Alma Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yeni Satın Alma Talebi</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Yeni Satın Alma Talebi</h1>
            <p>Onayınız bekleniyor</p>
        </div>
        
        <div class="content">
            <div class="info-box">
                <h3>Talep Detayları</h3>
                <p><strong>Talep Numarası:</strong> ${requestNumber}</p>
                <p><strong>Malzeme:</strong> ${materialName}</p>
                <p><strong>Talep Eden:</strong> ${requesterName}</p>
                <p><strong>Durum:</strong> <span class="badge">Satın Almaya Gönderildi</span></p>
            </div>
            
            <p>Yeni bir satın alma talebi sisteme kaydedildi ve satın alma departmanına gönderildi. Talebi incelemek ve gerekli işlemleri yapmak için aşağıdaki butona tıklayın.</p>
            
            <div style="text-align: center;">
                <a href="${baseUrl}/dashboard/requests/${requestId}" class="button">Talebi Görüntüle</a>
            </div>
            
            <p><small>Bu bağlantı çalışmıyorsa, şu adresi kopyalayın: ${baseUrl}/dashboard/requests/${requestId}</small></p>
        </div>
        
        <div class="footer">
            <p>Bu e-posta Satın Alma Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.</p>
            <p><strong>Bu bir test mesajıdır.</strong></p>
        </div>
    </div>
</body>
</html>
      `.trim()
    };
    
    const result = await emailService.sendEmail(testEmail, template);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email başarıyla gönderildi: ${testEmail}`,
        messageId: result.messageId
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: 'Email gönderilemedi'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Test email gönderilemedi'
      },
      { status: 500 }
    );
  }
}
