'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getImageUrl, posterSizes } from '@/lib/api/tmdb'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ListButtons } from '@/components/media/list-buttons'
import { Play, Plus, Info, Calendar } from 'lucide-react'
import type { Media } from '@/types'

interface MediaCardProps {
  media: Media
  className?: string
  showType?: boolean
  showYear?: boolean
  priority?: boolean
}

export function MediaCard({ 
  media, 
  className, 
  showType = false,
  showYear = false,
  priority = false 
}: MediaCardProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const imageUrl = getImageUrl(media.posterPath, posterSizes.medium)
  
  const href = media.type === 'movie' 
    ? `/filmler/${media.id}` 
    : media.type === 'anime' 
      ? `/animeler/${media.id}`
      : `/diziler/${media.id}`

  const typeLabel = media.type === 'movie' ? 'Film' : media.type === 'anime' ? 'Anime' : 'Dizi'
  const year = media.releaseDate?.split('-')[0]

  // Delayed hover for better UX
  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 150)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsHovered(false)
  }

  return (
    <div
      role="article"
      tabIndex={0}
      aria-label={`${media.title}, ${typeLabel}${year ? `, ${year}` : ''}${media.voteAverage > 0 ? `, Puan: ${media.voteAverage.toFixed(1)}` : ''}`}
      className={cn(
        'group relative block aspect-[2/3] overflow-hidden rounded-xl bg-card transition-all duration-300',
        'hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20 hover:z-10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(href)
        }
      }}
    >
      {/* Poster Image */}
      {imageUrl && !imageError ? (
        <Image
          src={imageUrl}
          alt={`${media.title} posteri`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImageError(true)}
          priority={priority}
          quality={80}
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted" role="img" aria-label="Poster görseli yüklenemedi">
          <Icons.film className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        </div>
      )}

      {/* Always Visible Gradient (subtle) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden="true" />

      {/* Hover Gradient (stronger) */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent transition-opacity duration-300',
        isHovered ? 'opacity-100' : 'opacity-0'
      )} aria-hidden="true" />

      {/* Top Badges */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between z-10">
        {/* Type Badge */}
        {showType && (
          <span className={cn(
            'px-2 py-1 text-[10px] font-semibold rounded-md uppercase tracking-wide backdrop-blur-sm',
            media.type === 'movie' && 'bg-purple-500/90 text-white',
            media.type === 'tv' && 'bg-pink-500/90 text-white',
            media.type === 'anime' && 'bg-red-500/90 text-white',
          )}>
            {typeLabel}
          </span>
        )}

        {/* Rating Badge */}
        {media.voteAverage > 0 && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold backdrop-blur-sm',
            media.voteAverage >= 8 ? 'bg-green-500/90 text-white' :
            media.voteAverage >= 6 ? 'bg-yellow-500/90 text-black' :
            'bg-red-500/90 text-white'
          )} aria-label={`Puan: ${media.voteAverage.toFixed(1)}`}>
            <Icons.star className="h-3 w-3 fill-current" aria-hidden="true" />
            {media.voteAverage.toFixed(1)}
          </div>
        )}
      </div>

      {/* Bottom Info (Always visible) */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {/* Title - always visible */}
        <h3 className={cn(
          'text-sm font-semibold text-white line-clamp-2 transition-all duration-300',
          isHovered ? 'mb-2' : 'mb-0'
        )}>
          {media.title}
        </h3>

        {/* Meta info - visible on hover */}
        <div className={cn(
          'flex items-center gap-3 text-xs text-white/70 transition-all duration-300 overflow-hidden',
          isHovered ? 'max-h-10 opacity-100 mb-3' : 'max-h-0 opacity-0'
        )} aria-hidden={!isHovered}>
          {year && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {year}
            </span>
          )}
          {media.type !== 'movie' && (
            <span className="text-white/50" aria-hidden="true">•</span>
          )}
          {media.type !== 'movie' && (
            <span>{media.type === 'anime' ? 'Anime' : 'Dizi'}</span>
          )}
        </div>
        
        {/* Action Buttons - visible on hover */}
        <div className={cn(
          'flex items-center gap-2 transition-all duration-300 overflow-hidden',
          isHovered ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        )} aria-hidden={!isHovered}>
          <Button 
            size="sm" 
            className="h-9 gap-1.5 flex-1 bg-white text-black hover:bg-white/90 font-semibold"
            onClick={(e) => {
              e.stopPropagation()
              router.push(href)
            }}
            aria-label={`${media.title} izle`}
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            İzle
          </Button>
          <ListButtons
            mediaId={media.id}
            mediaType={media.type === 'tv' ? 'tv' : media.type === 'anime' ? 'anime' : 'movie'}
            title={media.title}
            posterPath={media.posterPath}
            variant="compact"
          />
          <Button 
            size="sm" 
            variant="outline" 
            className="h-9 w-9 p-0 bg-white/10 border-white/30 hover:bg-white/20 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation()
              router.push(href)
            }}
            aria-label={`${media.title} detayları`}
          >
            <Info className="h-4 w-4 text-white" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Focus Ring */}
      <div className="absolute inset-0 rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background opacity-0 group-focus-visible:opacity-100 transition-opacity" />
    </div>
  )
}
