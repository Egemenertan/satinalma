'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        placeholder={placeholder || "Ara..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 h-10 md:h-11 text-sm md:text-base border-gray-200 focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400"
      />
    </div>
  )
}














