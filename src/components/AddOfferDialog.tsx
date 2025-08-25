'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus, Upload } from 'lucide-react'

const formSchema = z.object({
  supplier: z.string().min(1, 'Tedarikçi adı gereklidir'),
  price: z.number().min(0.01, 'Fiyat 0\'dan büyük olmalıdır'),
  currency: z.string().min(1, 'Para birimi seçilmelidir'),
  delivery_date: z.string().min(1, 'Teslimat tarihi gereklidir'),
  file_url: z.string().min(1, 'Dosya yüklenmelidir')
})

type FormData = z.infer<typeof formSchema>

interface AddOfferDialogProps {
  requestId: string
  onSubmit: (data: FormData & { request_id: string }) => void
  trigger?: React.ReactNode
}

export function AddOfferDialog({ requestId, onSubmit, trigger }: AddOfferDialogProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier: '',
      price: 0,
      currency: 'GBP',
      delivery_date: '',
      file_url: ''
    }
  })

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      // Demo dosya yükleme - gerçek uygulamada Supabase Storage kullanılacak
      const fakeUrl = `https://example.com/uploads/${file.name}`
      form.setValue('file_url', fakeUrl)
      setUploading(false)
    } catch (error) {
      console.error('Dosya yüklenirken hata:', error)
      setUploading(false)
    }
  }

  const handleSubmit = (data: FormData) => {
    onSubmit({
      ...data,
      request_id: requestId
    })
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Teklif Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Yeni Teklif Ekle</DialogTitle>
          <DialogDescription>
            Tedarikçi teklifini ekleyin. Tüm alanları doldurun.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tedarikçi Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn: ABC İnşaat Malzemeleri Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiyat</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Para Birimi</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Para birimi seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="TRY">TRY (₺)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teslimat Tarihi</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="file_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dosya (PDF/Excel)</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input 
                        type="file" 
                        accept=".pdf,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(file)
                          }
                        }}
                        disabled={uploading}
                      />
                      {field.value && (
                        <p className="text-sm text-green-600">
                          ✓ Dosya yüklendi: {field.value.split('/').pop()}
                        </p>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Yükleniyor...' : 'Teklif Ekle'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
