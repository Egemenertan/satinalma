'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  showMobileButton?: boolean
}

export default function NotificationPanel({ isOpen, onOpenChange, showMobileButton = false }: NotificationPanelProps) {
  const [notificationCount] = useState(3) // Şimdilik sabit, sonra dinamik olacak

  const NotificationButton = ({ isMobile = false }: { isMobile?: boolean }) => (
    <Button
      onClick={() => onOpenChange(!isOpen)}
      variant="ghost"
      size="sm"
      className={cn(
        "relative p-0 rounded-2xl transition-all duration-300",
        isMobile ? (
          cn(
            "h-10 w-10 rounded-lg bg-transparent hover:bg-gray-100",
            isOpen && "bg-gray-100"
          )
        ) : (
          cn(
            "h-12 w-12 bg-white border border-gray-200 shadow-lg",
            "hover:bg-gray-50 hover:shadow-xl hover:scale-110",
            "active:scale-95",
            isOpen && "bg-gray-100 shadow-xl scale-110"
          )
        )
      )}
    >
      <Bell className={cn(
        "h-5 w-5 transition-all duration-300",
        isOpen ? "text-gray-900 rotate-12" : "text-gray-600"
      )} />
      {notificationCount > 0 && (
        <Badge 
          className={cn(
            "absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0",
            "bg-gradient-to-br from-red-500 to-red-600 text-white",
            "border-2 border-white text-[10px] font-bold rounded-full",
            "shadow-md",
            "animate-pulse"
          )}
        >
          {notificationCount > 9 ? '9+' : notificationCount}
        </Badge>
      )}
    </Button>
  )

  return (
    <>
      {/* Bildirim butonu şimdilik gizli */}
      {/* Mobile Inline Button - Rendered in Header (only when prop is true) */}
      {false && showMobileButton && (
        <NotificationButton isMobile={true} />
      )}

      {/* Desktop Fixed Button (only when showMobileButton is false) */}
      {false && !showMobileButton && (
        <div className="hidden lg:block fixed top-8 right-8 z-40">
          <NotificationButton isMobile={false} />
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Notification Panel */}
      <div className={cn(
        "fixed top-3 bottom-3 right-3 lg:top-4 lg:bottom-4 lg:right-4 z-50 transition-all duration-500 ease-out",
        isOpen ? "translate-x-0" : "translate-x-[calc(100%+1rem)] lg:translate-x-[calc(100%+1.5rem)]"
      )}>
        <div className={cn(
          "h-full w-80 sm:w-96 bg-gradient-to-br from-white to-gray-50/50 rounded-3xl shadow-2xl",
          "flex flex-col",
          "border border-gray-100/50 backdrop-blur-xl"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-6 border-b border-gray-100/50">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Bildirimler</h2>
              <p className="text-sm text-gray-500 mt-1">
                {notificationCount > 0 ? `${notificationCount} yeni bildirim` : 'Yeni bildirim yok'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 p-0 rounded-xl hover:bg-gray-100/80 text-gray-600 hover:text-gray-900 transition-all hover:rotate-90"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {/* Örnek bildirimler - şimdilik statik */}
            <div className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-[#071E51] hover:shadow-md transition-all duration-300 cursor-pointer">
              <div className="flex items-start space-x-3">
                <Bell className="h-4 w-4 text-[#071E51] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Yeni talep onaylandı
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    Talep #12345 şantiye şefi tarafından onaylandı
                  </p>
                  <p className="text-xs text-gray-400 mt-2">2 dakika önce</p>
                </div>
              </div>
            </div>

            <div className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-[#071E51] hover:shadow-md transition-all duration-300 cursor-pointer">
              <div className="flex items-start space-x-3">
                <Bell className="h-4 w-4 text-[#071E51] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Teklif alındı
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    ABC Tedarik firmasından yeni teklif geldi
                  </p>
                  <p className="text-xs text-gray-400 mt-2">15 dakika önce</p>
                </div>
              </div>
            </div>

            <div className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-[#071E51] hover:shadow-md transition-all duration-300 cursor-pointer">
              <div className="flex items-start space-x-3">
                <Bell className="h-4 w-4 text-[#071E51] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Sipariş teslim edildi
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                    Sipariş #789 başarıyla teslim edildi
                  </p>
                  <p className="text-xs text-gray-400 mt-2">1 saat önce</p>
                </div>
              </div>
            </div>

            {/* Eski/okunmuş bildirimler */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                Önceki Bildirimler
              </p>
              
              <div className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-300 cursor-pointer opacity-60 hover:opacity-100">
                <div className="flex items-start space-x-3">
                  <Bell className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700">
                      Sistem güncellemesi
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      Sistem başarıyla güncellendi
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Dün</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Actions */}
          <div className="px-4 py-4 border-t border-gray-100/50 bg-gradient-to-b from-transparent to-gray-50/30">
            <Button
              variant="ghost"
              className="w-full h-11 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-white rounded-2xl transition-all hover:shadow-md"
            >
              Tümünü okundu olarak işaretle
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

