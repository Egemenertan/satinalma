'use server'

import { createClient } from './supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export interface User {
  id: string
  name: string
  email: string
  role: 'engineer' | 'chief' | 'approver'
}

// Simple password verification (gerçek projede bcrypt kullanın)
function verifyPassword(inputPassword: string, storedPassword: string): boolean {
  // Demo için basit kontrol - gerçek projede hash karşılaştırması yapın
  return inputPassword === storedPassword.replace('hashed_', '')
}

export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const supabase = createClient()
    
    // users tablosundan kullanıcıyı bul
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, password')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      return { success: false, error: 'Email veya şifre hatalı' }
    }

    // Şifre kontrolü
    if (!verifyPassword(password, user.password)) {
      return { success: false, error: 'Email veya şifre hatalı' }
    }

    // Session oluştur (cookie'de user bilgilerini sakla)
    const cookieStore = cookies()
    const sessionData = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }

    cookieStore.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 gün
    })

    return { 
      success: true, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  } catch (error) {
    console.error('Sign in error:', error)
    return { success: false, error: 'Giriş yapılırken bir hata oluştu' }
  }
}

export async function getUser(): Promise<User | null> {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get('session')
    
    if (!sessionCookie) {
      return null
    }

    const sessionData = JSON.parse(sessionCookie.value)
    return sessionData
  } catch {
    return null
  }
}

export async function signOut() {
  const cookieStore = cookies()
  cookieStore.delete('session')
  redirect('/auth/login')
}

export async function requireAuth(): Promise<User> {
  const user = await getUser()
  if (!user) {
    redirect('/auth/login')
  }
  return user
}

export async function checkRole(userRole: string, allowedRoles: string[]): Promise<boolean> {
  return allowedRoles.includes(userRole)
}
