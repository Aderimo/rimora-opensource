'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getImageUrl, backdropSizes, getSeasonEpisodes, type EpisodeInfo } from '@/lib/api/tmdb'
import { getAllSources, type VideoSource } from '@/lib/api/video-sources'
import { 
  getAvailableSubtitles, 
  saveSubtitleLanguagePreference,
  getNoSubtitlesMessage,
  type Subtitle 
} from '@/lib/api/subtitles'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { MediaDetail } from '@/types'
import { useAuth } from '@/contexts/auth-context'

interface VideoPlayerProps {
  media: MediaDetail
  season?: number
  episode?: number
  totalSeasons?: number
}

export function VideoPlayer({ media, season = 1, episode = 1, totalSeasons }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sources, setSources] = useState<VideoSource[]>([])
  const [activeSource, setActiveSource] = useState<VideoSource | null>(null)

  // Episode navigation
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeInfo | null>(null)

  // Subtitle state
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [activeSubtitle, setActiveSubtitle] = useState<Subtitle | null>(null)
  const [subtitlesLoading, setSubtitlesLoading] = useState(false)
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false)
  const [noSubtitlesMessage, setNoSubtitlesMessage] = useState<string | null>(null)

  const backdropUrl = getImageUrl(media.backdropPath, backdropSizes.original)
  const isMovie = media.type === 'movie'

  // Load episodes for TV shows
  useEffect(() => {
    if (!isMovie && media.id) {
      getSeasonEpisodes(media.id, season)
        .then((eps) => {
          setEpisodes(eps)
          const current = eps.find(e => e.episodeNumber === episode)
          setCurrentEpisode(current || null)
        })
        .catch(console.error)
    }
  }, [media.id, season, episode, isMovie])

  // Load video sources
  useEffect(() => {
    const mediaType = media.type === 'movie' ? 'movie' : media.type === 'anime' ? 'anime' : 'tv'
    const videoSources = getAllSources(mediaType, media.id, season, episode)
    setSources(videoSources)
    if (videoSources.length > 0) {
      setActiveSource(videoSources[0])
    }
  }, [media.id, media.type, season, episode])

  // Load subtitles
  useEffect(() => {
    const loadSubtitles = async () => {
      setSubtitlesLoading(true)
      setNoSubtitlesMessage(null)
      
      try {
        const mediaType = media.type === 'movie' ? 'movie' : media.type === 'anime' ? 'anime' : 'tv'
        const subs = await getAvailableSubtitles(
          media.id,
          mediaType,
          season,
          episode,
          ['tr', 'en'] // Türkçe ve İngilizce altyazı ara
        )
        
        setSubtitles(subs)
        
        // Altyazı bulunamadıysa mesaj göster (Requirement 6.5)
        if (subs.length === 0) {
          setNoSubtitlesMessage(getNoSubtitlesMessage())
        } else {
          // Varsayılan olarak Türkçe altyazıyı seç
          const turkishSub = subs.find(s => s.language === 'tr')
          if (turkishSub) {
            setActiveSubtitle(turkishSub)
          }
        }
      } catch (error) {
        console.error('Altyazı yükleme hatası:', error)
        setNoSubtitlesMessage(getNoSubtitlesMessage())
      } finally {
        setSubtitlesLoading(false)
      }
    }

    loadSubtitles()
  }, [media.id, media.type, season, episode])

  // Close subtitle menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSubtitleMenu && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSubtitleMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSubtitleMenu])

  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError(true)
  }

  // Episode navigation
  const goToNextEpisode = () => {
    if (isMovie || episodes.length === 0) return
    const currentIndex = episodes.findIndex(e => e.episodeNumber === episode)
    if (currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1]
      navigateToEpisode(season, nextEp.episodeNumber)
    } else if (totalSeasons && season < totalSeasons) {
      navigateToEpisode(season + 1, 1)
    }
  }

  const goToPrevEpisode = () => {
    if (isMovie || episodes.length === 0) return
    const currentIndex = episodes.findIndex(e => e.episodeNumber === episode)
    if (currentIndex > 0) {
      const prevEp = episodes[currentIndex - 1]
      navigateToEpisode(season, prevEp.episodeNumber)
    } else if (season > 1) {
      navigateToEpisode(season - 1, 1)
    }
  }

  const navigateToEpisode = (s: number, e: number) => {
    const type = media.type === 'anime' ? 'anime' : 'dizi'
    window.location.href = `/izle/${type}/${media.id}?s=${s}&e=${e}`
  }

  // Subtitle selection handler (Requirement 6.3, 6.4)
  const handleSubtitleSelect = async (subtitle: Subtitle | null) => {
    setActiveSubtitle(subtitle)
    setShowSubtitleMenu(false)
    
    // Kullanıcı tercihini kaydet
    if (subtitle && user) {
      try {
        await saveSubtitleLanguagePreference(subtitle.language, user.uid)
      } catch (error) {
        console.error('Altyazı tercihi kaydetme hatası:', error)
      }
    }
  }

  const hasNextEpisode = !isMovie && (
    episodes.findIndex(e => e.episodeNumber === episode) < episodes.length - 1 ||
    (totalSeasons && season < totalSeasons)
  )

  const hasPrevEpisode = !isMovie && (
    episodes.findIndex(e => e.episodeNumber === episode) > 0 ||
    season > 1
  )

  const backUrl = isMovie
    ? `/filmler/${media.id}`
    : media.type === 'anime'
      ? `/animeler/${media.id}`
      : `/diziler/${media.id}`

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-50">
      {/* Video Container */}
      <div className="relative w-full h-full">

        {/* Backdrop (loading/error) */}
        {(isLoading || error || !activeSource) && backdropUrl && (
          <Image
            src={backdropUrl}
            alt={media.title}
            fill
            className="object-cover opacity-30"
            priority
          />
        )}

        {/* Video iframe */}
        {activeSource && (
          <iframe
            src={activeSource.url}
            className={cn(
              'absolute inset-0 w-full h-full border-0',
              isLoading && 'opacity-0'
            )}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <Icons.spinner className="h-12 w-12 mx-auto mb-4 animate-spin" />
              <p className="text-lg">Yükleniyor...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <Icons.info className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-bold mb-2">Video Yüklenemedi</h2>
              <p className="text-white/70 mb-4">Kaynak şu anda kullanılamıyor.</p>
            </div>
          </div>
        )}

        {/* Top Bar - Back button, title and source selector */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-30">
          <div className="flex items-center gap-4">
            <Link href={backUrl}>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" aria-label="Geri dön">
                <Icons.chevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-semibold text-sm md:text-base truncate">{media.title}</h1>
              {!isMovie && currentEpisode && (
                <p className="text-white/70 text-xs">
                  Sezon {season} • Bölüm {episode}: {currentEpisode.name}
                </p>
              )}
            </div>
            {/* Episode navigation - üst barda */}
            {!isMovie && (hasPrevEpisode || hasNextEpisode) && (
              <div className="flex items-center gap-1" role="group" aria-label="Bölüm navigasyonu">
                {hasPrevEpisode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 gap-1 text-xs h-7 px-2"
                    onClick={goToPrevEpisode}
                    aria-label="Önceki bölüm"
                  >
                    <Icons.skipBack className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden md:inline">Önceki</span>
                  </Button>
                )}
                {hasNextEpisode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 gap-1 text-xs h-7 px-2"
                    onClick={goToNextEpisode}
                    aria-label="Sonraki bölüm"
                  >
                    <span className="hidden md:inline">Sonraki</span>
                    <Icons.skipForward className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}
            {/* Subtitle selector - Altyazı seçimi (Requirement 6.3, 6.4) */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'text-xs px-2 py-1 h-7 gap-1',
                  activeSubtitle
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
                onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                disabled={subtitlesLoading}
                aria-label={`Altyazı seçimi${activeSubtitle ? `: ${activeSubtitle.languageName}` : ''}`}
                aria-expanded={showSubtitleMenu}
                aria-haspopup="true"
              >
                <Icons.subtitles className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">
                  {subtitlesLoading ? 'Yükleniyor...' : activeSubtitle ? activeSubtitle.languageName : 'Altyazı'}
                </span>
              </Button>
              
              {/* Subtitle menu dropdown (Requirement 6.3, 6.4) */}
              {showSubtitleMenu && (
                <div className="absolute top-full right-0 mt-2 bg-black/95 rounded-lg shadow-xl border border-white/10 min-w-[200px] z-40" role="menu" aria-label="Altyazı seçenekleri">
                  <div className="p-2">
                    <div className="text-white/50 text-xs font-medium px-2 py-1 mb-1" id="subtitle-menu-label">
                      Altyazı Seçimi
                    </div>
                    
                    {/* Altyazı kapalı seçeneği */}
                    <button
                      role="menuitemradio"
                      aria-checked={!activeSubtitle}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                        !activeSubtitle
                          ? 'bg-white/20 text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      )}
                      onClick={() => handleSubtitleSelect(null)}
                    >
                      Altyazı Kapalı
                    </button>
                    
                    {/* Altyazı bulunamadı mesajı (Requirement 6.5) */}
                    {noSubtitlesMessage && subtitles.length === 0 && (
                      <div className="px-3 py-2 text-xs text-white/50 italic" role="status">
                        {noSubtitlesMessage}
                      </div>
                    )}
                    
                    {/* Mevcut altyazılar (Requirement 6.4 - Çoklu altyazı desteği) */}
                    {subtitles.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {subtitles.map((subtitle) => (
                          <button
                            key={subtitle.id}
                            role="menuitemradio"
                            aria-checked={activeSubtitle?.id === subtitle.id}
                            aria-label={`${subtitle.languageName} altyazı, ${subtitle.format.toUpperCase()} formatı`}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                              activeSubtitle?.id === subtitle.id
                                ? 'bg-white/20 text-white'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            )}
                            onClick={() => handleSubtitleSelect(subtitle)}
                          >
                            <div className="flex items-center justify-between">
                              <span>{subtitle.languageName}</span>
                              {activeSubtitle?.id === subtitle.id && (
                                <Icons.check className="h-4 w-4" aria-hidden="true" />
                              )}
                            </div>
                            <div className="text-xs text-white/40 mt-0.5">
                              {subtitle.format.toUpperCase()} • {subtitle.downloads} indirme
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Bar - Source selector (Sunucu butonları ortada) */}
        {sources.length > 1 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 pointer-events-auto" role="group" aria-label="Video kaynağı seçimi">
              {sources.map((source) => (
                <Button
                  key={source.id}
                  variant="ghost"
                  size="sm"
                  aria-label={`${source.name} kaynağı`}
                  aria-pressed={activeSource?.id === source.id}
                  className={cn(
                    'text-sm px-4 py-2 h-9 rounded-full transition-all',
                    activeSource?.id === source.id
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  )}
                  onClick={() => {
                    setActiveSource(source)
                    setIsLoading(true)
                    setError(false)
                  }}
                >
                  {source.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
