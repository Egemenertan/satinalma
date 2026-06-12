import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type AppleNotificationEvent = {
  type: 'email-disabled' | 'email-enabled' | 'consent-revoked' | 'account-delete'
  sub: string // Apple user ID
  email?: string
  is_private_email?: boolean
  event_time: number
}

type AppleNotificationPayload = {
  iss: string
  aud: string
  iat: number
  jti: string
  events: string // JSON string of AppleNotificationEvent
}

/**
 * Apple Sign In Server-to-Server Notifications Endpoint
 * 
 * Receives notifications when:
 * - User changes email forwarding preferences (email-disabled, email-enabled)
 * - User revokes consent / deletes app from their Apple ID (consent-revoked)
 * - User permanently deletes their Apple Account (account-delete)
 * 
 * @see https://developer.apple.com/documentation/sign_in_with_apple/processing_changes_for_sign_in_with_apple_accounts
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const payload = formData.get('payload') as string

    if (!payload) {
      console.error('[Apple Notifications] No payload received')
      return NextResponse.json({ error: 'No payload' }, { status: 400 })
    }

    // Decode JWT (Apple sends a signed JWT)
    // In production, you should verify the signature using Apple's public keys
    const decoded = jwt.decode(payload) as AppleNotificationPayload | null

    if (!decoded) {
      console.error('[Apple Notifications] Invalid JWT payload')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const events: AppleNotificationEvent = JSON.parse(decoded.events)
    
    console.log('[Apple Notifications] Received event:', {
      type: events.type,
      sub: events.sub,
      event_time: new Date(events.event_time * 1000).toISOString(),
    })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    switch (events.type) {
      case 'consent-revoked':
      case 'account-delete': {
        // User revoked access or deleted their Apple account
        // Find user by Apple ID (stored in auth.users.raw_app_meta_data.provider_id)
        // and deactivate their account
        
        const { data: usersData } = await supabase.auth.admin.listUsers()
        const usersList = usersData?.users ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const appleUser = usersList.find((u: any) => 
          u.app_metadata?.provider === 'apple' && 
          u.app_metadata?.providers?.includes('apple') &&
          u.identities?.some((i: any) => i.provider === 'apple' && i.id === events.sub)
        )

        if (appleUser) {
          // Soft delete the profile
          await supabase
            .from('profiles')
            .update({ 
              is_active: false, 
              deleted_at: new Date().toISOString() 
            })
            .eq('id', appleUser.id)

          console.log('[Apple Notifications] Deactivated user:', appleUser.id)
        } else {
          console.log('[Apple Notifications] User not found for Apple ID:', events.sub)
        }
        break
      }

      case 'email-disabled':
      case 'email-enabled': {
        // User changed email forwarding preferences
        // Log for reference, no action needed
        console.log('[Apple Notifications] Email forwarding changed:', events.type)
        break
      }

      default:
        console.log('[Apple Notifications] Unknown event type:', events.type)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Apple Notifications] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Apple may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'apple-notifications' })
}
