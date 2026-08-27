'use client'

import { useEffect, useState } from 'react'

interface AnalysisProgressBarProps {
  progress: number
  step?: string | null
}

export function AnalysisProgressBar({ progress, step }: AnalysisProgressBarProps) {
  const floor = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  const [display, setDisplay] = useState(floor)

  useEffect(() => {
    setDisplay((prev) => Math.max(prev, floor))
  }, [floor])

  // Uzun AI çağrıları sırasında bar tamamen donmasın diye mevcut adımdan
  // en fazla +8 puan sürünür; asla geri gitmez ve 92'yi geçmez.
  useEffect(() => {
    const ceiling = Math.min(92, floor + 8)
    const id = window.setInterval(() => {
      setDisplay((prev) => {
        if (prev >= ceiling) return prev
        return Math.min(ceiling, prev + 0.15)
      })
    }, 600)
    return () => window.clearInterval(id)
  }, [floor])

  const shown = Math.round(Math.max(display, floor))

  return (
    <div className="w-full max-w-md space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="truncate">{step?.trim() || 'Analiz sürüyor'}</span>
        <span className="tabular-nums font-medium text-neutral-800">{shown}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-neutral-200">
        <div
          className="h-full bg-neutral-950 transition-[width] duration-500 ease-out"
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  )
}
