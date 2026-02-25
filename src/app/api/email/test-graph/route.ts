import { NextRequest, NextResponse } from 'next/server';
import { sendEmailViaGraph, checkGraphEmailConfiguration } from '@/lib/microsoft-email';

/**
 * Test endpoint for Microsoft Graph email sending
 * GET /api/email/test-graph?email=user@company.com
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required. Usage: /api/email/test-graph?email=user@company.com' },
        { status: 400 }
      );
    }

    // Check configuration
    const config = checkGraphEmailConfiguration();
    if (!config.configured) {
      return NextResponse.json(
        {
          error: 'Microsoft Graph not configured',
          missing: config.missing,
          message: 'Please set the following environment variables: ' + config.missing.join(', ')
        },
        { status: 500 }
      );
    }

    // Send test email
    const result = await sendEmailViaGraph({
      to: email,
      subject: '🧪 Test Email - Microsoft Graph API',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Email</title>
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
            <h1>🧪 Test Email</h1>
            <p>Microsoft Graph API ile gönderildi!</p>
        </div>
        
        <div class="content">
            <p>Bu bir test e-postasıdır. Email sisteminiz <strong>Microsoft Graph API</strong> ile başarıyla çalışıyor!</p>
            
            <div class="info-box">
                <h3>Test Detayları</h3>
                <p><strong>Test Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                <p><strong>Sistem:</strong> Satın Alma Yönetim Sistemi</p>
                <p><strong>Yöntem:</strong> Microsoft Graph API</p>
                <p><strong>Durum:</strong> ✅ Aktif</p>
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
            <p>Bu e-posta Satın Alma Yönetim Sistemi tarafından Microsoft Graph API ile gönderilmiştir.</p>
        </div>
    </div>
</body>
</html>
      `,
      text: `
Test Email - Microsoft Graph API

Bu bir test e-postasıdır. Email sisteminiz Microsoft Graph API ile başarıyla çalışıyor!

Test Zamanı: ${new Date().toLocaleString('tr-TR')}
Sistem: Satın Alma Yönetim Sistemi
Yöntem: Microsoft Graph API
Durum: ✅ Aktif

Bu e-posta Satın Alma Yönetim Sistemi tarafından gönderilmiştir.
      `
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email başarıyla gönderildi: ${email}`,
        method: 'Microsoft Graph API',
        config: {
          tenantId: process.env.MICROSOFT_TENANT_ID,
          clientId: process.env.MICROSOFT_CLIENT_ID,
          from: process.env.SMTP_USER || 'egemen.ertan@dovecgroup.com'
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: 'Email gönderilemedi. Lütfen Azure AD izinlerini kontrol edin.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Test email gönderilemedi'
      },
      { status: 500 }
    );
  }
}
