'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type SlidingSegmentTabItem<T extends string = string> = {
  value: T
  label: string
  ariaLabel?: string
  badge?: boolean
}

type SlidingSegmentTabsProps<T extends string> = {
  items: SlidingSegmentTabItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function SlidingSegmentTabs<const T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: SlidingSegmentTabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [indicator, setIndicator] = useState({ left: 6, width: 0 })
  const signature = items.map((item) => `${item.value}:${item.label}`).join('|')

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const update = () => {
      const index = items.findIndex((item) => item.value === value)
      const button = buttonRefs.current[index]
      if (!button) return
      setIndicator({
        left: button.offsetLeft,
        width: button.offsetWidth,
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(list)
    buttonRefs.current.forEach((button) => {
      if (button) observer.observe(button)
    })
    return () => observer.disconnect()
  }, [items, signature, value])

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative flex w-fit items-center rounded-xl border border-gray-200 bg-white p-1.5',
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-lg bg-bordeaux shadow-sm transition-[left,width] duration-300 ease-out"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={item.ariaLabel}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative z-10 rounded-lg px-5 py-3 text-base font-semibold transition-colors duration-300',
              selected ? 'text-white' : 'text-bordeaux hover:text-bordeaux-700'
            )}
          >
            {item.label}
            {item.badge ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 h-2.5 min-w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                aria-hidden
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
