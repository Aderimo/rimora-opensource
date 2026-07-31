'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/language-context'
import { useAuth } from '@/contexts/auth-context'
import { getImageUrl, backdropSizes, posterSizes, type SeasonInfo } from '@/lib/api/tmdb'
import { createRoom } from '@/lib/watch-party'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { MediaRow } from './media-row'
import { CastSection } from './cast-section'
import { VideoSection } from './video-section'
import { ListButtons } from './list-buttons'
import { ShareButtons } from './share-buttons'
import { SeasonsSection } from './seasons-section'
import { TrailerModal } from './trailer-modal'
import { ReviewsSection } from './reviews-section'
import { VideoPlayerModal } from '@/components/player/video-player-modal'
import type { MediaDetail } from '@/types'
import { cn } from '@/lib/utils'

interface MediaDetailContentProps {
  media: MediaDetail & { seasons?: SeasonInfo[] }
}

export function MediaDetailContent({ media }: MediaDetailContentProps) {
  const { t } = useLanguage()
  const { user, userProfile } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [showTrailer, setShowTrailer] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const [creatingParty, setCreatingParty] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [selectedEpisode, setSelectedEpisode] = useState(1)

  const backdropUrl = getImageUrl(media.backdropPath, backdropSizes.original)
  const posterUrl = getImageUrl(media.posterPath, posterSizes.large)

  const typeLabel = media.type === 'movie' ? t('media.movie') : media.type === 'anime' ? t('media.anime') : t('media.series')
  const year = media.releaseDate || media.firstAirDate
    ? new Date(media.releaseDate || media.firstAirDate || '').getFullYear()
    : null

  const isSeriesType = media.type === 'tv' || media.type === 'anime'

  const getWatchUrl = () => {
    if (media.type === 'movie') return `/izle/film/${media.id}`
    if (media.type === 'anime') return `/izle/anime/${media.id}?s=${selectedSeason}&e=${selectedEpisode}`
    return `/izle/dizi/${media.id}?s=${selectedSeason}&e=${selectedEpisode}`
  }

  const handleEpisodeSelect = useCallback((season: number, episode: number) => {
    setSelectedSeason(season)
    setSelectedEpisode(episode)
  }, [])

  const trailer = media.videos?.find(v => v.type === 'Trailer') || media.videos?.[0]

  const handleCreateWatchParty = async () => {
    if (!user) {
      addToast('Birlikte izle için giriş yapmalısınız', 'error')
      return
    }

    setCreatingParty(true)
    try {
      const roomId = await createRoom({
        hostId: user.uid,
        hostName: userProfile?.displayName || 'Misafir',
        hostAvatar: userProfile?.photoURL || undefined,
        roomName: `${userProfile?.displayName || 'Misafir'} - ${media.title}`,
        isPublic: true,
        maxParticipants: 10,
        contentType: 'internal',
        mediaId: media.id,
        mediaType: media.type as 'movie' | 'tv' | 'anime',
        mediaTitle: media.title,
        mediaPoster: media.posterPath || undefined,
        season: media.type !== 'movie' ? 1 : undefined,
        episode: media.type !== 'movie' ? 1 : undefined
      })
      router.push(`/izle-birlikte/${roomId}`)
    } catch (error) {
      addToast('Oda oluşturulurken hata oluştu', 'error')
    } finally {
      setCreatingParty(false)
    }
  }

  return (
    <div className="flex flex-col">
      <section className="relative min-h-[50vh] sm:min-h-[60vh] md:min-h-[70vh]">
        {backdropUrl && (
          <div className="absolute inset-0">
            <Image src={backdropUrl} alt={media.title} fill priority className="object-cover" sizes="100vw" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        <div className="relative container mx-auto px-4 py-12 sm:py-16 md:py-20 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
          {posterUrl && (
            <div className="flex-shrink-0 w-40 sm:w-48 md:w-64 mx-auto md:mx-0">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-border">
                <Image src={posterUrl} alt={media.title} fill className="object-cover" sizes="(max-width: 768px) 192px, 256px" />
              </div>
            </div>
          )}

          <div className="flex-1 max-w-2xl">
            <div className="mb-3 sm:mb-4">
              <span className={cn(
                'px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-full',
                media.type === 'movie' && 'bg-purple-500/90 text-white',
                media.type === 'tv' && 'bg-pink-500/90 text-white',
                media.type === 'anime' && 'bg-red-500/90 text-white',
              )}>{typeLabel}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 text-white drop-shadow-lg">{media.title}</h1>

            {media.originalTitle && media.originalTitle !== media.title && (
              <p className="text-sm sm:text-base md:text-lg text-white/70 mb-3 sm:mb-4">{media.originalTitle}</p>
            )}

            {media.tagline && (
              <p className="text-sm sm:text-base md:text-lg italic text-white/80 mb-3 sm:mb-4">&quot;{media.tagline}&quot;</p>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 text-xs sm:text-sm md:text-base text-white/80">
              {media.voteAverage > 0 && (
                <div className="flex items-center gap-1">
                  <Icons.star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{media.voteAverage.toFixed(1)}</span>
                  <span className="text-xs sm:text-sm">({media.voteCount})</span>
                </div>
              )}
              {year && <span>{year}</span>}
              {media.runtime && <span className="hidden xs:inline">{Math.floor(media.runtime / 60)}s {media.runtime % 60}dk</span>}
              {media.numberOfSeasons && <span>{media.numberOfSeasons} {t('media.season')}</span>}
              {media.numberOfEpisodes && <span className="hidden sm:inline">{media.numberOfEpisodes} {t('media.episode')}</span>}
              {media.status && <span className="px-2 py-0.5 rounded bg-white/10 text-xs sm:text-sm">{media.status}</span>}
            </div>

            {media.genres && media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                {media.genres.slice(0, 4).map((genre) => (
                  <span key={genre.id} className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/10 text-white text-xs sm:text-sm">{genre.name}</span>
                ))}
              </div>
            )}

            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{t('media.overview')}</h3>
              <p className="text-sm sm:text-base text-white/90 leading-relaxed line-clamp-4 sm:line-clamp-none">{media.overview || 'Açıklama mevcut değil.'}</p>
            </div>

            {media.crew && media.crew.length > 0 && (
              <div className="mb-4 sm:mb-6 text-sm sm:text-base">
                <span className="text-white/70">{t('media.director')}: </span>
                <span className="text-white font-medium">{media.crew.map(p => p.name).join(', ')}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 sm:gap-3">
              {isSeriesType ? (
                <Button
                  size="sm"
                  className="gap-1.5 sm:gap-2 h-9 sm:h-10 text-sm sm:text-base"
                  onClick={() => {
                    // Scroll to seasons section
                    document.getElementById('seasons-section')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Icons.list className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden xs:inline">Bölüm Seç</span>
                  <span className="xs:hidden">Bölümler</span>
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5 sm:gap-2 h-9 sm:h-10 text-sm sm:text-base" onClick={() => setShowPlayer(true)}>
                  <Icons.play className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('media.watch')}
                </Button>
              )}
              {trailer && (
                <Button size="sm" variant="outline" className="gap-1.5 sm:gap-2 h-9 sm:h-10 text-sm sm:text-base bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowTrailer(true)}>
                  <Icons.play className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden xs:inline">{t('media.trailer')}</span>
                  <span className="xs:hidden">Fragman</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 sm:gap-2 h-9 sm:h-10 text-sm sm:text-base bg-white/10 border-white/20 text-white hover:bg-white/20 hidden sm:flex"
                onClick={handleCreateWatchParty}
                disabled={creatingParty}
              >
                {creatingParty ? (
                  <Icons.spinner className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <Icons.users className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
                <span className="hidden md:inline">Birlikte İzle</span>
                <span className="md:hidden">Birlikte</span>
              </Button>
              <ListButtons mediaId={media.id} mediaType={media.type} title={media.title} posterPath={media.posterPath} variant="large" />
              <ShareButtons mediaType={media.type} mediaId={media.id} title={media.title} />
            </div>
          </div>
        </div>
      </section>


      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-8 sm:space-y-12">
        {media.seasons && media.seasons.length > 0 && (
          <div id="seasons-section">
            <SeasonsSection
              tvId={media.id}
              seasons={media.seasons}
              mediaType={media.type === 'anime' ? 'anime' : 'tv'}
              title={media.title}
              posterPath={media.posterPath}
              onEpisodeSelect={handleEpisodeSelect}
            />
          </div>
        )}

        {media.cast && media.cast.length > 0 && <CastSection cast={media.cast} />}

        {media.videos && media.videos.length > 0 && <VideoSection videos={media.videos} />}

        {media.similar && media.similar.length > 0 && <MediaRow title={t('media.similar')} items={media.similar} />}

        <ReviewsSection mediaId={media.id} mediaType={media.type} />
      </div>

      {trailer && <TrailerModal video={trailer} isOpen={showTrailer} onClose={() => setShowTrailer(false)} />}
      <VideoPlayerModal media={media} isOpen={showPlayer} onClose={() => setShowPlayer(false)} />
    </div>
  )
}
