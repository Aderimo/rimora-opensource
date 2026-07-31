'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getImageUrl, backdropSizes } from '@/lib/api/tmdb'
import { useLanguage } from '@/contexts/language-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { Media } from '@/types'

interface HeroSliderProps {
  items: Media[]
  autoPlayInterval?: number
}

export function HeroSlider({ items, autoPlayInterval = 8000 }: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const { t } = useLanguage()

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }, [items.length])

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
  }, [items.length])

  useEffect(() => {
    if (!isAutoPlaying || items.length <= 1) return

    const interval = setInterval(goToNext, autoPlayInterval)
    return () => clearInterval(interval)
  }, [isAutoPlaying, goToNext, autoPlayInterval, items.length])

  if (!items || items.length === 0) return null

  const currentItem = items[currentIndex]
  const backdropUrl = getImageUrl(currentItem.backdropPath, backdropSizes.original)
  
  const href = currentItem.type === 'movie' 
    ? `/filmler/${currentItem.id}` 
    : currentItem.type === 'anime' 
      ? `/animeler/${currentItem.id}`
      : `/diziler/${currentItem.id}`

  return (
    <section
      className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] min-h-[400px] sm:min-h-[500px] max-h-[800px] overflow-hidden"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Background Images - Sadece aktif ve sonraki slide'ı render et */}
      {[currentIndex, (currentIndex + 1) % items.length].map((index) => {
        const item = items[index]
        const bgUrl = getImageUrl(item.backdropPath, backdropSizes.original)
        return (
          <div
            key={item.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-1000',
              index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            {bgUrl && (
              <Image
                src={bgUrl}
                alt={item.title}
                fill
                priority={index === currentIndex}
                className="object-cover"
                sizes="100vw"
                quality={85}
                loading={index === currentIndex ? 'eager' : 'lazy'}
              />
            )}
          </div>
        )
      })}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            {/* Type Badge */}
            <div className="mb-2 sm:mb-4">
              <span className={cn(
                'px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-full',
                currentItem.type === 'movie' && 'bg-purple-500/90 text-white',
                currentItem.type === 'tv' && 'bg-pink-500/90 text-white',
                currentItem.type === 'anime' && 'bg-red-500/90 text-white',
              )}>
                {currentItem.type === 'movie' ? 'Film' : currentItem.type === 'anime' ? 'Anime' : 'Dizi'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-2 sm:mb-4 text-white drop-shadow-lg line-clamp-2">
              {currentItem.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4 text-sm sm:text-base text-white/80">
              {currentItem.voteAverage > 0 && (
                <div className="flex items-center gap-1">
                  <Icons.star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{currentItem.voteAverage.toFixed(1)}</span>
                </div>
              )}
              {(currentItem.releaseDate || currentItem.firstAirDate) && (
                <span>
                  {new Date(currentItem.releaseDate || currentItem.firstAirDate || '').getFullYear()}
                </span>
              )}
            </div>

            {/* Overview */}
            <p className="text-sm sm:text-base md:text-lg text-white/90 line-clamp-2 sm:line-clamp-3 mb-4 sm:mb-6 drop-shadow">
              {currentItem.overview || 'Açıklama mevcut değil.'}
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link href={href}>
                <Button size="sm" className="gap-1.5 sm:gap-2 text-sm sm:text-base h-9 sm:h-11">
                  <Icons.play className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden xs:inline">{t('home.hero.watchNow')}</span>
                  <span className="xs:hidden">İzle</span>
                </Button>
              </Link>
              <Link href={href}>
                <Button size="sm" variant="outline" className="gap-1.5 sm:gap-2 text-sm sm:text-base h-9 sm:h-11 bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Icons.info className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">{t('home.hero.moreInfo')}</span>
                  <span className="sm:hidden">Detay</span>
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="gap-1.5 sm:gap-2 text-sm sm:text-base h-9 sm:h-11 bg-white/10 border-white/20 text-white hover:bg-white/20 hidden xs:flex">
                <Icons.plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{t('home.hero.addToList')}</span>
                <span className="sm:hidden">Liste</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
            onClick={goToPrev}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                goToPrev()
              }
            }}
            aria-label="Önceki slayt"
            tabIndex={0}
          >
            <Icons.chevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm"
            onClick={goToNext}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                goToNext()
              }
            }}
            aria-label="Sonraki slayt"
            tabIndex={0}
          >
            <Icons.chevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </Button>
        </>
      )}

      {/* Dots Indicator */}
      {items.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2" role="tablist" aria-label="Slayt seçimi">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  goToSlide(index)
                }
              }}
              className={cn(
                'h-1.5 sm:h-2 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'w-6 sm:w-8 bg-primary'
                  : 'w-1.5 sm:w-2 bg-white/50 hover:bg-white/80'
              )}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Slayt ${index + 1}`}
              tabIndex={index === currentIndex ? 0 : -1}
            />
          ))}
        </div>
      )}
    </section>
  )
}
