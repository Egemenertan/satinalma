'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'

import { 
  Plus,
  Building,
  Phone,
  Mail,
  MapPin,
  Star,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Edit2,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  BarChart3,
  Users,
  Package,
  Clock,
  Target
} from 'lucide-react'

interface Supplier {
  id: string
  name: string
  code: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  tax_number?: string
  payment_terms: number
  rating: number
  is_approved: boolean
  contract_start_date?: string
  contract_end_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

interface SupplierPerformance {
  supplier_id: string
  total_orders: number
  total_amount: number
  on_time_deliveries: number
  quality_issues: number
  average_delivery_time: number
}

export default function SupplierManagement() {
  const router = useRouter()
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    rating: 'all'
  })

  useEffect(() => {
    fetchSuppliers()
  }, [filters])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('suppliers')
        .select('*')

      if (filters.search) {
        query = query.or(`
          name.ilike.%${filters.search}%,
          code.ilike.%${filters.search}%,
          contact_person.ilike.%${filters.search}%
        `)
      }

      if (filters.status !== 'all') {
        query = query.eq('is_approved', filters.status === 'approved')
      }

      if (filters.rating !== 'all') {
        const rating = parseInt(filters.rating)
        query = query.gte('rating', rating).lt('rating', rating + 1)
      }

      const { data, error } = await query.order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error: any) {
      console.error('Tedarikçiler yüklenirken hata:', error)
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details
      })
    } finally {
      setLoading(false)
    }
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ))
  }

  const getStatusBadge = (isApproved: boolean) => {
    return isApproved ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Onaylı
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Beklemede
      </Badge>
    )
  }

  const AddSupplierDialog = () => {
    const [formData, setFormData] = useState({
      name: '',
      code: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      tax_number: '',
      payment_terms: '30',
      rating: '0',
      is_approved: true
    })

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      
      // Validation
      if (!formData.name.trim()) {
        showToast('Tedarikçi adı zorunludur', 'error')
        return
      }
      
      try {
        console.log('📝 Submitting supplier data:', formData)
        const supplierData = {
          name: formData.name,
          code: formData.code || null,
          contact_person: formData.contact_person || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          tax_number: formData.tax_number || null,
          payment_terms: parseInt(formData.payment_terms) || 30,
          rating: parseFloat(formData.rating) || 0.0,
          is_approved: formData.is_approved || true
          // contract dates ve notes tabloda yok, kaldırdık
        }

        console.log('💾 Inserting supplier data to Supabase:', supplierData)
        const { data, error } = await supabase
          .from('suppliers')
          .insert([supplierData])
          .select()

        if (error) throw error

        console.log('✅ Supplier inserted successfully:', data)
        showToast('Tedarikçi başarıyla eklendi!', 'success')
        router.push('/dashboard/suppliers')
        setFormData({
          name: '',
          code: '',
          contact_person: '',
          email: '',
          phone: '',
          address: '',
          tax_number: '',
          payment_terms: '30',
          rating: '0',
          is_approved: true
        })
        fetchSuppliers()
      } catch (error: any) {
        console.error('Tedarikçi ekleme hatası:', error)
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        })
        const errorMessage = error?.message || 'Tedarikçi eklenirken bir hata oluştu.'
        showToast(errorMessage, 'error')
      }
    }

    return (
      <Button 
        className="bg-black hover:bg-gray-800 text-white px-6 py-6 rounded-xl text-lg font-medium" 
        onClick={() => router.push('/dashboard/suppliers/create')}
      >
        <Plus className="w-5 h-5 mr-3" />
        Yeni Tedarikçi
      </Button>
    )
  }

  const SupplierDetailDialog = ({ supplier }: { supplier: Supplier }) => {
    const [showDetail, setShowDetail] = useState(false)

    return (
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              {supplier.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info" className="space-y-4">
            <TabsList>
              <TabsTrigger value="info">Genel Bilgiler</TabsTrigger>
              <TabsTrigger value="performance">Performans</TabsTrigger>
              <TabsTrigger value="orders">Siparişler</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">İletişim Bilgileri</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{supplier.contact_person || 'Belirtilmemiş'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{supplier.email || 'Belirtilmemiş'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{supplier.phone || 'Belirtilmemiş'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-sm">{supplier.address || 'Belirtilmemiş'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Ticari Bilgiler</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-600">Tedarikçi Kodu</div>
                      <div className="font-medium">{supplier.code}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Vergi Numarası</div>
                      <div className="font-medium">{supplier.tax_number || 'Belirtilmemiş'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Ödeme Vadesi</div>
                      <div className="font-medium">{supplier.payment_terms} gün</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Durum</div>
                      <div className="mt-1">{getStatusBadge(supplier.is_approved)}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Değerlendirme</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getRatingStars(supplier.rating)}
                      <span className="font-medium">{supplier.rating}/5</span>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-400 h-2 rounded-full" 
                        style={{ width: `${(supplier.rating / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  {supplier.notes && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-600 mb-2">Notlar:</div>
                      <div className="text-sm bg-gray-50 p-3 rounded-lg">{supplier.notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(supplier.contract_start_date || supplier.contract_end_date) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sözleşme Bilgileri</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Başlangıç Tarihi</div>
                        <div className="font-medium">
                          {supplier.contract_start_date 
                            ? new Date(supplier.contract_start_date).toLocaleDateString('tr-TR')
                            : 'Belirtilmemiş'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Bitiş Tarihi</div>
                        <div className="font-medium">
                          {supplier.contract_end_date 
                            ? new Date(supplier.contract_end_date).toLocaleDateString('tr-TR')
                            : 'Belirtilmemiş'
                          }
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-2xl font-normal">24</div>
                        <div className="text-sm text-gray-600">Toplam Sipariş</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="text-2xl font-normal text-green-600">92%</div>
                        <div className="text-sm text-gray-600">Zamanında Teslimat</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-orange-600" />
                      <div>
                        <div className="text-2xl font-normal text-orange-600">2</div>
                        <div className="text-sm text-gray-600">Kalite Sorunu</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Performans Geçmişi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium">Ortalama Teslimat Süresi</span>
                      </div>
                      <span className="text-green-600 font-normal">12 gün</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Toplam Sipariş Tutarı</span>
                      </div>
                      <span className="text-blue-600 font-normal">£45,230</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Son Siparişler</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Sipariş geçmişi burada görüntülenecek</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreler */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-normal text-gray-900">Tedarikçi Yönetimi</h2>
          <p className="text-gray-600">Tedarikçi bilgilerini ve performansını yönetin</p>
        </div>
        <AddSupplierDialog />
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tedarikçi ara..."
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
                <SelectItem value="approved">Onaylı</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.rating} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Puan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Puanlar</SelectItem>
                <SelectItem value="4">4+ Yıldız</SelectItem>
                <SelectItem value="3">3+ Yıldız</SelectItem>
                <SelectItem value="2">2+ Yıldız</SelectItem>
                <SelectItem value="1">1+ Yıldız</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setFilters({ search: '', status: 'all', rating: 'all' })}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-2xl font-normal">{suppliers.length}</div>
                <div className="text-sm text-gray-600">Toplam Tedarikçi</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <div>
                <div className="text-2xl font-normal text-green-600">
                  {suppliers.filter(s => s.is_approved).length}
                </div>
                <div className="text-sm text-gray-600">Onaylı Tedarikçi</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-600" />
              <div>
                <div className="text-2xl font-normal text-yellow-600">
                  {suppliers.filter(s => s.rating >= 4).length}
                </div>
                <div className="text-sm text-gray-600">4+ Yıldız</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <div>
                <div className="text-2xl font-normal text-orange-600">
                  {suppliers.filter(s => !s.is_approved).length}
                </div>
                <div className="text-sm text-gray-600">Onay Bekleyen</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tedarikçiler Listesi */}
      <div className="bg-white">
        <div className="px-1 py-4">
          {suppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="p-4 bg-gray-100 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Building className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tedarikçi bulunamadı</h3>
              <p className="text-gray-600">Yeni tedarikçi eklemek için yukarıdaki butonu kullanın.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-0 hover:bg-gray-100">
                      <TableHead className="py-4 text-gray-700 font-semibold">Tedarikçi</TableHead>
                      <TableHead className="py-4 text-gray-700 font-semibold">İletişim</TableHead>
                      <TableHead className="py-4 text-gray-700 font-semibold">Puan</TableHead>
                      <TableHead className="py-4 text-gray-700 font-semibold">Ödeme Vadesi</TableHead>
                      <TableHead className="py-4 text-gray-700 font-semibold">Durum</TableHead>
                      <TableHead className="py-4 text-gray-700 font-semibold">
                        İşlemler
                        <div className="text-xs text-gray-500 font-normal mt-1">
                          💡 Malzeme seçimi için satıra tıklayın
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier, index) => (
                      <TableRow 
                        key={supplier.id}
                        className={`border-0 hover:bg-blue-50/50 transition-colors duration-200 cursor-pointer ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                        }`}
                        onClick={() => {
                          console.log('Tedarikçiye tıklandı:', supplier)
                          router.push(`/dashboard/suppliers/${supplier.id}`)
                        }}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-2xl">
                              <Building className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800">{supplier.name}</div>
                              <div className="text-sm text-gray-600">{supplier.code}</div>
                              {supplier.contact_person && (
                                <div className="text-sm text-gray-500">{supplier.contact_person}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell className="py-4">
                          <div className="space-y-2">
                            {supplier.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="p-1 bg-blue-100 rounded-2xl">
                                  <Mail className="w-3 h-3 text-blue-600" />
                                </div>
                                <span className="text-gray-700">{supplier.email}</span>
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <div className="p-1 bg-green-100 rounded-2xl">
                                  <Phone className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-gray-700">{supplier.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-yellow-100 rounded-2xl">
                              <Star className="w-3 h-3 text-yellow-600" />
                            </div>
                            <div className="flex items-center gap-1">
                              {getRatingStars(supplier.rating)}
                              <span className="text-sm font-medium text-gray-800">{supplier.rating}/5</span>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-100 rounded-2xl">
                              <Calendar className="w-3 h-3 text-purple-600" />
                            </div>
                            <span className="font-medium text-gray-800">{supplier.payment_terms} gün</span>
                          </div>
                        </TableCell>
                        
                        <TableCell className="py-4">
                          {getStatusBadge(supplier.is_approved)}
                        </TableCell>
                        
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1">
                            <SupplierDetailDialog supplier={supplier} />
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-2xl hover:bg-green-100 hover:text-green-600">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


