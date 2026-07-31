import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

// Media Card Skeleton
interface MediaCardSkeletonProps {
  className?: string
}

export function MediaCardSkeleton({ className }: MediaCardSkeletonProps = {}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

// Media Row Skeleton
interface MediaRowSkeletonProps {
  count?: number
  className?: string
}

export function MediaRowSkeleton({ count = 6, className }: MediaRowSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px]">
            <MediaCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  )
}

// Hero Skeleton
interface HeroSkeletonProps {
  className?: string
}

export function HeroSkeleton({ className }: HeroSkeletonProps = {}) {
  return (
    <div className={cn("relative h-[70vh] min-h-[500px] max-h-[800px]", className)}>
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Search Results Skeleton
interface SearchResultsSkeletonProps {
  count?: number
  className?: string
}

export function SearchResultsSkeleton({ count = 12, className }: SearchResultsSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <MediaCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Detail Page Skeleton
interface DetailSkeletonProps {
  className?: string
}

export function DetailSkeleton({ className }: DetailSkeletonProps = {}) {
  return (
    <div className={cn("space-y-8", className)}>
      <HeroSkeleton />
      <div className="container mx-auto px-4 space-y-8">
        {/* Cast */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-24 text-center space-y-2">
                <Skeleton className="w-20 h-20 rounded-full mx-auto" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        {/* Similar */}
        <MediaRowSkeleton />
      </div>
    </div>
  )
}
