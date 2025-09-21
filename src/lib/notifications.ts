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

  // Send notification when new purchase request is created (Push + Email)
  static async notifyNewPurchaseRequest(
    requestId: string, 
    requestTitle: string, 
    requestNumber: string,
    requesterName: string,
    siteId?: string,
    siteName?: string
  ) {
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

    return this.sendCombinedNotification(pushPayload, emailPayload);
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
}
