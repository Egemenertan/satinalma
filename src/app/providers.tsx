'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { SWRConfig } from 'swr'
import { queryClient } from '@/lib/react-query'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          dedupingInterval: 10_000,
          errorRetryCount: 2,
        }}
      >
        {children}
      </SWRConfig>
    </QueryClientProvider>
  )
}






















