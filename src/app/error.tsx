'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error tracking service (Sentry, etc.) in production
    if (process.env.NODE_ENV === 'production') {
      // Production: Log error digest only (no stack trace)
      console.error('Error digest:', error.digest)
    } else {
      // Development: Full error details
      console.error('Error details:', error)
    }
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Bir Hata Oluştu
        </h1>
        
        <p className="text-gray-600 mb-6">
          {process.env.NODE_ENV === 'development' 
            ? error.message 
            : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'}
        </p>
        
        {process.env.NODE_ENV === 'development' && error.digest && (
          <p className="text-xs text-gray-500 mb-4">
            Error ID: {error.digest}
          </p>
        )}
        
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => reset()}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Tekrar Dene
          </Button>
          
          <Button
            onClick={() => window.location.href = '/dashboard'}
            variant="outline"
            className="px-6 py-2"
          >
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    </div>
  )
}
