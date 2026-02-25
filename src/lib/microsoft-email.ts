import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

let graphClient: Client | null = null;

/**
 * Microsoft Graph API client'ını oluşturur
 */
function getGraphClient(): Client {
  if (graphClient) return graphClient;

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph credentials not configured');
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        try {
          const token = await credential.getToken('https://graph.microsoft.com/.default');
          return token?.token || '';
        } catch (error) {
          console.error('Failed to get access token:', error);
          throw error;
        }
      },
    },
  });

  return graphClient;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Microsoft Graph API ile email gönderir
 */
export async function sendEmailViaGraph(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getGraphClient();
    // MICROSOFT_SENDER_EMAIL kullan, yoksa SMTP_USER kullan, en son fallback
    const fromEmail = message.from || process.env.MICROSOFT_SENDER_EMAIL || process.env.SMTP_USER || 'noreply@dovecgroup.com';

    console.log(`📧 Gönderen email adresi: ${fromEmail}`);

    // To adreslerini array'e çevir
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    // Email payload oluştur
    const emailPayload = {
      message: {
        subject: message.subject,
        body: {
          contentType: 'HTML',
          content: message.html
        },
        toRecipients: recipients.map(email => ({
          emailAddress: {
            address: email
          }
        })),
        from: {
          emailAddress: {
            address: fromEmail
          }
        }
      },
      saveToSentItems: true
    };

    console.log(`📧 Email gönderiliyor (Graph API): ${recipients.join(', ')}`);

    // Email gönder
    await client
      .api(`/users/${fromEmail}/sendMail`)
      .post(emailPayload);

    console.log(`✅ Email başarıyla gönderildi (Graph API): ${recipients.join(', ')}`);

    return { success: true };
  } catch (error: any) {
    console.error('❌ Email gönderilemedi (Graph API):', error);
    
    // Detaylı hata mesajı
    let errorMessage = error.message || 'Unknown error';
    if (error.body) {
      errorMessage = error.body.error?.message || errorMessage;
    }

    return { 
      success: false, 
      error: errorMessage
    };
  }
}

/**
 * Birden fazla kullanıcıya email gönder
 */
export async function sendBulkEmailsViaGraph(
  recipients: string[],
  subject: string,
  html: string,
  text?: string
): Promise<{ success: number; failed: number; results: any[] }> {
  console.log(`📤 Toplu email gönderiliyor (Graph API): ${recipients.length} alıcı`);

  const results = await Promise.allSettled(
    recipients.map(email => 
      sendEmailViaGraph({
        to: email,
        subject,
        html,
        text
      })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

  console.log(`✅ Başarılı: ${successful.length}, ❌ Başarısız: ${failed.length}`);

  return {
    success: successful.length,
    failed: failed.length,
    results
  };
}

/**
 * Microsoft Graph yapılandırmasını kontrol eder
 */
export function checkGraphEmailConfiguration(): { configured: boolean; missing: string[] } {
  const required = ['MICROSOFT_TENANT_ID', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  return {
    configured: missing.length === 0,
    missing
  };
}
