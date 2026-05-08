'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CategoryTabsProps } from '../types'
import { getCategoryImage, getGroupImage, getIconForClass } from '../types'
import * as Icons from 'lucide-react'

export function CategoryTabs({
  categories,
  selectedCategory,
  onCategorySelect,
  subCategories,
  selectedSubCategory,
  onSubCategorySelect,
  isLoading = false
}: CategoryTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const subScrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const [showSubLeftArrow, setShowSubLeftArrow] = useState(false)
  const [showSubRightArrow, setShowSubRightArrow] = useState(false)

  const checkScrollButtons = (container: HTMLDivElement | null, setLeft: (v: boolean) => void, setRight: (v: boolean) => void) => {
    if (!container) return
    setLeft(container.scrollLeft > 0)
    setRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      checkScrollButtons(container, setShowLeftArrow, setShowRightArrow)
      const handleScroll = () => checkScrollButtons(container, setShowLeftArrow, setShowRightArrow)
      container.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', handleScroll)
      return () => {
        container.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleScroll)
      }
    }
  }, [categories])

  useEffect(() => {
    const container = subScrollContainerRef.current
    if (container) {
      checkScrollButtons(container, setShowSubLeftArrow, setShowSubRightArrow)
      const handleScroll = () => checkScrollButtons(container, setShowSubLeftArrow, setShowSubRightArrow)
      container.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', handleScroll)
      return () => {
        container.removeEventListener('scroll', handleScroll)
        window.removeEventListener('resize', handleScroll)
      }
    }
  }, [subCategories])

  const scroll = (container: HTMLDivElement | null, direction: 'left' | 'right') => {
    if (!container) return
    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  const getIcon = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'Wrench': Icons.Wrench,
      'Ruler': Icons.Ruler,
      'Truck': Icons.Truck,
      'Package2': Icons.Package2,
      'Settings': Icons.Settings,
      'Zap': Icons.Zap,
      'Sparkles': Icons.Sparkles,
      'Shield': Icons.Shield,
      'Palette': Icons.Palette,
      'Package': Icons.Package,
      'FileText': Icons.FileText,
      'Target': Icons.Target
    }
    return iconMap[iconName] || Icons.Package
  }

  if (isLoading) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-500">Kategoriler yükleniyor...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Ana Kategori Tabs */}
      <div className="relative px-1 py-2">
        {showLeftArrow && (
          <button
            onClick={() => scroll(scrollContainerRef.current, 'left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
        )}
        
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category.name
            const categoryImage = getCategoryImage(category.name)
            const iconName = getIconForClass(category.name)
            const IconComponent = getIcon(iconName)

            return (
              <button
                key={category.id}
                onClick={() => onCategorySelect(category.name)}
                className={`
                  relative flex-shrink-0 min-w-[120px] h-24 rounded-2xl overflow-hidden
                  transition-all duration-300 group
                  ${isSelected 
                    ? 'ring-2 ring-[#00E676] shadow-md' 
                    : 'hover:shadow-md hover:scale-[1.02]'
                  }
                `}
              >
                {categoryImage ? (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${categoryImage})` }}
                    />
                    <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-[#00E676]/80' : 'bg-black/30 group-hover:bg-[#00E676]/50'}`} />
                  </>
                ) : (
                  <div className={`absolute inset-0 ${isSelected ? 'bg-gradient-to-br from-[#00E676] to-[#00c46a]' : 'bg-white border border-gray-200 rounded-2xl group-hover:border-[#00E676]/30'}`} />
                )}
                
                <div className="relative h-full flex flex-col items-center justify-center p-3 z-10">
                  <div className="w-8 h-8 flex items-center justify-center mb-2">
                    <IconComponent className={`w-5 h-5 transition-all duration-300 ${categoryImage || isSelected ? 'text-white drop-shadow-lg' : 'text-gray-600 group-hover:text-[#00E676]'}`} />
                  </div>
                  <span className={`
                    text-xs font-medium text-center line-clamp-2 leading-tight transition-all duration-300
                    ${categoryImage || isSelected ? 'text-white drop-shadow-lg' : 'text-gray-700 group-hover:text-[#00E676]'}
                  `}>
                    {category.name}
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                    <Icons.Check className="w-4 h-4 text-[#00E676]" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {showRightArrow && (
          <button
            onClick={() => scroll(scrollContainerRef.current, 'right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Alt Kategori Chips */}
      {selectedCategory && subCategories.length > 0 && (
        <div className="relative py-2">
          {showSubLeftArrow && (
            <button
              onClick={() => scroll(subScrollContainerRef.current, 'left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-3 h-3 text-gray-600" />
            </button>
          )}

          <div
            ref={subScrollContainerRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-1 py-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              type="button"
              onClick={() => onSubCategorySelect('')}
              className={`
                flex flex-shrink-0 items-center gap-2.5 pl-2 pr-5 py-2 rounded-full text-sm font-medium
                transition-all duration-200 min-h-[44px]
                ${!selectedSubCategory 
                  ? 'bg-[#00E676] text-white shadow-sm ring-2 ring-[#00E676]/30' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
            >
              {(() => {
                const allImg = getCategoryImage(selectedCategory)
                if (!allImg) {
                  return (
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        !selectedSubCategory ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" aria-hidden />
                    </span>
                  )
                }
                return (
                  <span
                    className="h-9 w-9 shrink-0 rounded-full bg-cover bg-center ring-2 ring-white/40"
                    style={{ backgroundImage: `url(${allImg})` }}
                    aria-hidden
                  />
                )
              })()}
              Tümü
            </button>
            {subCategories.map((subCategory) => {
              const isSelected = selectedSubCategory === subCategory.name
              const groupImage =
                getGroupImage(subCategory.name) ?? getCategoryImage(selectedCategory)
              return (
                <button
                  type="button"
                  key={subCategory.id}
                  onClick={() => onSubCategorySelect(subCategory.name)}
                  className={`
                    flex flex-shrink-0 items-center gap-2.5 pl-2 pr-5 py-2 rounded-full text-sm font-medium
                    transition-all duration-200 text-left min-h-[44px] max-w-[280px]
                    ${isSelected 
                      ? 'bg-[#00E676] text-white shadow-sm ring-2 ring-[#00E676]/30' 
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }
                  `}
                >
                  {groupImage ? (
                    <span
                      className={`h-9 w-9 shrink-0 rounded-full bg-cover bg-center ring-2 ${
                        isSelected ? 'ring-white/50' : 'ring-gray-200'
                      }`}
                      style={{ backgroundImage: `url(${groupImage})` }}
                      aria-hidden
                    />
                  ) : (
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {subCategory.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
                    </span>
                  )}
                  <span className="line-clamp-2 leading-snug">{subCategory.name}</span>
                </button>
              )
            })}
          </div>

          {showSubRightArrow && (
            <button
              onClick={() => scroll(subScrollContainerRef.current, 'right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-3 h-3 text-gray-600" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
