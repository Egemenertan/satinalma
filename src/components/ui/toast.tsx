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
  index?: number
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
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div className="flex flex-col gap-3">
        {toasts.map((toast, index) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => onRemove(toast.id)}
            index={index}
          />
        ))}
      </div>
    </div>,
    document.body
  )
}

function Toast({ message, type, onClose, index = 0 }: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    // Animate in with staggered delay
    setTimeout(() => setIsVisible(true), 50 + (index * 100))
  }, [index])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 200) // Wait for animation
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'info':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case 'success':
        return "bg-white border border-green-200 shadow-lg shadow-green-500/10"
      case 'error':
        return "bg-white border border-red-200 shadow-lg shadow-red-500/10"
      case 'info':
        return "bg-white border border-blue-200 shadow-lg shadow-blue-500/10"
    }
  }

  return (
    <div 
      className={cn(
        "pointer-events-auto transition-all duration-300 ease-out transform",
        "min-w-80 max-w-96", // Yatay dikdörtgen boyut
        isVisible 
          ? "translate-x-0 opacity-100 scale-100" 
          : "translate-x-full opacity-0 scale-95"
      )}
    >
      <div className={cn(
        "rounded-lg relative flex items-center p-4 gap-3",
        getStyles()
      )}>
        {/* İkon - Küçük ve sol tarafta */}
        <div className="flex-shrink-0">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            type === 'success' ? 'bg-green-50' :
            type === 'error' ? 'bg-red-50' : 'bg-blue-50'
          )}>
            {getIcon()}
          </div>
        </div>
        
        {/* Mesaj - Yatay düzen */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-medium text-sm leading-relaxed">
            {message}
          </p>
        </div>

        {/* Close button - Sağ tarafta küçük */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  )
}

export { Toast }
