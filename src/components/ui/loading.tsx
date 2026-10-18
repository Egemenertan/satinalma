'use client'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

const widthClasses = {
  sm: 'w-28',
  md: 'w-40',
  lg: 'w-56',
}

export function Loading({ size = 'md', text = 'Yükleniyor...', className = '' }: LoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className={`relative ${widthClasses[size]}`} aria-hidden={!text}>
        <img
          src="/DLX.png"
          alt=""
          className="block h-auto w-full opacity-20 brightness-0"
        />
        <img
          src="/DLX.png"
          alt={text || 'Yükleniyor'}
          className="animate-dlx-reveal absolute inset-0 block h-auto w-full"
        />
      </div>

      {text ? (
        <span className="animate-fade-in-out text-sm font-medium text-gray-600">
          {text}
        </span>
      ) : null}
    </div>
  )
}

export function InlineLoading({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center ${className}`}
      aria-hidden
    >
      <span className="relative block h-1.5 w-4 overflow-hidden rounded-full bg-[#00E676]/20">
        <span className="animate-dlx-inline absolute inset-y-0 left-0 w-full rounded-full bg-[#00E676]" />
      </span>
    </span>
  )
}
