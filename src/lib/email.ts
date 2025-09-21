import nodemailer from 'nodemailer';

// E-posta konfigürasyonu
const createTransporter = () => {
  // Ethereal Email (test için) veya Gmail SMTP
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Production: Gmail veya diğer SMTP servisleri
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: Ethereal Email (test)
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

  // E-posta gönder
  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    attachments?: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Satın Alma Sistemi" <noreply@satinalma.com>',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: template.subject,
        text: template.text,
        html: template.html,
        attachments: attachments || []
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', info.messageId);
      
      // Development'te test URL'ini göster
      if (process.env.NODE_ENV !== 'production') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Email send failed:', error);
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
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; }
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
            
            <p>Yeni bir satın alma talebi sisteme kaydedildi. Talebi incelemek ve gerekli işlemleri yapmak için aşağıdaki butona tıklayın.</p>
            
            <div style="text-align: center;">
                <a href="${requestUrl}" class="button">Talebi Görüntüle</a>
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
        .header { background: ${newStatus === 'approved' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : newStatus === 'rejected' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .status-box { background: ${newStatus === 'approved' ? '#f0fdf4' : newStatus === 'rejected' ? '#fef2f2' : '#f8f9fa'}; border-left: 4px solid ${newStatus === 'approved' ? '#10b981' : newStatus === 'rejected' ? '#ef4444' : '#667eea'}; padding: 15px; margin: 20px 0; }
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
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .offer-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
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
