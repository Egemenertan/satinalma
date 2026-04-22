'use client'

import { useState, useEffect } from 'react'
import { app } from '@microsoft/teams-js'
import { 
  initializeTeams, 
  isInTeamsEnvironment, 
  getTeamsContext,
  isTeamsInitialized 
} from './teams-context'

type TeamsAppContext = Awaited<ReturnType<typeof app.getContext>>

export interface UseTeamsResult {
  isInTeams: boolean
  isLoading: boolean
  context: TeamsAppContext | null
  error: Error | null
}

export function useTeams(): UseTeamsResult {
  const [isInTeams, setIsInTeams] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [context, setContext] = useState<TeamsAppContext | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      if (isTeamsInitialized()) {
        if (mounted) {
          setIsInTeams(true)
          setContext(getTeamsContext())
          setIsLoading(false)
        }
        return
      }

      if (!isInTeamsEnvironment()) {
        if (mounted) {
          setIsInTeams(false)
          setIsLoading(false)
        }
        return
      }

      try {
        const success = await initializeTeams()
        
        if (mounted) {
          setIsInTeams(success)
          setContext(success ? getTeamsContext() : null)
          setIsLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Teams başlatma hatası'))
          setIsInTeams(false)
          setIsLoading(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  return { isInTeams, isLoading, context, error }
}
