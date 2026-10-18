import nodemailer from 'nodemailer';
import { sendEmailViaGraph } from './microsoft-email';

// E-posta konfigürasyonu
const createTransporter = () => {
  // Eğer SMTP ayarları varsa onları kullan (development veya production)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('📧 SMTP Ayarları:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      secure: process.env.SMTP_SECURE
    });
    
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Outlook için ek ayarlar
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    });
  } else {
    // Fallback: Ethereal Email (test)
    console.log('⚠️ SMTP ayarları bulunamadı, test modu kullanılıyor');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }
};

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = createTransporter();
  }

  // Test e-posta bağlantısı
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  // E-posta gönder (Microsoft Graph API ile - 2FA destekler)
  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    attachments?: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Önce Microsoft Graph API ile dene (2FA destekler)
    const useGraphAPI = process.env.MICROSOFT_TENANT_ID && 
                        process.env.MICROSOFT_CLIENT_ID && 
                        process.env.MICROSOFT_CLIENT_SECRET &&
                        process.env.MICROSOFT_SENDER_EMAIL;

    if (useGraphAPI) {
      console.log('📧 Microsoft Graph API kullanılıyor (2FA destekli)...');
      try {
        const result = await sendEmailViaGraph({
          to,
          subject: template.subject,
          html: template.html,
          text: template.text,
          from: process.env.MICROSOFT_SENDER_EMAIL
        });

        if (result.success) {
          console.log('✅ Email başarıyla gönderildi (Graph API)');
          return {
            success: true,
            messageId: 'graph-api-' + Date.now()
          };
        } else {
          console.warn('⚠️ Graph API hatası:', result.error);
          console.warn('⚠️ Azure Portal\'da Mail.Send iznini ve admin consent\'i kontrol edin');
        }
      } catch (error) {
        console.warn('⚠️ Graph API hatası, SMTP deneniyor...', error);
      }
    }

    // Fallback: SMTP kullan (2FA varsa çalışmaz) - 3 saniye timeout ile
    console.log('📧 SMTP kullanılıyor (2FA varsa çalışmayabilir)...');
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Satın Alma Sistemi" <noreply@satinalma.com>',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: template.subject,
        text: template.text,
        html: template.html,
        attachments: attachments || []
      };

      // SMTP gönderimi - 3 saniye timeout ile
      const sendMailPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SMTP timeout (3s)')), 3000)
      );
      
      const info = await Promise.race([sendMailPromise, timeoutPromise]) as any;
      
      console.log('✅ Email sent successfully (SMTP):', info.messageId);
      
      // Development'te test URL'ini göster
      if (process.env.NODE_ENV !== 'production') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('❌ Email send failed (SMTP):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Yeni talep bildirimi e-postası
  generateNewRequestTemplate(
    requestTitle: string,
    requestNumber: string,
    requesterName: string,
    siteName?: string,
    requestId?: string
  ): EmailTemplate {
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const requestUrl = requestId ? `${dashboardUrl}/dashboard/requests/${requestId}` : `${dashboardUrl}/dashboard/requests`;

    return {
      subject: `🔔 Yeni Satın Alma Talebi: ${requestTitle}`,
      text: `
Yeni Satın Alma Talebi

Talep Numarası: ${requestNumber}
Talep Başlığı: ${requestTitle}
Talep Eden: ${requesterName}
${siteName ? `Şantiye: ${siteName}` : ''}

Yeni bir talep oluşturuldu. Lütfen talebi inceleyin ve onaya gönderin.

Talebi görüntülemek için: ${requestUrl}

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
        .header { background: linear-gradient(135deg, #004777 0%, #53131E 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #004777; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .info-box { background: #f8f9fa; border-left: 4px solid #004777; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Yeni Satın Alma Talebi</h1>
            <p>Sisteme yeni bir talep kaydedildi</p>
        </div>
        
        <div class="content">
            <div class="info-box">
                <h3>Talep Detayları</h3>
                <p><strong>Talep Numarası:</strong> ${requestNumber}</p>
                <p><strong>Talep Başlığı:</strong> ${requestTitle}</p>
                <p><strong>Talep Eden:</strong> ${requesterName}</p>
                ${siteName ? `<p><strong>Şantiye:</strong> ${siteName}</p>` : ''}
            </div>
            
            <p><strong>Yeni bir talep oluşturuldu!</strong></p>
            <p>Lütfen talebi inceleyin ve onaya gönderin. Talebi incelemek ve gerekli işlemleri yapmak için aşağıdaki butona tıklayın.</p>
            
            <div style="text-align: center;">
                <a href="${requestUrl}" class="button">Talebi İncele ve Onayla</a>
            </div>
            
            <p><small>Bu bağlantı çalışmıyorsa, şu adresi kopyalayın: ${requestUrl}</small></p>
        </div>
        
        <div class="footer">
            <p>Bu e-posta Satın Alma Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.</p>
            <p>Bu bildirimleri almak istemiyorsanız, hesap ayarlarınızdan e-posta bildirimlerini kapatabilirsiniz.</p>
        </div>
    </div>
</body>
</html>
      `.trim()
    };
  }

  // Talep durumu değişikliği e-postası
  generateStatusChangeTemplate(
    requestTitle: string,
    requestNumber: string,
    oldStatus: string,
    newStatus: string,
    comment?: string,
    requestId?: string
  ): EmailTemplate {
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const requestUrl = requestId ? `${dashboardUrl}/dashboard/requests/${requestId}` : `${dashboardUrl}/dashboard/requests`;

    const statusEmoji = newStatus === 'approved' ? '✅' : newStatus === 'rejected' ? '❌' : '🔄';
    const statusText = {
      'approved': 'Onaylandı',
      'rejected': 'Reddedildi',
      'pending': 'Beklemede',
      'awaiting_offers': 'Teklif Bekleniyor'
    }[newStatus] || newStatus;

    return {
      subject: `${statusEmoji} Talep Durumu Güncellendi: ${requestTitle}`,
      text: `
Talep Durumu Güncellendi

Talep Numarası: ${requestNumber}
Talep Başlığı: ${requestTitle}
Eski Durum: ${oldStatus}
Yeni Durum: ${statusText}
${comment ? `Açıklama: ${comment}` : ''}

Talebi görüntülemek için: ${requestUrl}
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Talep Durumu Güncellendi</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${newStatus === 'approved' ? 'linear-gradient(135deg, #007944 0%, #005C33 100%)' : newStatus === 'rejected' ? 'linear-gradient(135deg, #C2322F 0%, #9A2422 100%)' : 'linear-gradient(135deg, #004777 0%, #53131E 100%)'}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #004777; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .status-box { background: ${newStatus === 'approved' ? '#F6F6F6' : newStatus === 'rejected' ? '#FFF1F0' : '#f8f9fa'}; border-left: 4px solid ${newStatus === 'approved' ? '#007944' : newStatus === 'rejected' ? '#C2322F' : '#004777'}; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusEmoji} Talep Durumu Güncellendi</h1>
            <p>Talep durumunuzda değişiklik var</p>
        </div>
        
        <div class="content">
            <div class="status-box">
                <h3>Durum Bilgisi</h3>
                <p><strong>Talep Numarası:</strong> ${requestNumber}</p>
                <p><strong>Talep Başlığı:</strong> ${requestTitle}</p>
                <p><strong>Yeni Durum:</strong> ${statusText}</p>
                ${comment ? `<p><strong>Açıklama:</strong> ${comment}</p>` : ''}
            </div>
            
            <div style="text-align: center;">
                <a href="${requestUrl}" class="button">Talebi Görüntüle</a>
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
  }

  // Yeni teklif bildirimi e-postası
  generateNewOfferTemplate(
    requestTitle: string,
    requestNumber: string,
    supplierName: string,
    offerAmount?: number,
    currency?: string,
    requestId?: string
  ): EmailTemplate {
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const requestUrl = requestId ? `${dashboardUrl}/dashboard/requests/${requestId}/offers` : `${dashboardUrl}/dashboard/requests`;

    return {
      subject: `💰 Yeni Teklif Alındı: ${requestTitle}`,
      text: `
Yeni Teklif Alındı

Talep Numarası: ${requestNumber}
Talep Başlığı: ${requestTitle}
Tedarikçi: ${supplierName}
${offerAmount && currency ? `Teklif Tutarı: ${currency} ${offerAmount.toLocaleString()}` : ''}

Teklifi görüntülemek için: ${requestUrl}
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yeni Teklif Alındı</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #53131E 0%, #370D13 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #53131E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .offer-box { background: #F8EEEE; border-left: 4px solid #53131E; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Yeni Teklif Alındı</h1>
            <p>Talebiniz için yeni bir teklif geldi</p>
        </div>
        
        <div class="content">
            <div class="offer-box">
                <h3>Teklif Detayları</h3>
                <p><strong>Talep Numarası:</strong> ${requestNumber}</p>
                <p><strong>Talep Başlığı:</strong> ${requestTitle}</p>
                <p><strong>Tedarikçi:</strong> ${supplierName}</p>
                ${offerAmount && currency ? `<p><strong>Teklif Tutarı:</strong> ${currency} ${offerAmount.toLocaleString()}</p>` : ''}
            </div>
            
            <div style="text-align: center;">
                <a href="${requestUrl}" class="button">Teklifi İncele</a>
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
  }
}

export default EmailService;
