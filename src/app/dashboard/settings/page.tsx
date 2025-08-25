'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Palette,
  Database,
  Mail,
  Smartphone,
  Save,
  Eye,
  EyeOff,
  Key
} from 'lucide-react'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [userSettings, setUserSettings] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [systemSettings, setSystemSettings] = useState({
    minOfferCount: '3',
    approvalLimit: '5000',
    currency: 'GBP',
    language: 'tr',
    timezone: 'Europe/Istanbul'
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    urgentOnly: false,
    dailyDigest: true,
    weeklyReport: true
  })

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUser(profile)
        setUserSettings({
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          department: profile.department || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      }
    } catch (error) {
      console.error('Kullanıcı bilgileri yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaveLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: userSettings.name,
          phone: userSettings.phone,
          department: userSettings.department
        })
        .eq('id', user.id)

      if (error) throw error

      alert('Profil bilgileri başarıyla güncellendi!')
      await loadUserData()
    } catch (error) {
      console.error('Profil güncellenirken hata:', error)
      alert('Profil güncellenirken bir hata oluştu.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (userSettings.newPassword !== userSettings.confirmPassword) {
      alert('Yeni şifreler eşleşmiyor!')
      return
    }

    if (userSettings.newPassword.length < 6) {
      alert('Yeni şifre en az 6 karakter olmalıdır!')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: userSettings.newPassword
      })

      if (error) throw error

      alert('Şifre başarıyla değiştirildi!')
      setUserSettings(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
    } catch (error) {
      console.error('Şifre değiştirilirken hata:', error)
      alert('Şifre değiştirilirken bir hata oluştu.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Ayarlar</h1>
          <p className="text-gray-600 mt-2">Hesap ve sistem ayarlarınızı yönetin</p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Güvenlik
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Sistem
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Görünüm
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Kişisel Bilgiler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Ad Soyad</Label>
                  <Input
                    id="name"
                    value={userSettings.name}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userSettings.email}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">E-posta adresi değiştirilemez</p>
                </div>

                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={userSettings.phone}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+90 5xx xxx xx xx"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="department">Departman</Label>
                  <Input
                    id="department"
                    value={userSettings.department}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="Satın Alma, Proje Yönetimi, vb."
                    className="mt-1"
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={saveLoading} className="w-full">
                  {saveLoading ? 'Kaydediliyor...' : 'Profili Güncelle'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rol ve Yetkiler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium">Mevcut Rol</div>
                      <div className="text-sm text-gray-600">
                        {user?.role === 'engineer' ? 'Şantiye Sorumlusu' :
                         user?.role === 'procurement_specialist' ? 'Satın Alma Uzmanı' :
                         user?.role === 'project_manager' ? 'Proje Yöneticisi' :
                         user?.role === 'finance_manager' ? 'Finans Yöneticisi' :
                         user?.role === 'general_manager' ? 'Genel Müdür' : 'Bilinmeyen'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-blue-600">Aktif</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Onay Limiti</div>
                      <div className="text-sm text-gray-600">Maksimum onaylayabileceğiniz tutar</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">£{user?.approval_limit?.toLocaleString() || '0'}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">Hesap Durumu</div>
                      <div className="text-sm text-gray-600">Hesabınızın aktiflik durumu</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-medium text-green-600">Aktif</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Şifre Değiştir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div>
                <Label htmlFor="currentPassword">Mevcut Şifre</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={userSettings.currentPassword}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="mt-1 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-1 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword">Yeni Şifre</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={userSettings.newPassword}
                  onChange={(e) => setUserSettings(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={userSettings.confirmPassword}
                  onChange={(e) => setUserSettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <Button onClick={handleChangePassword} className="w-full">
                Şifreyi Değiştir
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Bildirim Tercihleri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">E-posta Bildirimleri</div>
                    <div className="text-sm text-gray-600">Önemli olaylar için e-posta alın</div>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Push Bildirimleri</div>
                    <div className="text-sm text-gray-600">Tarayıcı bildirimleri göster</div>
                  </div>
                  <Switch
                    checked={notificationSettings.pushNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, pushNotifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Sadece Acil Durumlar</div>
                    <div className="text-sm text-gray-600">Sadece acil talepler için bildirim al</div>
                  </div>
                  <Switch
                    checked={notificationSettings.urgentOnly}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, urgentOnly: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Günlük Özet</div>
                    <div className="text-sm text-gray-600">Her gün özet e-posta gönder</div>
                  </div>
                  <Switch
                    checked={notificationSettings.dailyDigest}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, dailyDigest: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Haftalık Rapor</div>
                    <div className="text-sm text-gray-600">Her hafta performans raporu al</div>
                  </div>
                  <Switch
                    checked={notificationSettings.weeklyReport}
                    onCheckedChange={(checked) => 
                      setNotificationSettings(prev => ({ ...prev, weeklyReport: checked }))
                    }
                  />
                </div>
              </div>

              <Button className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Bildirim Ayarlarını Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>İş Kuralları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="minOfferCount">Minimum Teklif Sayısı</Label>
                  <Select value={systemSettings.minOfferCount} onValueChange={(value) => 
                    setSystemSettings(prev => ({ ...prev, minOfferCount: value }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Teklif</SelectItem>
                      <SelectItem value="3">3 Teklif</SelectItem>
                      <SelectItem value="4">4 Teklif</SelectItem>
                      <SelectItem value="5">5 Teklif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="approvalLimit">Onay Limiti (£)</Label>
                  <Input
                    id="approvalLimit"
                    type="number"
                    value={systemSettings.approvalLimit}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, approvalLimit: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Ana Para Birimi</Label>
                  <Select value={systemSettings.currency} onValueChange={(value) => 
                    setSystemSettings(prev => ({ ...prev, currency: value }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="TRY">TRY (₺)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bölgesel Ayarlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="language">Dil</Label>
                  <Select value={systemSettings.language} onValueChange={(value) => 
                    setSystemSettings(prev => ({ ...prev, language: value }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tr">Türkçe</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone">Saat Dilimi</Label>
                  <Select value={systemSettings.timezone} onValueChange={(value) => 
                    setSystemSettings(prev => ({ ...prev, timezone: value }))
                  }>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Istanbul">İstanbul (GMT+3)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                      <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  Sistem Ayarlarını Kaydet
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Görünüm Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Palette className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tema Ayarları</h3>
                <p className="text-gray-600">Karanlık mod ve özelleştirmeler yakında eklenecek</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


