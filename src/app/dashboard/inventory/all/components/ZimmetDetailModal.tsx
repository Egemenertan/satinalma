'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Package, 
  Calendar, 
  FileText,
  CheckCircle,
  Save,
  Printer,
  X,
  Trash2,
  Search,
  Check,
  ChevronsUpDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ZimmetDetailModalProps {
  isOpen: boolean
  onClose: () => void
  zimmetId: string | null
  onSuccess: () => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

interface Employee {
  id: string
  first_name: string
  work_email: string
}

interface ZimmetDetail {
  id: string
  item_name: string
  quantity: number
  unit: string
  assigned_date: string
  status: string
  notes: string
  category: string | null
  consumed_quantity: number
  serial_number?: string
  owner_name?: string
  owner_email?: string
  user_id?: string
  pending_user_name?: string
  pending_user_email?: string
  user: {
    id: string
    full_name: string
    email: string
  }
  assigned_by_profile?: {
    full_name: string
    email: string
  }
  purchase_request?: {
    request_number: string
    id: string
  }
}

export default function ZimmetDetailModal({
  isOpen,
  onClose,
  zimmetId,
  onSuccess,
  showToast
}: ZimmetDetailModalProps) {
  const [zimmet, setZimmet] = useState<ZimmetDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false)
  const supabase = createClient()

  const filteredEmployees = employees.filter(employee => 
    employee.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.work_email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedEmployee = employees.find(e => e.id === selectedUserId)

  useEffect(() => {
    if (isOpen && zimmetId) {
      fetchZimmetDetail()
      fetchEmployees()
    }
  }, [isOpen, zimmetId])

  const fetchZimmetDetail = async () => {
    if (!zimmetId) return
    
    try {
      setLoading(true)
      
      // Check if it's from pending_user_inventory or user_inventory
      const { data: pendingData } = await supabase
        .from('pending_user_inventory')
        .select('*')
        .eq('id', zimmetId)
        .single()
      
      if (pendingData) {
        // It's a pending zimmet
        setZimmet({
          id: pendingData.id,
          item_name: pendingData.item_name,
          quantity: pendingData.quantity,
          unit: pendingData.unit || 'Adet',
          assigned_date: pendingData.created_at,
          status: 'active',
          notes: pendingData.notes || '',
          category: null,
          consumed_quantity: 0,
          serial_number: pendingData.serial_number,
          owner_name: pendingData.owner_name,
          owner_email: pendingData.owner_email,
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            full_name: pendingData.user_name || 'Bekliyor',
            email: pendingData.user_email || ''
          }
        })
        
        // Eğer user_email varsa, employees tablosundan id'yi bul
        if (pendingData.user_email) {
          const { data: employee } = await supabase
            .from('employees')
            .select('id')
            .eq('work_email', pendingData.user_email)
            .single()
          
          if (employee) {
            setSelectedUserId(employee.id)
          }
        }
      } else {
        // It's from user_inventory
        const { data, error } = await supabase
          .from('user_inventory')
          .select(`
            *,
            user:user_id(id, full_name, email),
            assigned_by_profile:assigned_by(full_name, email),
            purchase_request:purchase_requests(request_number, id)
          `)
          .eq('id', zimmetId)
          .single()
        
        if (error) throw error
        setZimmet(data as any)
        
        // Eğer pending_user_email varsa, employees'den id bul
        if (data.pending_user_email) {
          const { data: employee } = await supabase
            .from('employees')
            .select('id')
            .eq('work_email', data.pending_user_email)
            .single()
          
          if (employee) {
            setSelectedUserId(employee.id)
          }
        } else {
          setSelectedUserId(data.user_id)
        }
      }
    } catch (error) {
      console.error('Zimmet detayı alınamadı:', error)
      showToast('Zimmet detayı yüklenemedi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, work_email')
        .order('first_name')
      
      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Çalışanlar alınamadı:', error)
    }
  }

  const handleSave = async () => {
    if (!zimmet || !selectedUserId) return
    
    try {
      setSaving(true)
      
      // Get selected employee info
      const selectedEmployee = employees.find(e => e.id === selectedUserId)
      if (!selectedEmployee) {
        showToast('Çalışan bulunamadı', 'error')
        return
      }
      
      // Check if it's pending or regular zimmet
      if (zimmet.owner_name) {
        // It's a pending zimmet - update pending_user_inventory
        const { error } = await supabase
          .from('pending_user_inventory')
          .update({ 
            user_email: selectedEmployee.work_email,
            user_name: selectedEmployee.first_name
          })
          .eq('id', zimmet.id)
        
        if (error) throw error
      } else {
        // It's a regular zimmet - update user_inventory
        // employees tablosundan seçilen kişinin email'i ile profiles'dan user_id bulunmalı
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', selectedEmployee.work_email)
          .single()
        
        if (profileData) {
          // Kullanıcı sisteme kayıtlı - user_id'yi güncelle, pending bilgilerini temizle
          const { error } = await supabase
            .from('user_inventory')
            .update({ 
              user_id: profileData.id,
              pending_user_name: null,
              pending_user_email: null
            })
            .eq('id', zimmet.id)
          
          if (error) throw error
        } else {
          // Kullanıcı henüz sisteme login olmamış
          // pending_user_name ve pending_user_email alanlarına kaydet
          const { error } = await supabase
            .from('user_inventory')
            .update({ 
              pending_user_name: selectedEmployee.first_name,
              pending_user_email: selectedEmployee.work_email
            })
            .eq('id', zimmet.id)
          
          if (error) throw error
          
          showToast('Çalışan bilgisi kaydedildi (kullanıcı sisteme giriş yapınca otomatik eşleşecek)', 'info')
        }
      }
      
      showToast('Zimmetli kişi güncellendi', 'success')
      
      // Generate PDF with updated user info
      await handlePrintPDF()
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      showToast('Güncelleme başarısız', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePrintPDF = async () => {
    if (!zimmet) return
    
    try {
      const { generateTeslimPDF } = await import('@/lib/pdf/zimmetPdfGenerator')
      
      // Get updated user info
      const selectedEmployee = employees.find(e => e.id === selectedUserId)
      
      const pdfData = {
        ...zimmet,
        user: selectedEmployee ? {
          id: selectedEmployee.id,
          full_name: selectedEmployee.first_name,
          email: selectedEmployee.work_email
        } : zimmet.user
      }
      
      await generateTeslimPDF(pdfData as any)
      showToast('Teslim Tesellüm PDF\'i oluşturuldu', 'success')
    } catch (error) {
      console.error('PDF oluşturma hatası:', error)
      showToast('PDF oluşturulamadı', 'error')
    }
  }

  const handleRemoveZimmet = async () => {
    if (!zimmet) return
    
    try {
      setRemoving(true)
      
      // Önce iade belgesi PDF'i oluştur
      try {
        const { generateIadePDF } = await import('@/lib/pdf/zimmetPdfGenerator')
        await generateIadePDF(zimmet as any)
        showToast('Zimmet İade Belgesi PDF\'i oluşturuldu', 'success')
      } catch (pdfError) {
        console.error('PDF oluşturma hatası:', pdfError)
        showToast('PDF oluşturulamadı ama işlem devam ediyor', 'info')
      }
      
      // Eğer owner varsa (2. zimmetli durumu), sadece user_email'i temizle
      if (zimmet.owner_name) {
        // Pending inventory'de ise user bilgilerini temizle
        const { error } = await supabase
          .from('pending_user_inventory')
          .update({ 
            user_email: null, 
            user_name: null 
          })
          .eq('id', zimmet.id)
        
        if (error) throw error
        showToast('2. zimmetli kaldırıldı', 'success')
      } else {
        // Owner yoksa (normal zimmet), zimmet kaydını sil
        const { error } = await supabase
          .from('user_inventory')
          .delete()
          .eq('id', zimmet.id)
        
        if (error) throw error
        showToast('Zimmet kaldırıldı', 'success')
      }
      
      setShowRemoveDialog(false)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Zimmet kaldırma hatası:', error)
      showToast('Zimmet kaldırılamadı', 'error')
    } finally {
      setRemoving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent showCloseButton={false} className="w-[calc(100%-2rem)] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white rounded-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-2xl font-semibold text-gray-900">Zimmet Detayları</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-gray-500 mt-1">Zimmet bilgilerini görüntüleyin ve düzenleyin</DialogDescription>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors ml-2"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : zimmet ? (
            <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Ürün Bilgileri */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Ürün Bilgileri</h3>
                  <p className="text-xs text-gray-500">Zimmetli ürün detayları</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Ürün Adı</p>
                  <p className="text-sm font-medium text-gray-900 break-words">{zimmet.item_name}</p>
                </div>
                
                {zimmet.serial_number && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Seri Numarası</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{zimmet.serial_number}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Miktar</p>
                  <p className="text-sm font-medium text-gray-900">{zimmet.quantity} {zimmet.unit}</p>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Durum</p>
                  <Badge className="bg-gray-900 text-white">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Aktif
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100"></div>

            {/* Zimmet Sahibi (Owner) */}
            {zimmet.owner_name && (
              <>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Zimmet Sahibi</h3>
                      <p className="text-xs text-gray-500">1. Zimmetli kişi</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Ad Soyad</p>
                      <p className="text-sm font-medium text-gray-900">{zimmet.owner_name}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">E-posta</p>
                      <p className="text-sm text-gray-900 break-all">{zimmet.owner_email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-100"></div>
              </>
            )}

            {/* Zimmetli Kişi (User) - Değiştirilebilir */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                    {zimmet.owner_name ? '2. Zimmetli' : 'Zimmetli Kişi'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {zimmet.owner_name ? 'İkinci zimmetli kişi' : 'Ürünü kullanan kişi'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Mevcut Kullanıcı veya Bekleyen Zimmetli Bilgisi */}
                {zimmet.pending_user_name ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-amber-700 mb-2">Bekleyen 2. Zimmetli (Sisteme henüz giriş yapmadı)</p>
                    <p className="text-sm font-medium text-gray-900">{zimmet.pending_user_name}</p>
                    {zimmet.pending_user_email && (
                      <p className="text-xs text-gray-500 mt-0.5">{zimmet.pending_user_email}</p>
                    )}
                  </div>
                ) : zimmet.user.full_name !== 'Bekliyor' && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Mevcut Kullanıcı</p>
                    <p className="text-sm font-medium text-gray-900">{zimmet.user.full_name}</p>
                    {zimmet.user.email && (
                      <p className="text-xs text-gray-500 mt-0.5">{zimmet.user.email}</p>
                    )}
                  </div>
                )}
                
                {/* Kullanıcı Değiştir */}
                <div className="relative">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {zimmet.user.full_name === 'Bekliyor' ? 'Kullanıcı Ata' : 'Kullanıcı Değiştir'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    {selectedEmployee ? (
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-gray-900 text-sm">{selectedEmployee.first_name}</span>
                        <span className="text-xs text-gray-500">{selectedEmployee.work_email}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">Çalışan seçin...</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 text-gray-400" />
                  </button>
                  
                  {isEmployeeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Çalışan ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 rounded-lg border-gray-200"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {filteredEmployees.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-500">
                            Çalışan bulunamadı
                          </div>
                        ) : (
                          filteredEmployees.map(employee => (
                            <button
                              type="button"
                              key={employee.id}
                              onClick={() => {
                                setSelectedUserId(employee.id)
                                setIsEmployeeDropdownOpen(false)
                                setSearchQuery('')
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors",
                                selectedUserId === employee.id && "bg-gray-100"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate text-sm">{employee.first_name}</p>
                                <p className="text-xs text-gray-500 truncate">{employee.work_email}</p>
                              </div>
                              {selectedUserId === employee.id && (
                                <Check className="h-4 w-4 text-gray-900 shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100"></div>

            {/* Tarih ve Notlar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-medium text-gray-500">Zimmet Tarihi</p>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(zimmet.assigned_date).toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(zimmet.assigned_date).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              
              {zimmet.notes && (
                <div>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <p className="text-xs font-medium text-gray-500">Notlar</p>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">{zimmet.notes}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 pt-4 sm:pt-6 -mx-4 sm:-mx-8 px-4 sm:px-8 pb-4 sm:pb-6 mt-6 sm:mt-8">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  onClick={() => setShowRemoveDialog(true)}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 rounded-xl h-10 sm:h-11 text-sm order-3 sm:order-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Zimmet Kaldır
                </Button>
                
                <div className="hidden sm:flex flex-1"></div>
                
                {zimmet.user.full_name !== 'Bekliyor' && (
                  <Button
                    onClick={handlePrintPDF}
                    variant="outline"
                    className="rounded-xl h-10 sm:h-11 px-4 sm:px-6 text-sm order-2 sm:order-2"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    PDF Yazdır
                  </Button>
                )}
                
                <Button
                  onClick={handleSave}
                  disabled={saving || !selectedUserId}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-10 sm:h-11 px-4 sm:px-6 text-sm order-1 sm:order-3"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Kaydediliyor...' : 'Kaydet ve PDF Yazdır'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Zimmet bulunamadı</p>
          </div>
        )}
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-md rounded-2xl p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl font-semibold">
              {zimmet?.owner_name ? '2. Zimmetli Kaldır' : 'Zimmet Kaldır'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm">
              {zimmet?.owner_name 
                ? '2. zimmetli kişi kaldırılacak. Zimmet sahibi (1. zimmetli) devam edecek. Bu işlemi onaylıyor musunuz?'
                : 'Bu zimmet kaydı tamamen silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl mt-0">İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveZimmet}
              disabled={removing}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {removing ? 'Kaldırılıyor...' : 'Evet, Kaldır'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
