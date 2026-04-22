'use client'

import { app, authentication } from '@microsoft/teams-js'

type TeamsAppContext = Awaited<ReturnType<typeof app.getContext>>

export interface TeamsContext {
  isInTeams: boolean
  context: TeamsAppContext | null
  isInitialized: boolean
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

  initPromise = new Promise(async (resolve) => {
    try {
      console.log('🔷 Teams SDK başlatılıyor...')
      
      await app.initialize()
      teamsInitialized = true
      
      const context = await app.getContext()
      teamsContext = context
      
      console.log('✅ Teams SDK başlatıldı')
      console.log('📍 Teams Context:', {
        hostName: context.app.host.name,
        frameContext: context.page.frameContext,
        userPrincipalName: context.user?.userPrincipalName,
        tenantId: context.user?.tenant?.id,
      })
      
      resolve(true)
    } catch (error) {
      console.log('ℹ️ Teams ortamında değil veya SDK başlatılamadı:', error)
      teamsInitialized = false
      teamsContext = null
      resolve(false)
    }
  })

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

export async function teamsAuthenticate(
  url: string,
  width: number = 600,
  height: number = 535
): Promise<string> {
  if (!teamsInitialized) {
    throw new Error('Teams SDK başlatılmamış')
  }

  return new Promise((resolve, reject) => {
    authentication.authenticate({
      url,
      width,
      height,
      successCallback: (result) => {
        console.log('✅ Teams authentication başarılı')
        resolve(result || '')
      },
      failureCallback: (reason) => {
        console.error('❌ Teams authentication başarısız:', reason)
        reject(new Error(reason))
      }
    } as authentication.AuthenticateParameters)
  })
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
