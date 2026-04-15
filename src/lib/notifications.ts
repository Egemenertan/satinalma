import { createClient } from './supabase/server';
import EmailService from './email';

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

  // Helper: Send direct email to specific users
  private static async sendDirectEmails(
    userEmails: string[],
    template: { subject: string; html: string; text: string }
  ): Promise<{ success: number; failed: number }> {
    console.log(`📤 sendDirectEmails başlatıldı, ${userEmails.length} alıcı`);
    console.log(`📧 Alıcılar: ${userEmails.join(', ')}`);
    
    const emailService = new EmailService();
    let successCount = 0;
    let failedCount = 0;

    for (const email of userEmails) {
      try {
        console.log(`📨 Email gönderiliyor: ${email}...`);
        const result = await emailService.sendEmail(email, template);
        if (result.success) {
          successCount++;
          console.log(`✅ Email başarıyla gönderildi: ${email}`);
        } else {
          failedCount++;
          console.error(`❌ Email gönderilemedi: ${email}`, result.error);
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
    siteName?: string
  ) {
    console.log(`📧 Yeni talep bildirimi gönderiliyor: ${requestNumber}`);
    console.log(`🔍 Site ID: ${siteId || 'YOK'}, Site Name: ${siteName || 'YOK'}`);

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
    
    // Eğer siteId varsa, site_manager rolündeki kullanıcılara da email gönder
    if (siteId) {
      console.log(`🏗️ Site ID bulundu: ${siteId}, site_manager rolündeki kullanıcılara email gönderiliyor...`);
      const siteManagerEmails = await this.getUserEmailsByRoles(['site_manager'], siteId);
      console.log(`📧 Site manager emailler: ${siteManagerEmails.join(', ') || 'YOK'}`);
      
      // Test için şimdilik her iki email adresine de gönder
      const testEmails = ['egemen.ertan@dovecgroup.com', 'ertanegemenyusuf@gmail.com'];
      console.log(`🧪 TEST MODU: ${testEmails.join(', ')} adreslerine email gönderiliyor...`);
      userEmails = testEmails;
      
      // Gerçek kullanıma geçildiğinde bu satırları aktif et:
      // userEmails = [...userEmails, ...siteManagerEmails];
      // userEmails = [...new Set(userEmails)]; // Tekrarları kaldır
    }
    
    if (userEmails.length > 0) {
      const emailService = new EmailService();
      const template = emailService.generateNewRequestTemplate(
        requestTitle,
        requestNumber,
        requesterName,
        siteName,
        requestId
      );

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
      const emailService = new EmailService();
      const template = emailService.generateStatusChangeTemplate(
        requestTitle,
        requestNumber,
        oldStatus,
        newStatus,
        comment,
        requestId
      );

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
      const emailService = new EmailService();
      const template = emailService.generateNewOfferTemplate(
        requestTitle,
        requestNumber,
        supplierName,
        offerAmount,
        currency,
        requestId
      );

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
