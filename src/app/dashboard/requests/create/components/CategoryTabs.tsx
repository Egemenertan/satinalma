'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { CategoryTabsProps } from '../types'
import { getIconForClass } from '../types'
import { formatMaterialClassLabel } from '@/lib/it-workflow'
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
    setLeft(container.scrollLeft > 4)
    setRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 4)
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    checkScrollButtons(container, setShowLeftArrow, setShowRightArrow)
    const handleScroll = () => checkScrollButtons(container, setShowLeftArrow, setShowRightArrow)
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [categories])

  useEffect(() => {
    const container = subScrollContainerRef.current
    if (!container) return
    checkScrollButtons(container, setShowSubLeftArrow, setShowSubRightArrow)
    const handleScroll = () => checkScrollButtons(container, setShowSubLeftArrow, setShowSubRightArrow)
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [subCategories, selectedCategory])

  const scroll = (container: HTMLDivElement | null, direction: 'left' | 'right') => {
    if (!container) return
    container.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth'
    })
  }

  const getIcon = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      Wrench: Icons.Wrench,
      Ruler: Icons.Ruler,
      Truck: Icons.Truck,
      Package2: Icons.Package2,
      Settings: Icons.Settings,
      Zap: Icons.Zap,
      Sparkles: Icons.Sparkles,
      Shield: Icons.Shield,
      Palette: Icons.Palette,
      Package: Icons.Package,
      FileText: Icons.FileText,
      Target: Icons.Target,
      Armchair: Icons.Armchair
    }
    return iconMap[iconName] || Icons.Package
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 py-6 text-[13px] text-[#86868b]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Sınıflar yükleniyor
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-5">
      <section aria-label="Sınıf">
        <p className="mb-2.5 px-0.5 text-[13px] font-medium tracking-[-0.01em] text-[#86868b]">Sınıf</p>
        <ScrollRow
          containerRef={scrollContainerRef}
          showLeft={showLeftArrow}
          showRight={showRightArrow}
          onScrollLeft={() => scroll(scrollContainerRef.current, 'left')}
          onScrollRight={() => scroll(scrollContainerRef.current, 'right')}
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category.name
            const IconComponent = getIcon(getIconForClass(category.name))
            const label = category.display_name?.trim() || formatMaterialClassLabel(category.name)

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onCategorySelect(category.name)}
                className={`
                  group/tile flex w-[156px] shrink-0 flex-col items-center justify-center gap-2.5
                  rounded-[22px] px-3.5 py-4 text-center
                  transition-[background-color,transform] duration-200 ease-out
                  active:scale-[0.98]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1f]/25 focus-visible:ring-offset-2
                  ${isSelected
                    ? 'bg-[#1d1d1f] text-white'
                    : 'bg-white text-[#1d1d1f] ring-1 ring-black/[0.06] hover:bg-[#f5f5f7]'
                  }
                `}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[12px] ${
                    isSelected ? 'bg-white/10' : 'bg-[#f5f5f7] group-hover/tile:bg-white'
                  }`}
                >
                  <IconComponent className="h-[18px] w-[18px] stroke-[1.75]" />
                </span>
                <span className="line-clamp-2 min-h-[2.35rem] w-full text-[13px] font-medium leading-[1.2] tracking-[-0.02em]">
                  {label}
                </span>
              </button>
            )
          })}
        </ScrollRow>
      </section>

      {selectedCategory && subCategories.length > 0 && (
        <section aria-label="Grup">
          <p className="mb-2.5 px-0.5 text-[13px] font-medium tracking-[-0.01em] text-[#86868b]">Grup</p>
          <ScrollRow
            containerRef={subScrollContainerRef}
            showLeft={showSubLeftArrow}
            showRight={showSubRightArrow}
            onScrollLeft={() => scroll(subScrollContainerRef.current, 'left')}
            onScrollRight={() => scroll(subScrollContainerRef.current, 'right')}
          >
            <button
              type="button"
              aria-pressed={!selectedSubCategory}
              onClick={() => onSubCategorySelect('')}
              className={groupChipClass(!selectedSubCategory)}
            >
              Tümü
            </button>
            {subCategories.map((subCategory) => {
              const isSelected = selectedSubCategory === subCategory.name
              return (
                <button
                  type="button"
                  key={subCategory.id}
                  aria-pressed={isSelected}
                  onClick={() => onSubCategorySelect(subCategory.name)}
                  className={groupChipClass(isSelected)}
                >
                  {subCategory.name}
                </button>
              )
            })}
          </ScrollRow>
        </section>
      )}
    </div>
  )
}

function groupChipClass(isSelected: boolean) {
  return `
    inline-flex h-9 shrink-0 items-center rounded-full px-3.5
    text-[13px] font-medium tracking-[-0.01em]
    transition-colors duration-200
    active:scale-[0.98]
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1f]/25 focus-visible:ring-offset-2
    ${isSelected
      ? 'bg-[#1d1d1f] text-white'
      : 'bg-[#efeff4] text-[#1d1d1f] hover:bg-[#e5e5ea]'
    }
  `
}

function ScrollRow({
  containerRef,
  showLeft,
  showRight,
  onScrollLeft,
  onScrollRight,
  children
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  showLeft: boolean
  showRight: boolean
  onScrollLeft: () => void
  onScrollRight: () => void
  children: React.ReactNode
}) {
  return (
    <div className="group/row relative">
      {showLeft && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-gray-50 to-transparent" />
          <button
            type="button"
            aria-label="Sola kaydır"
            onClick={onScrollLeft}
            className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] backdrop-blur-md transition-opacity hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto scroll-smooth px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {showRight && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-gray-50 to-transparent" />
          <button
            type="button"
            aria-label="Sağa kaydır"
            onClick={onScrollRight}
            className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] backdrop-blur-md transition-opacity hover:bg-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
