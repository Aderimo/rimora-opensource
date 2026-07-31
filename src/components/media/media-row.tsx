'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { MediaCard } from './media-card'
import type { Media } from '@/types'

interface MediaRowProps {
  title: string
  items: Media[]
  href?: string
  showType?: boolean
  className?: string
}

export function MediaRow({ title, items, href, showType = false, className }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (!items || items.length === 0) return null

  return (
    <section className={cn('relative', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            Tümünü Gör
            <Icons.chevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Scroll Container */}
      <div className="relative group">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute left-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-xl hover:bg-background hover:scale-105 transition-all',
            'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-300',
            !canScrollLeft && 'hidden'
          )}
          onClick={() => scroll('left')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              scroll('left')
            }
          }}
          aria-label="Sola kaydır"
          tabIndex={0}
        >
          <Icons.chevronLeft className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
        </Button>

        {/* Items */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px]"
            >
              <MediaCard media={item} showType={showType} />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 md:h-12 md:w-12 rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-xl hover:bg-background hover:scale-105 transition-all',
            'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-300',
            !canScrollRight && 'hidden'
          )}
          onClick={() => scroll('right')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              scroll('right')
            }
          }}
          aria-label="Sağa kaydır"
          tabIndex={0}
        >
          <Icons.chevronRight className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
