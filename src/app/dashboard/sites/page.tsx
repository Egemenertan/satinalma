'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { 
  Building2, 
  Plus, 
  MapPin, 
  User, 
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  Edit2,
  Search,
  Filter
} from 'lucide-react'

interface ConstructionSite {
  id: string
  name: string
  code: string
  location?: string
  project_manager_id?: string
  budget_total: number
  budget_used: number
  status: 'active' | 'completed' | 'suspended'
  start_date?: string
  end_date?: string
  description?: string
  created_at: string
  updated_at: string
}

export default function SitesPage() {
  const [sites, setSites] = useState<ConstructionSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: 'all'
  })

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
    budget_total: '',
    start_date: '',
    end_date: '',
    description: ''
  })

  useEffect(() => {
    fetchSites()
  }, [filters])

  const fetchSites = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('construction_sites')
        .select('*')

      if (filters.search) {
        query = query.or(`
          name.ilike.%${filters.search}%,
          code.ilike.%${filters.search}%,
          location.ilike.%${filters.search}%
        `)
      }

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Şantiyeler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const siteData = {
        name: formData.name,
        code: formData.code,
        location: formData.location || null,
        budget_total: parseFloat(formData.budget_total) || 0,
        budget_used: 0,
        status: 'active' as const,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        description: formData.description || null
      }

      const { error } = await supabase
        .from('construction_sites')
        .insert([siteData])

      if (error) throw error

      alert('Şantiye başarıyla eklendi!')
      setShowAddDialog(false)
      setFormData({
        name: '',
        code: '',
        location: '',
        budget_total: '',
        start_date: '',
        end_date: '',
        description: ''
      })
      fetchSites()
    } catch (error) {
      console.error('Şantiye ekleme hatası:', error)
      alert('Şantiye eklenirken bir hata oluştu.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Aktif</Badge>
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Tamamlandı</Badge>
      case 'suspended':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Askıda</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const stats = {
    total: sites.length,
    active: sites.filter(s => s.status === 'active').length,
    totalBudget: sites.reduce((sum, s) => sum + s.budget_total, 0),
    usedBudget: sites.reduce((sum, s) => sum + s.budget_used, 0)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal text-gray-900">Şantiye Yönetimi</h1>
          <p className="text-gray-600 mt-2">İnşaat sahalarını ve projelerini yönetin</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Yeni Şantiye
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yeni Şantiye Ekle</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Şantiye Adı *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Proje adı..."
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="code">Şantiye Kodu *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="ATK001"
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location">Konum</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="İl, ilçe..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="budget_total">Toplam Bütçe (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.budget_total}
                  onChange={(e) => setFormData(prev => ({ ...prev, budget_total: e.target.value }))}
                  placeholder="500000.00"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="end_date">Bitiş Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Açıklama</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Proje hakkında detaylar..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddDialog(false)}
                >
                  İptal
                </Button>
                <Button type="submit">Şantiye Ekle</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Şantiye</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Kayıtlı proje
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Şantiye</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Devam eden
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Bütçe</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal">{formatCurrency(stats.totalBudget)}</div>
            <p className="text-xs text-muted-foreground">
              Ayrılan miktar
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kullanılan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-normal text-blue-600">{formatCurrency(stats.usedBudget)}</div>
            <p className="text-xs text-muted-foreground">
              %{stats.totalBudget > 0 ? ((stats.usedBudget / stats.totalBudget) * 100).toFixed(1) : 0} kullanım
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Şantiye ara..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="suspended">Askıda</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setFilters({ search: '', status: 'all' })}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sites Table */}
      <Card>
        <CardHeader>
          <CardTitle>Şantiyeler</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Şantiye bulunamadı</h3>
              <p className="text-gray-600">Yeni şantiye eklemek için yukarıdaki butonu kullanın.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Şantiye</TableHead>
                    <TableHead>Konum</TableHead>
                    <TableHead>Bütçe</TableHead>
                    <TableHead>Kullanım</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map(site => {
                    const usagePercentage = site.budget_total > 0 ? (site.budget_used / site.budget_total) * 100 : 0

                    return (
                      <TableRow key={site.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{site.name}</div>
                            <div className="text-sm text-gray-500">{site.code}</div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {site.location || 'Belirtilmemiş'}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-gray-400" />
                            {formatCurrency(site.budget_total)}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{formatCurrency(site.budget_used)}</span>
                              <span className="text-gray-500">%{usagePercentage.toFixed(1)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  usagePercentage > 90 ? 'bg-red-500' : 
                                  usagePercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(site.status)}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {site.start_date ? new Date(site.start_date).toLocaleDateString('tr-TR') : 'Belirtilmemiş'}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


