'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, Settings } from 'lucide-react'
import { getAllRoles, getRoleLabel } from '@/lib/roles'

interface RoleSwitcherProps {
  currentRole: string
  onRoleChange: (role: string) => void
}

export function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const roles = getAllRoles()
  const currentRoleInfo = roles.find(r => r.value === currentRole)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Settings className="h-4 w-4" />
        {currentRoleInfo?.label}
      </Button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50">
          <div className="p-4">
            <h3 className="font-semibold mb-3">Test Rolü Değiştir</h3>
            <p className="text-sm text-gray-600 mb-4">
              Farklı rollerde sistemi test etmek için rol değiştirin
            </p>
            
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.value}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    currentRole === role.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    onRoleChange(role.value)
                    setIsOpen(false)
                  }}
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="font-medium">{role.label}</div>
                      <div className="text-sm text-gray-600">{role.description}</div>
                    </div>
                    {currentRole === role.value && (
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-gray-500">
                Bu özellik sadece test amaçlıdır. Gerçek uygulamada kullanıcı rolleri güvenli bir şekilde yönetilir.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



