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

export async function POST(request: NextRequest) {
  // GÜVENLİK: Production'da endpoint'i kapat
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    // Check if VAPID keys are configured
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
      return NextResponse.json(
        { error: 'Push notifications are not configured. Please set VAPID keys in environment variables.' },
        { status: 503 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No push subscriptions found' },
        { status: 404 }
      );
    }

    // Send test notification to all user subscriptions
    const payload = JSON.stringify({
      title: 'Test Bildirimi 🔔',
      body: 'Push bildirimler masaüstünde ve mobilde çalışıyor! 🎉',
      data: {
        url: '/dashboard',
        type: 'test',
        badge: '/favicon-16x16.ico',
        sound: 'default'
      }
    });

    const promises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        return { success: true };
      } catch (error) {
        console.error('Failed to send notification:', error);
        return { success: false, error };
      }
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      message: `${successCount}/${subscriptions.length} bildirim gönderildi`,
      results
    });

  } catch (error) {
    console.error('Test notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
