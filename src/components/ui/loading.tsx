import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function Loading({ size = 'md', text = 'Yükleniyor...', className = '' }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16'
  }

  const containerSizeClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }


  return (
    <div className={`flex flex-col items-center justify-center ${containerSizeClasses[size]} ${className}`}>
      {/* Custom Dove Loading Animation */}
      <div className="relative">
        {/* Main dove image with heartbeat animation */}
        <div className="animate-pulse-smooth">
          <img 
            src="/blackdu.webp"
            alt="Loading"
            className={`${sizeClasses[size]} object-contain`}
            onError={(e) => {
              // Fallback to a simple div if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = `${sizeClasses[size]} bg-gray-800 rounded-full flex items-center justify-center`;
              fallback.innerHTML = '🕊️';
              target.parentNode?.appendChild(fallback);
            }}
          />
        </div>
        
      </div>
      
      {text && (
        <span className="text-gray-600 animate-fade-in-out text-sm font-medium">
          {text}
        </span>
      )}
    </div>
  )
}

// Inline loading spinner for buttons
export function InlineLoading({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse-smooth ${className}`}>
      <img 
        src="/blackdu.webp"
        alt="Loading"
        className="w-4 h-4 object-contain"
        onError={(e) => {
          // Fallback to emoji if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'w-4 h-4 flex items-center justify-center text-xs';
          fallback.innerHTML = '🕊️';
          target.parentNode?.appendChild(fallback);
        }}
      />
    </div>
  )
}
