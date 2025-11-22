'use client'

import { CalendarIcon, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateFilterProps {
  dateRange: { from: Date | undefined; to?: Date | undefined }
  onChange: (range: { from: Date | undefined; to?: Date | undefined }) => void
  onClear: () => void
}

export function DateFilter({ dateRange, onChange, onClear }: DateFilterProps) {
  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-10 md:h-11 px-4 text-sm md:text-base sm:w-auto w-full inline-flex items-center justify-start gap-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors ${
            (dateRange.from || dateRange.to) ? 'border-gray-900 text-gray-900' : 'text-gray-700'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          {dateRange.from && dateRange.to ? (
            <span className="truncate">
              {format(dateRange.from, 'dd MMM', { locale: tr })} - {format(dateRange.to, 'dd MMM', { locale: tr })}
            </span>
          ) : dateRange.from ? (
            <span className="truncate">
              {format(dateRange.from, 'dd MMM yyyy', { locale: tr })}
            </span>
          ) : (
            'Tarih Seç'
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white shadow-lg border border-gray-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2" 
        align="start" 
        side="bottom" 
        sideOffset={8}
      >
        <div className="p-3">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => onChange(range || { from: undefined, to: undefined })}
            numberOfMonths={1}
            locale={tr}
            classNames={{
              day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
              day_button: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md transition-colors data-[selected=true]:bg-black data-[selected=true]:text-white data-[selected=true]:hover:bg-gray-800 data-[selected=true]:focus:bg-black",
              day_selected: "!bg-black !text-white hover:!bg-gray-800 focus:!bg-black",
              day_today: "bg-gray-100 font-semibold",
              day_outside: "text-gray-400 opacity-50",
              day_disabled: "text-gray-400 opacity-50",
              day_range_middle: "aria-selected:bg-gray-200 aria-selected:text-gray-900",
              day_range_start: "!bg-black !text-white rounded-l-md",
              day_range_end: "!bg-black !text-white rounded-r-md",
              day_hidden: "invisible",
            }}
          />
          {(dateRange.from || dateRange.to) && (
            <div className="border-t pt-3 mt-3">
              <button
                type="button"
                onClick={onClear}
                className="w-full text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-md transition-colors inline-flex items-center justify-center gap-1"
              >
                <XCircle className="h-3 w-3" />
                Temizle
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}









