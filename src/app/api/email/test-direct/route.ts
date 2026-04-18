import { NextRequest, NextResponse } from 'next/server';
import EmailService from '@/lib/email';

/**
 * Test endpoint for direct email sending
 * GET /api/email/test-direct?email=user@company.com
 * GÜVENLİK: Sadece development ortamında çalışır
 */
export async function GET(request: NextRequest) {
  // Production'da endpoint'i kapat
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required. Usage: /api/email/test-direct?email=user@company.com' },
        { status: 400 }
      );
    }

    // Check SMTP configuration
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        {
          error: 'SMTP not configured',
          message: 'Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables'
        },
        { status: 500 }
      );
    }

    // Create email service
    const emailService = new EmailService();

    // Test connection first
    const isConnected = await emailService.testConnection();
    if (!isConnected) {
      return NextResponse.json(
        {
          error: 'SMTP connection failed',
          message: 'Could not connect to SMTP server. Check your credentials.'
        },
        { status: 500 }
      );
    }

    // Send test email
    const template = {
      subject: '🧪 Test Bildirimi - Satın Alma Sistemi',
      text: `
Test Bildirimi

Bu bir test e-postasıdır. Email sisteminiz başarıyla çalışıyor!

Test Zamanı: ${new Date().toLocaleString('tr-TR')}
Sistem: Satın Alma Yönetim Sistemi
Durum: ✅ Aktif

Bu e-posta otomatik olarak gönderilmiştir.
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Bildirimi</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .info-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Bildirimi</h1>
            <p>Email sistemi başarıyla çalışıyor!</p>
        </div>
        
        <div class="content">
            <p>Bu bir test e-postasıdır. Email bildirim sisteminiz başarıyla yapılandırılmış ve çalışıyor.</p>
            
            <div class="info-box">
                <h3>Test Detayları</h3>
                <p><strong>Test Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                <p><strong>Sistem:</strong> Satın Alma Yönetim Sistemi</p>
                <p><strong>Durum:</strong> ✅ Aktif</p>
                <p><strong>SMTP Sunucu:</strong> ${process.env.SMTP_HOST}</p>
            </div>
            
            <p>Artık kullanıcılara otomatik bildirimler gönderebilirsiniz:</p>
            <ul>
                <li>✅ Yeni talep oluşturulduğunda</li>
                <li>✅ Talep onaylandığında/reddedildiğinde</li>
                <li>✅ Yeni teklif geldiğinde</li>
                <li>✅ Özel bildirimler</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" class="button">Sisteme Git</a>
            </div>
        </div>
        
        <div class="footer">
            <p>Bu e-posta Satın Alma Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.</p>
        </div>
    </div>
</body>
</html>
      `.trim()
    };

    const result = await emailService.sendEmail(email, template);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test e-postası başarıyla gönderildi: ${email}`,
        messageId: result.messageId,
        smtp: {
          host: process.env.SMTP_HOST,
          user: process.env.SMTP_USER,
          from: process.env.SMTP_FROM || '"Satın Alma Sistemi" <noreply@satinalma.com>'
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: 'E-posta gönderilemedi. SMTP ayarlarını kontrol edin.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Test e-postası gönderilemedi'
      },
      { status: 500 }
    );
  }
}
