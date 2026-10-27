'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import { useCurrentProfile } from '@/lib/auth/current-profile'
import { signOutAndRedirect } from '@/lib/auth/sign-out'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function DashboardHeader() {
  const router = useRouter()
  const { data: profile } = useCurrentProfile()
  const userName = profile?.fullName || 'Kullanıcı'
  const userEmail = profile?.email || ''

  const handleLogout = () => {
    void signOutAndRedirect()
  }

  return (
    <header className="hidden lg:block fixed top-3 left-[5.5rem] right-0 z-[45]">
      <div className="flex justify-start px-10 overflow-visible">
        <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-gray-200/60 px-8 py-2 flex items-center justify-between w-3/5 overflow-visible">
          <div className="flex items-center">
            <img
              src="/DLX.png"
              alt="DLX"
              className="h-10 w-auto"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center space-x-3 h-auto py-1 px-2 rounded-xl hover:bg-white/50 transition-all duration-200"
              >
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {userName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {userEmail}
                  </div>
                </div>
                <div className="w-9 h-9 bg-[#00E676] rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56 z-[100]">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <User className="mr-2 h-4 w-4" />
                <span>Ayarlar</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Çıkış Yap</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
