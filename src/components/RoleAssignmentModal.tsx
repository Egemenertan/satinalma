'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { UserCog, Check, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  full_name: string | null
  email: string
  role: string | null
}

interface RoleAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function RoleAssignmentModal({ isOpen, onClose, onSuccess }: RoleAssignmentModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUserRole, setSelectedUserRole] = useState<string>('')
  const [targetRole, setTargetRole] = useState<'site_manager' | 'site_personnel'>('site_manager')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [currentUserSiteId, setCurrentUserSiteId] = useState<string | null>(null)
  const supabase = createClient()

  // Kullanıcıları yükle
  useEffect(() => {
    if (isOpen) {
      fetchUsers()
    }
  }, [isOpen])

  const fetchUsers = async () => {
    setFetching(true)
    try {
      // Önce mevcut kullanıcının site_id'sini al
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('Kullanıcı oturumu bulunamadı')
        return
      }

      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('site_id')
        .eq('id', user.id)
        .single()

      if (!currentUserProfile?.site_id) {
        console.error('Site ID bulunamadı')
        return
      }

      // site_id array olabilir, ilk elemanı al
      const siteId = Array.isArray(currentUserProfile.site_id) 
        ? currentUserProfile.site_id[0] 
        : currentUserProfile.site_id

      setCurrentUserSiteId(siteId)

      // Aynı sitedeki tüm kullanıcıları getir (site_manager ve site_personnel)
      const { data: siteUsers, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, site_id')
        .neq('id', user.id) // Kendisini hariç tut
        .eq('is_active', true)

      if (error) {
        console.error('Kullanıcılar yüklenirken hata:', error)
        return
      }

      // Site ID'si eşleşen ve site_manager veya site_personnel olanları filtrele
      // Admin ve purchasing_officer rollerini hariç tut
      const filteredUsers = siteUsers?.filter((u: any) => {
        const userSiteIds = Array.isArray(u.site_id) ? u.site_id : [u.site_id]
        const hasSite = userSiteIds.includes(siteId)
        const isRelevantRole = u.role === 'site_manager' || u.role === 'site_personnel'
        const isNotAdminOrPurchasing = u.role !== 'admin' && u.role !== 'purchasing_officer'
        return hasSite && isRelevantRole && isNotAdminOrPurchasing
      }) || []

      setUsers(filteredUsers)
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error)
    } finally {
      setFetching(false)
    }
  }

  const handleAssignRole = async () => {
    if (!selectedUserId) {
      alert('Lütfen bir kullanıcı seçin')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/change-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
          newRole: targetRole
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Rol ataması başarısız')
      }

      alert('✅ Kullanıcı başarıyla Site Manager rolüne atandı!')
      onSuccess?.()
      handleClose()
    } catch (error: any) {
      console.error('Rol atama hatası:', error)
      alert('❌ Hata: ' + (error.message || 'Rol ataması yapılamadı'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedUserId('')
    setSelectedUserRole('')
    setTargetRole('site_manager')
    onClose()
  }

  const handleUserSelect = (userId: string, userRole: string) => {
    setSelectedUserId(userId)
    setSelectedUserRole(userRole)
    // Mevcut rolün tersini hedef rol yap
    setTargetRole(userRole === 'site_manager' ? 'site_personnel' : 'site_manager')
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-white rounded-3xl border-0 shadow-2xl">
        <DialogHeader className="space-y-3 pb-4">
          <div className="flex gap-3">
           
            <div>
              <DialogTitle className="text-xl text-left font-bold text-gray-900">
                Rol Yönetimi
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Kullanıcı rollerini Site Manager ↔ Site Personnel arasında değiştirin
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {fetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Sitenizde rol değiştirilebilecek kullanıcı bulunamadı.</p>
              <p className="text-sm mt-2">Site Manager veya Site Personnel rolündeki kullanıcılar görüntülenir.</p>
            </div>
          ) : (
            <>
              {/* Kullanıcı Seçimi */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-900">
                  Kullanıcı Seçin <span className="text-red-500">*</span>
                </Label>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-2xl">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user.id, user.role || '')}
                      className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-all duration-200 border-b border-gray-100 last:border-b-0 ${
                        selectedUserId === user.id ? 'bg-gray-900 text-white border-l-4 border-l-gray-900' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className={`font-semibold ${selectedUserId === user.id ? 'text-white' : 'text-gray-900'}`}>
                            {user.full_name || user.email.split('@')[0]}
                          </div>
                          <div className={`text-sm mt-1 ${selectedUserId === user.id ? 'text-gray-300' : 'text-gray-600'}`}>
                            {user.email}
                          </div>
                          <div className={`text-xs mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                            selectedUserId === user.id 
                              ? 'bg-white/20 text-white' 
                              : user.role === 'site_manager'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role === 'site_manager' ? (
                              <>
                                <ArrowUpCircle className="h-3 w-3" />
                                Site Manager
                              </>
                            ) : (
                              <>
                                <ArrowDownCircle className="h-3 w-3" />
                                Site Personnel
                              </>
                            )}
                          </div>
                        </div>
                        {selectedUserId === user.id && (
                          <div className="ml-4 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-gray-900" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rol Değişikliği Önizleme - Responsive */}
              {selectedUserId && (
                <div className="p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-200">
                  {/* Desktop: Yatay Layout */}
                  <div className="hidden sm:flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm ${
                        selectedUserRole === 'site_manager' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedUserRole === 'site_manager' ? (
                          <>
                            <ArrowUpCircle className="h-4 w-4" />
                            Site Manager
                          </>
                        ) : (
                          <>
                            <ArrowDownCircle className="h-4 w-4" />
                            Site Personnel
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1.5">Mevcut Rol</div>
                    </div>

                    <div className="flex items-center">
                      <div className="w-8 sm:w-12 h-0.5 bg-gray-300"></div>
                      <div className="mx-2 text-gray-400 text-lg">→</div>
                      <div className="w-8 sm:w-12 h-0.5 bg-gray-300"></div>
                    </div>

                    <div className="text-center">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm ${
                        targetRole === 'site_manager' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {targetRole === 'site_manager' ? (
                          <>
                            <ArrowUpCircle className="h-4 w-4" />
                            Site Manager
                          </>
                        ) : (
                          <>
                            <ArrowDownCircle className="h-4 w-4" />
                            Site Personnel
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1.5">Yeni Rol</div>
                    </div>
                  </div>

                  {/* Mobile: Dikey Layout */}
                  <div className="flex sm:hidden flex-col items-center gap-3">
                    <div className="w-full text-center">
                      <div className="text-xs text-gray-500 mb-2">Mevcut Rol</div>
                      <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm w-full justify-center ${
                        selectedUserRole === 'site_manager' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedUserRole === 'site_manager' ? (
                          <>
                            <ArrowUpCircle className="h-4 w-4" />
                            Site Manager
                          </>
                        ) : (
                          <>
                            <ArrowDownCircle className="h-4 w-4" />
                            Site Personnel
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-6 bg-gray-300"></div>
                      <div className="text-gray-400 text-xl my-1">↓</div>
                      <div className="w-0.5 h-6 bg-gray-300"></div>
                    </div>

                    <div className="w-full text-center">
                      <div className="text-xs text-gray-500 mb-2">Yeni Rol</div>
                      <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm w-full justify-center ${
                        targetRole === 'site_manager' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {targetRole === 'site_manager' ? (
                          <>
                            <ArrowUpCircle className="h-4 w-4" />
                            Site Manager
                          </>
                        ) : (
                          <>
                            <ArrowDownCircle className="h-4 w-4" />
                            Site Personnel
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs sm:text-sm text-gray-700 bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
                    <span className="font-medium">ℹ️ Bilgi:</span> Bu işlem kalıcıdır ve hemen uygulanır.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl px-6 py-2.5 font-medium"
          >
            İptal
          </Button>
          <Button
            onClick={handleAssignRole}
            disabled={!selectedUserId || loading || users.length === 0}
            className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-6 py-2.5 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Değiştiriliyor...
              </>
            ) : (
              <>
                <UserCog className="h-5 w-5 mr-2" />
                Rolü Değiştir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

