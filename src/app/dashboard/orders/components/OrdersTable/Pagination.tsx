'use client'

import { Button } from '@/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, totalCount, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 pt-4">
      <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
        Sayfa {currentPage} / {totalPages} - Toplam {totalCount} sipariş
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="text-xs h-8 px-3"
        >
          Önceki
        </Button>
        
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 p-0 text-xs ${
                  currentPage === pageNum 
                    ? 'bg-gray-900 text-white hover:bg-gray-800' 
                    : ''
                }`}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <div className="sm:hidden text-xs text-gray-600 min-w-[80px] text-center">
          Sayfa {currentPage} / {totalPages}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="text-xs h-8 px-3"
        >
          Sonraki
        </Button>
      </div>
    </div>
  )
}















