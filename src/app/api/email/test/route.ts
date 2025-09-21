import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import EmailService from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 404 }
      );
    }

    // Create email service instance
    const emailService = new EmailService();

    // Test connection first
    const isConnected = await emailService.testConnection();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Email service connection failed' },
        { status: 500 }
      );
    }

    // Generate test email template
    const testTemplate = {
      subject: '📧 Test E-postası - Satın Alma Sistemi',
      text: `
Merhaba ${profile.full_name || 'Kullanıcı'},

Bu e-posta, Satın Alma Yönetim Sistemi'nin e-posta bildirim özelliğini test etmek için gönderilmiştir.

✅ E-posta servisi düzgün çalışıyor!
✅ SMTP bağlantısı başarılı
✅ E-posta şablonları hazır

Sistem artık aşağıdaki durumlarda size e-posta gönderebilir:
• Yeni satın alma talebi oluşturulduğunda
• Talep durumu değiştiğinde
• Yeni teklif geldiğinde

Bu e-posta ${new Date().toLocaleString('tr-TR')} tarihinde test amaçlı gönderilmiştir.

Saygılarımızla,
Satın Alma Yönetim Sistemi
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test E-postası</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        .feature-list { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .feature-list ul { margin: 0; padding-left: 20px; }
        .feature-list li { margin: 8px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .emoji { font-size: 1.2em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Test E-postası</h1>
            <p>E-posta sistemi başarıyla çalışıyor!</p>
        </div>
        
        <div class="content">
            <p>Merhaba <strong>${profile.full_name || 'Kullanıcı'}</strong>,</p>
            
            <p>Bu e-posta, Satın Alma Yönetim Sistemi'nin e-posta bildirim özelliğini test etmek için gönderilmiştir.</p>
            
            <div class="success-box">
                <p><span class="emoji">✅</span> <strong>E-posta servisi düzgün çalışıyor!</strong></p>
                <p><span class="emoji">✅</span> <strong>SMTP bağlantısı başarılı</strong></p>
                <p><span class="emoji">✅</span> <strong>E-posta şablonları hazır</strong></p>
            </div>
            
            <div class="feature-list">
                <h3>📋 Sistem artık aşağıdaki durumlarda size e-posta gönderebilir:</h3>
                <ul>
                    <li>🆕 Yeni satın alma talebi oluşturulduğunda</li>
                    <li>🔄 Talep durumu değiştiğinde</li>
                    <li>💰 Yeni teklif geldiğinde</li>
                    <li>📊 Günlük/haftalık raporlar için</li>
                </ul>
            </div>
            
            <p><small>Bu e-posta <strong>${new Date().toLocaleString('tr-TR')}</strong> tarihinde test amaçlı gönderilmiştir.</small></p>
        </div>
        
        <div class="footer">
            <p><strong>Satın Alma Yönetim Sistemi</strong></p>
            <p>Bu test e-postası otomatik olarak gönderilmiştir.</p>
        </div>
    </div>
</body>
</html>
      `.trim()
    };

    // Send test email
    const result = await emailService.sendEmail(profile.email, testTemplate);

    if (result.success) {
      return NextResponse.json({
        message: 'Test e-postası başarıyla gönderildi!',
        email: profile.email,
        messageId: result.messageId,
        service: process.env.NODE_ENV === 'production' ? 'SMTP' : 'Ethereal Email (test)'
      });
    } else {
      return NextResponse.json(
        { error: `E-posta gönderiminde hata: ${result.error}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json(
      { error: 'E-posta test sırasında hata oluştu' },
      { status: 500 }
    );
  }
}
