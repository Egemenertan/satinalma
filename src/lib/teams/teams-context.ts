'use client'

import { app, authentication } from '@microsoft/teams-js'

type TeamsAppContext = Awaited<ReturnType<typeof app.getContext>>

export interface TeamsContext {
  isInTeams: boolean
  context: TeamsAppContext | null
  isInitialized: boolean
}

/**
 * Teams popup callback'i tarafından geri döndürülen token paketi.
 * `authentication.notifySuccess(JSON.stringify(payload))` ile iletilir.
 */
export interface TeamsAuthTokenPayload {
  access_token: string
  refresh_token: string
  expires_at?: number
  user_email?: string
}

let teamsInitialized = false
let teamsContext: TeamsAppContext | null = null
let initPromise: Promise<boolean> | null = null

export async function initializeTeams(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  if (teamsInitialized) {
    return true
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      // SDK timeout - Teams ortamında değilsek 3 sn'de bırak
      await Promise.race([
        app.initialize(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Teams SDK timeout')), 3000)
        ),
      ])

      teamsInitialized = true

      try {
        teamsContext = await app.getContext()
      } catch {
        // Context alınamasa bile SDK initialize olmuş olabilir
        teamsContext = null
      }

      return true
    } catch (error) {
      teamsInitialized = false
      teamsContext = null
      // Sessiz fail: Teams/Outlook dışı normal tarayıcıda her zaman olacak
      return false
    }
  })()

  return initPromise
}

export function isInTeamsEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  const hasTeamsInURL = window.location.href.includes('teams.microsoft.com')
  const hasTeamsReferrer = document.referrer.includes('teams.microsoft.com')
  
  return hasTeamsInURL || hasTeamsReferrer || teamsInitialized
}

export function isInIframe(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function isInOfficeEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  const referrer = document.referrer.toLowerCase()
  const isOfficeReferrer = referrer.includes('office.com') || 
                           referrer.includes('office365.com') || 
                           referrer.includes('outlook.com') ||
                           referrer.includes('outlook.live.com')
  
  return isInIframe() && isOfficeReferrer
}

export function getTeamsContext(): TeamsAppContext | null {
  return teamsContext
}

export function isTeamsInitialized(): boolean {
  return teamsInitialized
}

/**
 * Teams/Outlook gömülü ortamında popup açıp OAuth akışı çalıştırır.
 * Popup, `authentication.notifySuccess(payloadString)` ile sonuç döner.
 *
 * @param url - Popup için açılacak URL (origin ile aynı, HTTPS olmalı)
 * @returns Popup'tan dönen string (genellikle JSON payload)
 */
export async function teamsAuthenticate(
  url: string,
  width: number = 600,
  height: number = 700
): Promise<string> {
  if (!teamsInitialized) {
    throw new Error('Teams SDK başlatılmamış')
  }

  // Teams SDK v2 promise-tabanlı API
  const result = await authentication.authenticate({
    url,
    width,
    height,
    isExternal: false,
  })

  return typeof result === 'string' ? result : ''
}

/**
 * Popup tarafından açıldıktan sonra Supabase OAuth callback'inden gelen
 * tokenleri parent window'a güvenli şekilde döndürür.
 */
export function teamsNotifyAuthSuccess(payload: TeamsAuthTokenPayload): void {
  authentication.notifySuccess(JSON.stringify(payload))
}

/**
 * Popup tarafında auth hatasını parent window'a iletir.
 */
export function teamsNotifyAuthFailure(reason: string): void {
  authentication.notifyFailure(reason)
}

export async function getTeamsSSOToken(): Promise<string> {
  if (!teamsInitialized) {
    throw new Error('Teams SDK başlatılmamış')
  }

  try {
    console.log('🔐 Teams SSO token alınıyor...')
    
    const token = await authentication.getAuthToken({
      resources: [`api://www.dovec.app/c3ee343a-b5dc-4ffa-9915-cffd6b8ce4b1`],
      silent: true
    })
    
    console.log('✅ Teams SSO token alındı')
    return token
  } catch (error) {
    console.error('❌ Teams SSO token alınamadı:', error)
    throw error
  }
}

export function popupAuthenticate(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    
    const popup = window.open(
      url,
      'auth-popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    )
    
    if (!popup) {
      console.error('❌ Popup engellenmiş olabilir')
      resolve(false)
      return
    }
    
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        console.log('✅ Auth popup kapatıldı')
        resolve(true)
      }
    }, 500)
    
    setTimeout(() => {
      clearInterval(checkClosed)
      if (!popup.closed) {
        popup.close()
      }
      resolve(false)
    }, 300000)
  })
}
