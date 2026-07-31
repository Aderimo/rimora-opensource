'use client'

import { Suspense, ComponentType, lazy as reactLazy } from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading Skeleton Component
 */
interface LoadingSkeletonProps {
  className?: string
  variant?: 'card' | 'text' | 'avatar' | 'button'
}

export function LoadingSkeleton({ className, variant = 'card' }: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-muted rounded-md'
  
  const variantClasses = {
    card: 'aspect-[2/3] w-full',
    text: 'h-4 w-full',
    avatar: 'h-10 w-10 rounded-full',
    button: 'h-10 w-24',
  }

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} aria-label="Yükleniyor..." />
  )
}

/**
 * Lazy Load Wrapper Component
 * Suspense ile lazy loading için
 */
interface LazyLoadProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
}

export function LazyLoad({ children, fallback, className }: LazyLoadProps) {
  return (
    <Suspense fallback={fallback || <LoadingSkeleton />}>
      <div className={className}>{children}</div>
    </Suspense>
  )
}

/**
 * Lazy load helper function
 * Dynamic import ile component lazy loading
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = reactLazy(importFunc)

  return function LazyLoadedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <LoadingSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

/**
 * Intersection Observer ile lazy loading
 * Viewport'a girdiğinde component'i yükle
 */
interface LazyLoadOnViewProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  rootMargin?: string
  threshold?: number
  className?: string
}

export function LazyLoadOnView({
  children,
  fallback,
  rootMargin = '50px',
  threshold = 0.01,
  className,
}: LazyLoadOnViewProps) {
  const [isInView, setIsInView] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [rootMargin, threshold])

  return (
    <div ref={ref} className={className}>
      {isInView ? children : fallback || <LoadingSkeleton />}
    </div>
  )
}

/**
 * Media Grid Skeleton
 * Media card grid için loading state
 */
interface MediaGridSkeletonProps {
  count?: number
  className?: string
}

export function MediaGridSkeleton({ count = 10, className }: MediaGridSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} variant="card" />
      ))}
    </div>
  )
}

/**
 * Text Lines Skeleton
 * Metin içerik için loading state
 */
interface TextSkeletonProps {
  lines?: number
  className?: string
}

export function TextSkeleton({ lines = 3, className }: TextSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  )
}

// React import for hooks
import * as React from 'react'
