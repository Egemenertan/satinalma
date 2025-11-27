'use client'

interface StatusFilterProps {
  value: string
  onChange: (value: string) => void
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 h-10 md:h-11 text-sm md:text-base border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-gray-500/20 focus:border-gray-400 text-gray-900 sm:w-auto w-full"
    >
      <option value="all">Tüm Durumlar</option>
      <option value="pending">Bekliyor</option>
      <option value="delivered">Teslim Edildi</option>
      <option value="partially_delivered">Kısmi Teslim</option>
      <option value="iade edildi">İade Edildi</option>
    </select>
  )
}















