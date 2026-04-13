'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CategoryTabsProps } from '../types'
import { CATEGORY_IMAGES, getIconForClass } from '../types'
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
    <div className="space-y-3">
      {/* Ana Kategori Tabs */}
      <div className="relative px-1">
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
            const categoryImage = CATEGORY_IMAGES[category.name]
            const iconName = getIconForClass(category.name)
            const IconComponent = getIcon(iconName)

            return (
              <button
                key={category.id}
                onClick={() => onCategorySelect(category.name)}
                className={`
                  relative flex-shrink-0 min-w-[120px] h-24 rounded-xl overflow-hidden
                  transition-all duration-200 group
                  ${isSelected 
                    ? 'ring-2 ring-gray-900 shadow-lg' 
                    : 'hover:shadow-md'
                  }
                `}
              >
                {categoryImage ? (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${categoryImage})` }}
                    />
                    <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-black/50' : 'bg-black/30 group-hover:bg-black/40'}`} />
                  </>
                ) : (
                  <div className={`absolute inset-0 ${isSelected ? 'bg-gray-900' : 'bg-white border border-gray-200 rounded-xl'}`} />
                )}
                
                <div className="relative h-full flex flex-col items-center justify-center p-3 z-10">
                  <div className="w-8 h-8 flex items-center justify-center mb-2">
                    <IconComponent className={`w-5 h-5 ${categoryImage || isSelected ? 'text-white drop-shadow-sm' : 'text-gray-600'}`} />
                  </div>
                  <span className={`
                    text-xs font-medium text-center line-clamp-2 leading-tight
                    ${categoryImage || isSelected ? 'text-white drop-shadow-sm' : 'text-gray-700'}
                  `}>
                    {category.name}
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Icons.Check className="w-3 h-3 text-gray-900" />
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
        <div className="relative">
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
            className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-1 py-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => onSubCategorySelect('')}
              className={`
                flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                transition-all duration-200
                ${!selectedSubCategory 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }
              `}
            >
              Tümü
            </button>
            {subCategories.map((subCategory) => {
              const isSelected = selectedSubCategory === subCategory.name
              return (
                <button
                  key={subCategory.id}
                  onClick={() => onSubCategorySelect(subCategory.name)}
                  className={`
                    flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                    transition-all duration-200
                    ${isSelected 
                      ? 'bg-gray-900 text-white shadow-md' 
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  {subCategory.name}
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
