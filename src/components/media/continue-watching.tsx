'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { getContinueWatching, formatTime, type WatchProgress } from '@/lib/watch-progress'
import { getImageUrl } from '@/lib/api/tmdb'
import { Icons } from '@/components/icons'

export function ContinueWatching() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [items, setItems] = useState<WatchProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      getContinueWatching(user.uid, 10)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

  if (!user || loading) return null
  if (items.length === 0) return null

  const getWatchUrl = (item: WatchProgress) => {
    if (item.mediaType === 'movie') return `/izle/film/${item.mediaId}`
    const type = item.mediaType === 'anime' ? 'anime' : 'dizi'
    return `/izle/${type}/${item.mediaId}?s=${item.season}&e=${item.episode}`
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Icons.play className="h-5 w-5 text-primary" />
          {t('home.sections.continueWatching') || 'İzlemeye Devam Et'}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={getWatchUrl(item)}
            className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-muted">
              {item.posterPath ? (
                <Image
                  src={getImageUrl(item.posterPath, 'w500') || ''}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icons.film className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              
              {/* Play Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
                  <Icons.play className="h-7 w-7 text-white ml-1" />
                </div>
              </div>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div 
                  className="h-full bg-primary"
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              {/* Time Badge */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs">
                {formatTime(item.duration - item.currentTime)} kaldı
              </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              {item.mediaType !== 'movie' && (
                <p className="text-sm text-muted-foreground">
                  S{item.season} B{item.episode}
                  {item.episodeName && ` - ${item.episodeName}`}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
