import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-blue-600" />
        </div>
        
        <h1 className="text-6xl font-bold text-gray-900 mb-2">
          404
        </h1>
        
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Sayfa Bulunamadı
        </h2>
        
        <p className="text-gray-600 mb-6">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        
        <Link href="/dashboard">
          <Button className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800">
            Ana Sayfaya Dön
          </Button>
        </Link>
      </div>
    </div>
  )
}
