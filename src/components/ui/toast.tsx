'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
  onClose?: () => void
}

interface ToastContextValue {
  showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastState {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration: number
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastState[]>([])

  const showToast = React.useCallback((message: string, type: 'success' | 'error' | 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast = { id, message, type, duration }
    
    setToasts(prev => [...prev, toast])

    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: ToastState[]
  onRemove: (id: string) => void 
}) {
  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => onRemove(toast.id)}
          />
        ))}
      </div>
    </div>,
    document.body
  )
}

function Toast({ message, type, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 200) // Wait for animation
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-600" />
      case 'info':
        return <AlertCircle className="w-8 h-8 text-blue-600" />
    }
  }

  const getStyles = () => {
    const baseStyles = "bg-white border shadow-2xl backdrop-blur-lg"
    switch (type) {
      case 'success':
        return `${baseStyles} border-green-100 shadow-green-500/20`
      case 'error':
        return `${baseStyles} border-red-100 shadow-red-500/20`
      case 'info':
        return `${baseStyles} border-blue-100 shadow-blue-500/20`
    }
  }

  return (
    <div 
      className={cn(
        "pointer-events-auto transition-all duration-300 ease-out transform mb-4",
        "w-80 h-80 mx-auto", // Kare boyut
        isVisible 
          ? "translate-y-0 opacity-100 scale-100" 
          : "translate-y-4 opacity-0 scale-90"
      )}
    >
      <div className={cn(
        "w-full h-full rounded-3xl relative flex flex-col items-center justify-center text-center p-8",
        getStyles()
      )}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100/50 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Content - Dikey düzen */}
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* İkon - Büyük */}
          <div className="flex-shrink-0">
            <div className={cn(
              "w-16 h-16 rounded-full backdrop-blur-sm flex items-center justify-center",
              type === 'success' ? 'bg-green-50' :
              type === 'error' ? 'bg-red-50' : 'bg-blue-50'
            )}>
              {getIcon()}
            </div>
          </div>
          
          {/* Mesaj */}
          <div className="max-w-64">
            <p className="text-gray-900 font-medium text-lg leading-relaxed">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Toast }
