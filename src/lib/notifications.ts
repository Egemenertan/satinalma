import { createClient } from './supabase/client';
import { SPECIAL_SITE_ID } from './constants';

// EmailService artık API route üzerinden çağrılıyor (nodemailer client-side'da çalışmaz)

interface NotificationData {
  title: string;
  body: string;
  data?: any;
  userIds?: string[];
  roles?: string[];
  siteId?: string;
}

export class NotificationService {
  private static async sendNotification(payload: NotificationData) {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Notification send failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  private static async sendEmail(emailData: any) {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Email send failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  // Combined notification: Push + Email
  private static async sendCombinedNotification(
    pushPayload: NotificationData,
    emailPayload: any
  ) {
    const results = {
      push: { success: false, error: null as string | null },
      email: { success: false, error: null as string | null }
    };

    // Send push notification
    try {
      await this.sendNotification(pushPayload);
      results.push.success = true;
    } catch (error) {
      results.push.error = error instanceof Error ? error.message : 'Push notification failed';
      console.error('Push notification failed:', error);
    }

    // Send email notification
    try {
      await this.sendEmail(emailPayload);
      results.email.success = true;
    } catch (error) {
      results.email.error = error instanceof Error ? error.message : 'Email failed';
      console.error('Email notification failed:', error);
    }

    return results;
  }

  // Helper: Get user emails by user IDs
  private static async getUserEmails(userIds: string[]): Promise<string[]> {
    try {
      const supabase = createClient();
      const { data: users, error } = await supabase
        .from('profiles')
        .select('email')
        .in('id', userIds);

      if (error) throw error;
      return users?.map(u => u.email).filter(Boolean) || [];
    } catch (error) {
      console.error('Failed to get user emails:', error);
      return [];
    }
  }

  // Helper: Get user emails by roles
  private static async getUserEmailsByRoles(roles: string[], siteId?: string): Promise<string[]> {
    try {
      const supabase = createClient();
      let query = supabase
        .from('profiles')
        .select('email')
        .in('role', roles);

      if (siteId) {
        query = query.eq('site_id', siteId);
      }

      const { data: users, error } = await query;
      if (error) throw error;
      return users?.map(u => u.email).filter(Boolean) || [];
    } catch (error) {
      console.error('Failed to get user emails by roles:', error);
      return [];
    }
  }

  // Helper: Send direct email to specific users via API route
  private static async sendDirectEmails(
    userEmails: string[],
    template: { subject: string; html: string; text: string }
  ): Promise<{ success: number; failed: number }> {
    console.log(`📤 sendDirectEmails başlatıldı, ${userEmails.length} alıcı`);
    console.log(`📧 Alıcılar: ${userEmails.join(', ')}`);
    
    let successCount = 0;
    let failedCount = 0;

    for (const email of userEmails) {
      try {
        console.log(`📨 Email gönderiliyor: ${email}...`);
        const response = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: email, ...template })
        });
        
        if (response.ok) {
          successCount++;
          console.log(`✅ Email başarıyla gönderildi: ${email}`);
        } else {
          failedCount++;
          console.error(`❌ Email gönderilemedi: ${email}`);
        }
      } catch (error) {
        failedCount++;
        console.error(`❌ Email gönderim hatası: ${email}`, error);
      }
    }

    console.log(`📊 Email gönderim sonucu: ${successCount} başarılı, ${failedCount} başarısız`);
    return { success: successCount, failed: failedCount };
  }

  // Send notification when new purchase request is created (Push + Email)
  static async notifyNewPurchaseRequest(
    requestId: string, 
    requestTitle: string, 
    requestNumber: string,
    requesterName: string,
    siteId?: string,
    siteName?: string,
    creatorRole?: string
  ) {
    console.log(`📧 Yeni talep bildirimi gönderiliyor: ${requestNumber}`);
    console.log(`🔍 Site ID: ${siteId || 'YOK'}, Site Name: ${siteName || 'YOK'}, Creator Role: ${creatorRole || 'YOK'}`);

    const pushPayload = {
      title: 'Yeni Satın Alma Talebi',
      body: `"${requestTitle}" adlı yeni bir talep oluşturuldu`,
      data: {
        type: 'new_request',
        requestId,
        url: `/dashboard/requests/${requestId}`
      },
      roles: ['admin', 'manager', 'supervisor'],
      siteId
    };

    const emailPayload = {
      type: 'new_request',
      roles: ['admin', 'manager', 'supervisor'],
      siteId,
      data: {
        requestTitle,
        requestNumber,
        requesterName,
        siteName,
        requestId
      }
    };

    // Direkt email gönder (ilgili rollerdeki kullanıcılara)
    let userEmails = await this.getUserEmailsByRoles(['admin', 'manager', 'supervisor'], siteId);
    console.log(`📧 Admin/Manager/Supervisor emailler: ${userEmails.join(', ') || 'YOK'}`);

    // Department head talep oluşturduğunda site_manager'a bildirim gönderme
    // Not: "Ana depoda yok" durumunda notifySiteManagerDepotUnavailable ayrıca çağrılacak
    if (siteId && creatorRole !== 'department_head') {
      console.log(`🏗️ Site ID: ${siteId}, site_manager emailleri ekleniyor...`);
      const siteManagerEmails = await this.getUserEmailsByRoles(['site_manager'], siteId);
      console.log(`📧 Site manager emailler: ${siteManagerEmails.join(', ') || 'YOK'}`);
      userEmails = [...userEmails, ...siteManagerEmails];
    } else if (siteId && creatorRole === 'department_head') {
      console.log(`⚠️ Department head talebi - site_manager bildirimi atlandı (ana depoda yok durumunda ayrıca gönderilecek)`);
    }

    // Genel Merkez Ofisi talebi: depo yöneticilerine de e-posta (site filtreli profil olmasa da merkez talebi)
    if (siteId === SPECIAL_SITE_ID) {
      const wmEmails = await this.getUserEmailsByRoles(['warehouse_manager']);
      console.log(`📧 Genel Merkez — warehouse_manager emailler: ${wmEmails.join(', ') || 'YOK'}`);
      userEmails = [...userEmails, ...wmEmails];
    }

    userEmails = [...new Set(userEmails)];
    
    if (userEmails.length > 0) {
      const template = {
        subject: `Yeni Satın Alma Talebi: ${requestNumber}`,
        html: `<p><strong>${requestNumber}</strong> - ${requestTitle}</p><p>Talep eden: ${requesterName}</p><p>Site: ${siteName || 'Belirtilmemiş'}</p>`,
        text: `Yeni Talep: ${requestNumber} - ${requestTitle}. Talep eden: ${requesterName}. Site: ${siteName || 'Belirtilmemiş'}`
      };

      const emailResult = await this.sendDirectEmails(userEmails, template);
      console.log(`✅ Email gönderildi: ${emailResult.success} başarılı, ${emailResult.failed} başarısız`);
      
      return { 
        push: { success: false, error: 'Push notification disabled' }, 
        email: { success: emailResult.success > 0, error: emailResult.failed > 0 ? 'Some emails failed' : null } 
      };
    } else {
      console.log(`⚠️ Email gönderilemedi: Alıcı bulunamadı`);
      return { 
        push: { success: false, error: 'Push notification disabled' }, 
        email: { success: false, error: 'No recipients found' } 
      };
    }
  }

  // Send notification when request status changes (Push + Email)
  static async notifyRequestStatusChange(
    requestId: string, 
    requestTitle: string, 
    requestNumber: string,
    oldStatus: string,
    newStatus: string,
    comment?: string,
    userId?: string
  ) {
    let title = 'Talep Durumu Güncellendi';
    let body = `"${requestTitle}" talebi ${newStatus} olarak güncellendi`;

    if (newStatus === 'approved') {
      title = 'Talep Onaylandı ✅';
      body = `"${requestTitle}" talebi onaylandı`;
    } else if (newStatus === 'rejected') {
      title = 'Talep Reddedildi ❌';
      body = `"${requestTitle}" talebi reddedildi`;
    }

    console.log(`📧 Durum değişikliği bildirimi: ${requestNumber} - ${newStatus}`);

    const pushPayload = {
      title,
      body,
      data: {
        type: 'status_change',
        requestId,
        status: newStatus,
        url: `/dashboard/requests/${requestId}`
      },
      userIds: userId ? [userId] : undefined,
      roles: userId ? undefined : ['admin', 'manager']
    };

    const emailPayload = {
      type: 'status_change',
      userIds: userId ? [userId] : undefined,
      roles: userId ? undefined : ['admin', 'manager'],
      data: {
        requestTitle,
        requestNumber,
        oldStatus,
        newStatus,
        comment,
        requestId
      }
    };

    // Direkt email gönder
    const userEmails = userId 
      ? await this.getUserEmails([userId])
      : await this.getUserEmailsByRoles(['admin', 'manager']);
    
    if (userEmails.length > 0) {
      const template = {
        subject: `Talep Durumu Güncellendi: ${requestNumber}`,
        html: `<p><strong>${requestNumber}</strong> - ${requestTitle}</p><p>Durum: ${oldStatus} → ${newStatus}</p>${comment ? `<p>Yorum: ${comment}</p>` : ''}`,
        text: `Talep ${requestNumber} durumu ${oldStatus} → ${newStatus} olarak güncellendi.${comment ? ` Yorum: ${comment}` : ''}`
      };

      const emailResult = await this.sendDirectEmails(userEmails, template);
      console.log(`✅ Email gönderildi: ${emailResult.success} başarılı, ${emailResult.failed} başarısız`);
    }

    return this.sendCombinedNotification(pushPayload, emailPayload);
  }

  // Send notification when new offer is received (Push + Email)
  static async notifyNewOffer(
    requestId: string, 
    requestTitle: string, 
    requestNumber: string,
    supplierName: string,
    offerAmount?: number,
    currency?: string,
    userId?: string
  ) {
    console.log(`📧 Yeni teklif bildirimi: ${requestNumber} - ${supplierName}`);

    const pushPayload = {
      title: 'Yeni Teklif Alındı',
      body: `"${requestTitle}" talebi için ${supplierName} firmasından teklif geldi`,
      data: {
        type: 'new_offer',
        requestId,
        url: `/dashboard/requests/${requestId}/offers`
      },
      userIds: userId ? [userId] : undefined,
      roles: userId ? undefined : ['admin', 'manager']
    };

    const emailPayload = {
      type: 'new_offer',
      userIds: userId ? [userId] : undefined,
      roles: userId ? undefined : ['admin', 'manager'],
      data: {
        requestTitle,
        requestNumber,
        supplierName,
        offerAmount,
        currency,
        requestId
      }
    };

    // Direkt email gönder
    const userEmails = userId 
      ? await this.getUserEmails([userId])
      : await this.getUserEmailsByRoles(['admin', 'manager']);
    
    if (userEmails.length > 0) {
      const template = {
        subject: `Yeni Teklif: ${requestNumber}`,
        html: `<p><strong>${requestNumber}</strong> - ${requestTitle}</p><p>Tedarikçi: ${supplierName}</p>${offerAmount ? `<p>Tutar: ${offerAmount} ${currency || 'TRY'}</p>` : ''}`,
        text: `Yeni Teklif: ${requestNumber} - ${requestTitle}. Tedarikçi: ${supplierName}.${offerAmount ? ` Tutar: ${offerAmount} ${currency || 'TRY'}` : ''}`
      };

      const emailResult = await this.sendDirectEmails(userEmails, template);
      console.log(`✅ Email gönderildi: ${emailResult.success} başarılı, ${emailResult.failed} başarısız`);
    }

    return this.sendCombinedNotification(pushPayload, emailPayload);
  }

  // Send notification when offer is accepted/rejected
  static async notifyOfferDecision(
    requestId: string,
    requestTitle: string,
    supplierName: string,
    decision: 'accepted' | 'rejected',
    userId?: string
  ) {
    const title = decision === 'accepted' ? 'Teklif Kabul Edildi ✅' : 'Teklif Reddedildi ❌';
    const body = `"${requestTitle}" talebi için ${supplierName} firmasının teklifi ${decision === 'accepted' ? 'kabul edildi' : 'reddedildi'}`;

    return this.sendNotification({
      title,
      body,
      data: {
        type: 'offer_decision',
        requestId,
        decision,
        url: `/dashboard/requests/${requestId}/offers`
      },
      userIds: userId ? [userId] : undefined
    });
  }

  // Send notification to specific users
  static async notifyUsers(userIds: string[], title: string, body: string, data?: any) {
    return this.sendNotification({
      title,
      body,
      data: {
        type: 'custom',
        ...data
      },
      userIds
    });
  }

  // Send notification to users with specific roles
  static async notifyByRole(roles: string[], title: string, body: string, data?: any, siteId?: string) {
    return this.sendNotification({
      title,
      body,
      data: {
        type: 'role_based',
        ...data
      },
      roles,
      siteId
    });
  }

  // Send notification to all users of a site
  static async notifySite(siteId: string, title: string, body: string, data?: any) {
    return this.sendNotification({
      title,
      body,
      data: {
        type: 'site_wide',
        ...data
      },
      siteId
    });
  }

  /**
   * Site manager'a "Ana Depoda Yok" bildirimi gönder
   * Satın almaya gönderilmesi beklenen talep var
   */
  static async notifySiteManagerDepotUnavailable(
    requestId: string,
    requestNumber: string,
    requestTitle: string,
    siteId: string,
    siteName?: string
  ): Promise<void> {
    try {
      const supabase = createClient()
      
      console.log(`📧 Ana depoda yok bildirimi gönderiliyor: ${requestNumber} -> Site: ${siteName || siteId}`)
      
      // Site'a ait site_manager'ları bul
      const { data: siteManagers, error: managersError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'site_manager')
        .contains('site_id', [siteId])
        .eq('is_active', true)

      if (managersError) {
        console.error('❌ Site manager sorgu hatası:', managersError)
        return
      }

      if (!siteManagers || siteManagers.length === 0) {
        console.warn(`⚠️ ${siteName || siteId} için aktif site_manager bulunamadı`)
        return
      }

      console.log(`📧 ${siteManagers.length} site_manager'a bildirim gönderiliyor...`)

      // Her site_manager'a in-app notification gönder
      for (const manager of siteManagers) {
        await supabase.from('notifications').insert({
          user_id: manager.id,
          title: 'Yönetici onayı bekleniyor',
          message: `${requestNumber} satın almaya gönderilmeyi bekliyor`,
          type: 'depot_unavailable',
          reference_type: 'purchase_request',
          reference_id: requestId,
          is_read: false
        })
      }
      console.log(`✉️ ${siteManagers.length} site_manager'a in-app bildirim gönderildi`)

      // Push notification gönder - sadece 1 kez, kısa mesaj
      const managerUserIds = siteManagers.map(m => m.id)
      if (managerUserIds.length > 0) {
        const pushPayload = {
          title: 'Yönetici onayı bekleniyor',
          body: `${requestNumber} satın almaya gönderilmeyi bekliyor`,
          data: {
            type: 'depot_unavailable',
            requestId,
            url: `/dashboard/requests/${requestId}`
          },
          userIds: managerUserIds
        }

        try {
          await this.sendNotification(pushPayload)
          console.log(`✅ Push notification gönderildi (${managerUserIds.length} kullanıcı)`)
        } catch (pushError) {
          console.error('❌ Push notification hatası:', pushError)
        }
      }

      // Email bildirimi gönder
      const managerEmails = siteManagers.map(m => m.email).filter(Boolean)
      if (managerEmails.length > 0) {
        const template = {
          subject: `Yönetici onayı bekleniyor - ${requestNumber}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #111827; padding: 20px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 18px;">Yönetici Onayı Bekleniyor</h1>
              </div>
              <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #374151; margin: 0 0 15px 0;">
                  <strong>${requestNumber}</strong> satın almaya gönderilmeyi bekliyor.
                </p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/dashboard/requests/${requestId}" 
                   style="display: inline-block; background: #01E884; color: #111827; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Talebi İncele
                </a>
              </div>
            </div>
          `,
          text: `Yönetici Onayı Bekleniyor\n\n${requestNumber} satın almaya gönderilmeyi bekliyor.`
        }

        const emailResult = await this.sendDirectEmails(managerEmails, template)
        console.log(`✅ Email gönderildi: ${emailResult.success} başarılı, ${emailResult.failed} başarısız`)
      }

      console.log(`✅ Ana depoda yok bildirimleri tamamlandı`)
    } catch (error) {
      console.error('❌ notifySiteManagerDepotUnavailable hatası:', error)
    }
  }

  /**
   * GMO department head'lerine departman bazlı bildirim gönder
   * @param requestId - Purchase request ID
   * @param department - Departman adı (Marketing, IT, HR, vb.)
   */
  static async notifyDepartmentHeadForApproval(requestId: string, department: string): Promise<void> {
    try {
      const supabase = createClient()
      const GMO_SITE_ID = '18e8e316-1291-429d-a591-5cec97d235b7'
      
      console.log(`📧 Department head bildirimi gönderiliyor: ${department} departmanı için request ${requestId}`)
      
      // Belirtilen departmandaki department_head kullanıcılarını bul
      const { data: departmentHeads, error: headsError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'department_head')
        .contains('site_id', [GMO_SITE_ID])
        .eq('department', department)
        .eq('is_active', true)

      if (headsError) {
        console.error('❌ Department head sorgu hatası:', headsError)
        return
      }

      if (!departmentHeads || departmentHeads.length === 0) {
        console.warn(`⚠️ ${department} departmanında aktif department_head bulunamadı`)
        return
      }

      console.log(`📧 ${department} departmanı için ${departmentHeads.length} department_head'e bildirim gönderiliyor...`)

      // Talep detaylarını al
      const { data: request } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          profiles:requested_by (full_name, email)
        `)
        .eq('id', requestId)
        .single()

      if (!request) {
        console.error('❌ Talep bulunamadı:', requestId)
        return
      }

      // Her department_head'e bildirim gönder
      for (const head of departmentHeads) {
        // In-app notification
        await supabase.from('notifications').insert({
          user_id: head.id,
          title: `Yeni Talep Onayınızı Bekliyor (${department})`,
          message: `${request.profiles?.full_name || 'Bir kullanıcı'} tarafından ${request.request_number} numaralı talep oluşturuldu. Departman onayınız bekleniyor.`,
          type: 'approval_required',
          reference_type: 'purchase_request',
          reference_id: requestId,
          is_read: false
        })

        console.log(`✉️ ${head.full_name || head.email} - bildirim gönderildi`)
      }

      console.log(`✅ ${department} departmanı için ${departmentHeads.length} bildirim gönderildi`)
    } catch (error) {
      console.error('❌ notifyDepartmentHeadForApproval hatası:', error)
    }
  }
}
