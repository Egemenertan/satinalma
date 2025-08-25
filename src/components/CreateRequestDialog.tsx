'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Plus } from 'lucide-react'

const formSchema = z.object({
  material: z.string().min(1, 'Malzeme adı gereklidir'),
  quantity: z.number().min(0.01, 'Miktar 0\'dan büyük olmalıdır'),
  unit: z.string().min(1, 'Birim seçilmelidir'),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalıdır')
})

type FormData = z.infer<typeof formSchema>

interface CreateRequestDialogProps {
  onSubmit: (data: FormData) => void
}

export function CreateRequestDialog({ onSubmit }: CreateRequestDialogProps) {
  const [open, setOpen] = useState(false)
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      material: '',
      quantity: 0,
      unit: '',
      description: ''
    }
  })

  const handleSubmit = (data: FormData) => {
    onSubmit(data)
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Yeni Satın Alma Talebi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Yeni Satın Alma Talebi</DialogTitle>
          <DialogDescription>
            Şantiye için yeni bir satın alma talebi oluşturun. Tüm alanları doldurun.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="material"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Malzeme Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn: Çimento, Demir, Tuğla..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Miktar</FormLabel>
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
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Birim seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="adet">Adet</SelectItem>
                        <SelectItem value="kg">Kilogram</SelectItem>
                        <SelectItem value="ton">Ton</SelectItem>
                        <SelectItem value="m">Metre</SelectItem>
                        <SelectItem value="m2">Metre Kare</SelectItem>
                        <SelectItem value="m3">Metre Küp</SelectItem>
                        <SelectItem value="torba">Torba</SelectItem>
                        <SelectItem value="kutu">Kutu</SelectItem>
                        <SelectItem value="paket">Paket</SelectItem>
                        <SelectItem value="litre">Litre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Malzemenin kullanım amacı, özellikler, teslimat gereksinimleri..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Talep Oluştur</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}



