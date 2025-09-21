import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import EmailService from '@/lib/email';

interface EmailRequest {
  type: 'new_request' | 'status_change' | 'new_offer' | 'custom';
  recipients?: string[]; // Specific email addresses
  userIds?: string[]; // Specific user IDs
  roles?: string[]; // Send to users with specific roles
  siteId?: string; // Send to users of a specific site
  data: {
    // For new_request
    requestTitle?: string;
    requestNumber?: string;
    requesterName?: string;
    siteName?: string;
    requestId?: string;
    
    // For status_change
    oldStatus?: string;
    newStatus?: string;
    comment?: string;
    
    // For new_offer
    supplierName?: string;
    offerAmount?: number;
    currency?: string;
    
    // For custom
    subject?: string;
    content?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has permission to send emails
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'manager', 'system'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const emailRequest: EmailRequest = await request.json();

    if (!emailRequest.type) {
      return NextResponse.json(
        { error: 'Email type is required' },
        { status: 400 }
      );
    }

    // Get target users' email addresses
    let targetEmails: string[] = [];

    if (emailRequest.recipients) {
      // Direct email addresses provided
      targetEmails = emailRequest.recipients;
    } else {
      // Build query to get user emails
      let query = supabase
        .from('profiles')
        .select('email, email_notifications, full_name')
        .eq('email_notifications', true); // Only send to users who opted in

      // Filter by specific user IDs
      if (emailRequest.userIds && emailRequest.userIds.length > 0) {
        query = query.in('id', emailRequest.userIds);
      }

      // Filter by roles
      if (emailRequest.roles && emailRequest.roles.length > 0) {
        query = query.in('role', emailRequest.roles);
      }

      // Filter by site
      if (emailRequest.siteId) {
        query = query.eq('site_id', emailRequest.siteId);
      }

      const { data: users, error: dbError } = await query;

      if (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        );
      }

      targetEmails = users?.map(user => user.email).filter(Boolean) || [];
    }

    if (targetEmails.length === 0) {
      return NextResponse.json(
        { error: 'No target users found or all users have disabled email notifications' },
        { status: 404 }
      );
    }

    // Create email service instance
    const emailService = new EmailService();

    // Generate email template based on type
    let template;
    const { data } = emailRequest;

    switch (emailRequest.type) {
      case 'new_request':
        if (!data.requestTitle || !data.requestNumber || !data.requesterName) {
          return NextResponse.json(
            { error: 'Missing required fields for new_request email' },
            { status: 400 }
          );
        }
        template = emailService.generateNewRequestTemplate(
          data.requestTitle,
          data.requestNumber,
          data.requesterName,
          data.siteName,
          data.requestId
        );
        break;

      case 'status_change':
        if (!data.requestTitle || !data.requestNumber || !data.newStatus) {
          return NextResponse.json(
            { error: 'Missing required fields for status_change email' },
            { status: 400 }
          );
        }
        template = emailService.generateStatusChangeTemplate(
          data.requestTitle,
          data.requestNumber,
          data.oldStatus || 'unknown',
          data.newStatus,
          data.comment,
          data.requestId
        );
        break;

      case 'new_offer':
        if (!data.requestTitle || !data.requestNumber || !data.supplierName) {
          return NextResponse.json(
            { error: 'Missing required fields for new_offer email' },
            { status: 400 }
          );
        }
        template = emailService.generateNewOfferTemplate(
          data.requestTitle,
          data.requestNumber,
          data.supplierName,
          data.offerAmount,
          data.currency,
          data.requestId
        );
        break;

      case 'custom':
        if (!data.subject || !data.content) {
          return NextResponse.json(
            { error: 'Missing required fields for custom email' },
            { status: 400 }
          );
        }
        template = {
          subject: data.subject,
          text: data.content,
          html: `<html><body><div style="font-family: sans-serif; padding: 20px;">${data.content.replace(/\n/g, '<br>')}</div></body></html>`
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        );
    }

    // Send emails to all recipients
    const results = await Promise.all(
      targetEmails.map(async (email) => {
        try {
          const result = await emailService.sendEmail(email, template);
          return { email, success: result.success, messageId: result.messageId, error: result.error };
        } catch (error) {
          return { email, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    // Log email for analytics/history
    await supabase
      .from('email_logs')
      .insert({
        sent_by: user.id,
        email_type: emailRequest.type,
        subject: template.subject,
        target_count: targetEmails.length,
        success_count: successCount,
        metadata: emailRequest.data
      });

    return NextResponse.json({
      message: `${successCount}/${targetEmails.length} e-posta gönderildi`,
      results: results.map(r => ({ email: r.email, success: r.success }))
    });

  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Test endpoint
export async function GET(request: NextRequest) {
  try {
    const emailService = new EmailService();
    const isConnected = await emailService.testConnection();
    
    return NextResponse.json({
      status: isConnected ? 'connected' : 'disconnected',
      service: process.env.NODE_ENV === 'production' ? 'SMTP' : 'Ethereal Email (test)'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Email service test failed' },
      { status: 500 }
    );
  }
}
