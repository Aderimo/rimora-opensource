'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getImageUrl, posterSizes } from '@/lib/api/tmdb'
import { getUserWatchProgress, deleteWatchProgress, clearAllWatchProgress, type WatchProgressItem } from '@/lib/watch-progress'
import { cn } from '@/lib/utils'

import { formatDateTR } from '@/lib/utils/format'

export default function WatchHistoryPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<WatchProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all')

  useEffect(() => {
    if (user) {
      loadHistory()
    } else {
      setLoading(false)
    }
  }, [user])

  const loadHistory = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getUserWatchProgress(user.uid, 100)
      setHistory(data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: WatchProgressItem) => {
    if (!user) return
    try {
      await deleteWatchProgress(user.uid, item.mediaId, item.mediaType)
      setHistory(prev => prev.filter(h => !(h.mediaId === item.mediaId && h.mediaType === item.mediaType)))
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const handleClearAll = async () => {
    if (!user || !confirm('Tüm izleme geçmişinizi silmek istediğinize emin misiniz?')) return
    try {
      await clearAllWatchProgress(user.uid)
      setHistory([])
    } catch (error) {
      console.error('Error clearing:', error)
    }
  }

  const filteredHistory = filter === 'all' 
    ? history 
    : history.filter(h => h.mediaType === filter)

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}s ${minutes}dk`
    return `${minutes}dk`
  }

  const formatDate = (date: Date | any) => {
    return formatDateTR(date, { longMonth: true, includeTime: true })
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Icons.clock className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Giriş Yapın</h1>
        <p className="text-muted-foreground mb-4">İzleme geçmişinizi görmek için giriş yapmalısınız.</p>
        <Link href="/giris">
          <Button>Giriş Yap</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">İzleme Geçmişi</h1>
            <p className="text-muted-foreground mt-1">
              {history.length} içerik izlediniz
            </p>
          </div>
          {history.length > 0 && (
            <Button variant="outline" onClick={handleClearAll}>
              <Icons.trash className="h-4 w-4 mr-2" />
              Tümünü Temizle
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'movie', 'tv', 'anime'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Tümü' : f === 'movie' ? 'Filmler' : f === 'tv' ? 'Diziler' : 'Animeler'}
            </Button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-20">
            <Icons.clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Henüz izleme geçmişiniz yok</h2>
            <p className="text-muted-foreground mb-4">İzlediğiniz içerikler burada görünecek.</p>
            <Link href="/">
              <Button>Keşfetmeye Başla</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => {
              const posterUrl = getImageUrl(item.posterPath, posterSizes.small)
              const detailUrl = `/${item.mediaType === 'movie' ? 'filmler' : item.mediaType === 'anime' ? 'animeler' : 'diziler'}/${item.mediaId}`
              const watchUrl = item.mediaType === 'movie' 
                ? `/izle/film/${item.mediaId}`
                : `/izle/${item.mediaType === 'anime' ? 'anime' : 'dizi'}/${item.mediaId}?s=${item.season || 1}&e=${item.episode || 1}`

              return (
                <div 
                  key={`${item.mediaType}-${item.mediaId}`}
                  className="flex gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
                >
                  {/* Poster */}
                  <Link href={detailUrl} className="shrink-0">
                    <div className="relative w-20 h-28 rounded-lg overflow-hidden bg-muted">
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icons.film className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={detailUrl}>
                      <h3 className="font-semibold hover:text-primary transition-colors truncate">
                        {item.title}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        item.mediaType === 'movie' ? 'bg-blue-500/20 text-blue-400' :
                        item.mediaType === 'anime' ? 'bg-pink-500/20 text-pink-400' :
                        'bg-green-500/20 text-green-400'
                      )}>
                        {item.mediaType === 'movie' ? 'Film' : item.mediaType === 'anime' ? 'Anime' : 'Dizi'}
                      </span>
                      
                      {item.season && item.episode && (
                        <span>S{item.season}E{item.episode}</span>
                      )}
                      
                      {item.episodeName && (
                        <span className="truncate">• {item.episodeName}</span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{formatDuration(item.currentTime)} / {formatDuration(item.duration)}</span>
                        <span>%{item.progress}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(item.updatedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Link href={watchUrl}>
                      <Button size="sm" className="w-full">
                        <Icons.play className="h-4 w-4 mr-1" />
                        Devam Et
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(item)}
                    >
                      <Icons.trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
