import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import webpush from 'web-push';

// VAPID setup - only if keys are available
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
  subject: process.env.VAPID_EMAIL || 'mailto:test@example.com'
};

// Only set VAPID details if keys are provided
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    vapidKeys.subject,
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ success: number; failed: number }> {
  if (tokens.length === 0) return { success: 0, failed: 0 };

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: { ...data, timestamp: new Date().toISOString() },
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('Expo Push API error:', response.status, await response.text());
      return { success: 0, failed: tokens.length };
    }

    const result = await response.json();
    const successCount = result.data?.filter((r: { status: string }) => r.status === 'ok').length ?? 0;
    const failedCount = tokens.length - successCount;

    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error('Expo Push API request failed:', error);
    return { success: 0, failed: tokens.length };
  }
}

interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
  /** Ana ekran / PWA ikon rozeti (Badging API). Verilmezse istemci tarafında +1 yapılır. */
  badgeCount?: number;
  userIds?: string[]; // Specific users to send to
  roles?: string[]; // Send to users with specific roles
  siteId?: string; // Send to users of a specific site
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user and verify admin/manager role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to send notifications
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const payload: NotificationPayload = await request.json();

    if (!payload.title || !payload.body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    const results = {
      web: { success: 0, failed: 0, total: 0 },
      expo: { success: 0, failed: 0, total: 0 },
    };

    // ====== 1. WEB PUSH (PWA) ======
    if (vapidKeys.publicKey && vapidKeys.privateKey) {
      let webQuery = supabase
        .from('push_subscriptions')
        .select(`
          subscription,
          user_id,
          profiles!inner(role, site_id)
        `);

      if (payload.userIds && payload.userIds.length > 0) {
        webQuery = webQuery.in('user_id', payload.userIds);
      }
      if (payload.roles && payload.roles.length > 0) {
        webQuery = webQuery.in('profiles.role', payload.roles);
      }
      if (payload.siteId) {
        webQuery = webQuery.eq('profiles.site_id', payload.siteId);
      }

      const { data: webSubscriptions } = await webQuery;

      if (webSubscriptions && webSubscriptions.length > 0) {
        results.web.total = webSubscriptions.length;

        const notificationPayload = JSON.stringify({
          title: payload.title,
          body: payload.body,
          ...(typeof payload.badgeCount === 'number' ? { badgeCount: payload.badgeCount } : {}),
          data: { ...payload.data, timestamp: new Date().toISOString() },
        });

        const webPromises = webSubscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(sub.subscription, notificationPayload);
            return true;
          } catch (error) {
            console.error('Web push failed for user:', sub.user_id, error);
            return false;
          }
        });

        const webResults = await Promise.all(webPromises);
        results.web.success = webResults.filter(Boolean).length;
        results.web.failed = results.web.total - results.web.success;
      }
    }

    // ====== 2. EXPO PUSH (Mobile) ======
    let expoQuery = supabase.from('expo_push_tokens').select('expo_push_token, user_id');

    if (payload.userIds && payload.userIds.length > 0) {
      expoQuery = expoQuery.in('user_id', payload.userIds);
    } else if (payload.roles && payload.roles.length > 0) {
      // roles veya siteId varsa, önce hedef user_id'leri bul
      let profileQuery = supabase.from('profiles').select('id').in('role', payload.roles);
      if (payload.siteId) {
        profileQuery = profileQuery.eq('site_id', payload.siteId);
      }
      const { data: targetProfiles } = await profileQuery;
      const targetUserIds = targetProfiles?.map((p) => p.id) ?? [];
      if (targetUserIds.length > 0) {
        expoQuery = expoQuery.in('user_id', targetUserIds);
      } else {
        expoQuery = expoQuery.eq('user_id', '00000000-0000-0000-0000-000000000000'); // no match
      }
    } else if (payload.siteId) {
      const { data: siteProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('site_id', payload.siteId);
      const siteUserIds = siteProfiles?.map((p) => p.id) ?? [];
      if (siteUserIds.length > 0) {
        expoQuery = expoQuery.in('user_id', siteUserIds);
      } else {
        expoQuery = expoQuery.eq('user_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: expoTokens } = await expoQuery;

    if (expoTokens && expoTokens.length > 0) {
      const tokens = expoTokens.map((t) => t.expo_push_token).filter(Boolean);
      results.expo.total = tokens.length;

      if (tokens.length > 0) {
        const expoResult = await sendExpoPushNotifications(
          tokens,
          payload.title,
          payload.body,
          payload.data
        );
        results.expo.success = expoResult.success;
        results.expo.failed = expoResult.failed;
      }
    }

    const totalSuccess = results.web.success + results.expo.success;
    const totalTarget = results.web.total + results.expo.total;

    if (totalTarget === 0) {
      return NextResponse.json({ error: 'No target users found' }, { status: 404 });
    }

    // Log notification for analytics/history (optional, ignore errors)
    try {
      await supabase
        .from('notification_logs')
        .insert({
          sent_by: user.id,
          title: payload.title,
          body: payload.body,
          target_count: totalTarget,
          success_count: totalSuccess,
          payload: payload.data,
        });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json({
      message: `${totalSuccess}/${totalTarget} bildirim gönderildi`,
      web: results.web,
      expo: results.expo,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
