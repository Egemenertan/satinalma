import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import webpush from 'web-push';

// VAPID setup
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
  subject: process.env.VAPID_EMAIL || 'mailto:test@example.com'
};

webpush.setVapidDetails(
  vapidKeys.subject,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
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

    // Build query to get target users
    let query = supabase
      .from('push_subscriptions')
      .select(`
        subscription,
        user_id,
        profiles!inner(role, site_id)
      `);

    // Filter by specific user IDs
    if (payload.userIds && payload.userIds.length > 0) {
      query = query.in('user_id', payload.userIds);
    }

    // Filter by roles
    if (payload.roles && payload.roles.length > 0) {
      query = query.in('profiles.role', payload.roles);
    }

    // Filter by site
    if (payload.siteId) {
      query = query.eq('profiles.site_id', payload.siteId);
    }

    const { data: subscriptions, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No target users found' },
        { status: 404 }
      );
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: {
        ...payload.data,
        timestamp: new Date().toISOString()
      }
    });

    // Send notifications
    const promises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, notificationPayload);
        return { success: true, userId: sub.user_id };
      } catch (error) {
        console.error('Failed to send notification to user:', sub.user_id, error);
        return { success: false, userId: sub.user_id, error };
      }
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;

    // Log notification for analytics/history
    await supabase
      .from('notification_logs')
      .insert({
        sent_by: user.id,
        title: payload.title,
        body: payload.body,
        target_count: subscriptions.length,
        success_count: successCount,
        payload: payload.data
      });

    return NextResponse.json({
      message: `${successCount}/${subscriptions.length} bildirim gönderildi`,
      results: results.map(r => ({ success: r.success, userId: r.userId }))
    });

  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
