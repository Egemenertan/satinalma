'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { CheckCircle, XCircle } from 'lucide-react'

const formSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().min(1, 'Yorum gereklidir')
})

type FormData = z.infer<typeof formSchema>

interface ApprovalDialogProps {
  requestId: string
  requestTitle: string
  onSubmit: (data: FormData) => void
  trigger?: React.ReactNode
}

export function ApprovalDialog({ requestId, requestTitle, onSubmit, trigger }: ApprovalDialogProps) {
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      decision: 'approved',
      comment: ''
    }
  })

  const handleSubmit = (data: FormData) => {
    onSubmit(data)
    form.reset()
    setOpen(false)
    setDecision(null)
  }

  const handleDecisionSelect = (newDecision: 'approved' | 'rejected') => {
    setDecision(newDecision)
    form.setValue('decision', newDecision)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Onay/Red
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Talep Onayı</DialogTitle>
          <DialogDescription>
            "{requestTitle}" talebini onaylayın veya reddedin.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-3">
              <FormLabel>Karar</FormLabel>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={decision === 'approved' ? 'default' : 'outline'}
                  className="flex-1 flex items-center gap-2"
                  onClick={() => handleDecisionSelect('approved')}
                >
                  <CheckCircle className="h-4 w-4" />
                  Onayla
                </Button>
                <Button
                  type="button"
                  variant={decision === 'rejected' ? 'destructive' : 'outline'}
                  className="flex-1 flex items-center gap-2"
                  onClick={() => handleDecisionSelect('rejected')}
                >
                  <XCircle className="h-4 w-4" />
                  Reddet
                </Button>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {decision === 'approved' ? 'Onay Yorumu' : 'Red Yorumu'}
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={
                        decision === 'approved' 
                          ? 'Onay nedeninizi belirtin...' 
                          : 'Red nedeninizi belirtin...'
                      }
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
              <Button 
                type="submit" 
                disabled={!decision}
                variant={decision === 'rejected' ? 'destructive' : 'default'}
              >
                {decision === 'approved' ? 'Onayla' : 'Reddet'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}



