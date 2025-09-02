'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)



  return (
    <div className="relative min-h-screen bg-white">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 lg:hidden">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex ml-4 items-center">
            <img 
              src="/d.png" 
              alt="Logo" 
              className="h-8 w-auto filter brightness-0"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-10 w-10 p-0 rounded-lg bg-transparent hover:bg-gray-100 text-gray-600 transition-all duration-200"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <Sidebar 
        onCollapsedChange={setSidebarCollapsed} 
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      
      {/* Desktop Layout */}
      <main className={`min-h-screen overflow-hidden transition-all duration-300 hidden lg:block pr-4 py-4 ${
        sidebarCollapsed ? 'pl-24' : 'pl-72'
      }`}>
        <div className="h-full overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <main className="min-h-screen pt-16 lg:hidden">
        <div className="min-h-[calc(100vh-4rem)]">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}