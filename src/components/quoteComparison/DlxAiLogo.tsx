import { cn } from '@/lib/utils'

interface DlxAiLogoProps {
  className?: string
  alt?: string
}

export function DlxAiLogo({ className, alt = 'DLX AI' }: DlxAiLogoProps) {
  return (
    <img
      src="/dlxai.png"
      alt={alt}
      className={cn('h-8 w-auto object-contain', className)}
    />
  )
}
