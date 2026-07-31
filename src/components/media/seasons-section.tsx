'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { getSeasonEpisodes, getImageUrl, type SeasonInfo, type EpisodeInfo } from '@/lib/api/tmdb'
import { cn } from '@/lib/utils'
import { formatDateTR } from '@/lib/utils/format'
import { toast } from 'sonner'
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Eye, Check, CheckCheck, Play, Info, ChevronDown, X, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface SeasonsSectionProps {
  tvId: number
  seasons: SeasonInfo[]
  mediaType: 'tv' | 'anime'
  title?: string
  posterPath?: string | null
  onEpisodeSelect?: (season: number, episode: number) => void
}

interface EpisodeWatchedStatus {
  [key: string]: boolean
}

const EPISODES_PER_PAGE = 24

export function SeasonsSection({ tvId, seasons, mediaType, title = '', posterPath = null, onEpisodeSelect }: SeasonsSectionProps) {
  const { user } = useAuth()
  const [activeSeason, setActiveSeason] = useState(seasons[0]?.seasonNumber || 1)
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [watchedEpisodes, setWatchedEpisodes] = useState<EpisodeWatchedStatus>({})
  const [spoilerRevealed, setSpoilerRevealed] = useState<{ [key: string]: boolean }>({})
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null)
  const [showSeasonInfo, setShowSeasonInfo] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const currentSeason = seasons.find(s => s.seasonNumber === activeSeason)
  
  // Pagination calculations
  const totalPages = Math.ceil(episodes.length / EPISODES_PER_PAGE)
  const startIndex = (currentPage - 1) * EPISODES_PER_PAGE
  const endIndex = startIndex + EPISODES_PER_PAGE
  const paginatedEpisodes = episodes.slice(startIndex, endIndex)

  // Load episodes
  useEffect(() => {
    async function loadEpisodes() {
      setLoading(true)
      try {
        const data = await getSeasonEpisodes(tvId, activeSeason)
        setEpisodes(data)
      } catch (error) {
        console.error('Error loading episodes:', error)
      } finally {
        setLoading(false)
      }
    }
    loadEpisodes()
    setCurrentPage(1) // Reset page when season changes
  }, [tvId, activeSeason])

  // Load watched status
  useEffect(() => {
    async function loadWatchedStatus() {
      if (!user) return
      
      try {
        const watchedRef = collection(db, 'users', user.uid, 'watchedEpisodes')
        const snapshot = await getDocs(watchedRef)
        const watched: EpisodeWatchedStatus = {}
        snapshot.forEach(doc => {
          const data = doc.data()
          if (data.mediaId === tvId) {
            watched[`${data.season}_${data.episode}`] = true
          }
        })
        setWatchedEpisodes(watched)
      } catch (error) {
        console.error('Error loading watched status:', error)
      }
    }
    loadWatchedStatus()
  }, [user, tvId])

  const watchPath = mediaType === 'anime' ? 'anime' : 'dizi'

  const isEpisodeWatched = (season: number, episode: number) => {
    return watchedEpisodes[`${season}_${episode}`] || false
  }

  const toggleEpisodeWatched = async (e: React.MouseEvent, season: number, episode: number, episodeName: string) => {
    e.stopPropagation()
    if (!user) {
      toast.error('İzlendi işaretlemek için giriş yapın')
      return
    }

    const key = `${season}_${episode}`
    const docId = `${tvId}_s${season}_e${episode}`
    const docRef = doc(db, 'users', user.uid, 'watchedEpisodes', docId)

    try {
      if (isEpisodeWatched(season, episode)) {
        await deleteDoc(docRef)
        setWatchedEpisodes(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        toast.success('İzlendi işareti kaldırıldı')
      } else {
        await setDoc(docRef, {
          mediaId: tvId,
          mediaType,
          title,
          season,
          episode,
          episodeName,
          watchedAt: serverTimestamp()
        })
        setWatchedEpisodes(prev => ({ ...prev, [key]: true }))
        toast.success('Bölüm izlendi olarak işaretlendi')
      }
    } catch (error) {
      console.error('Error toggling watched status:', error)
      toast.error('Bir hata oluştu')
    }
  }

  const markSeasonAsWatched = async () => {
    if (!user) {
      toast.error('Giriş yapmalısınız')
      return
    }

    try {
      const batch = writeBatch(db)
      
      episodes.forEach(ep => {
        const docId = `${tvId}_s${ep.seasonNumber}_e${ep.episodeNumber}`
        const docRef = doc(db, 'users', user.uid, 'watchedEpisodes', docId)
        batch.set(docRef, {
          mediaId: tvId,
          mediaType,
          title,
          season: ep.seasonNumber,
          episode: ep.episodeNumber,
          episodeName: ep.name,
          watchedAt: serverTimestamp()
        })
      })

      await batch.commit()
      
      const newWatched: EpisodeWatchedStatus = { ...watchedEpisodes }
      episodes.forEach(ep => {
        newWatched[`${ep.seasonNumber}_${ep.episodeNumber}`] = true
      })
      setWatchedEpisodes(newWatched)
      
      toast.success(`${currentSeason?.name || 'Sezon'} izlendi olarak işaretlendi`)
    } catch (error) {
      console.error('Error marking season as watched:', error)
      toast.error('Bir hata oluştu')
    }
  }

  const unmarkSeasonAsWatched = async () => {
    if (!user) return

    try {
      const batch = writeBatch(db)
      
      episodes.forEach(ep => {
        const docId = `${tvId}_s${ep.seasonNumber}_e${ep.episodeNumber}`
        const docRef = doc(db, 'users', user.uid, 'watchedEpisodes', docId)
        batch.delete(docRef)
      })

      await batch.commit()
      
      const newWatched: EpisodeWatchedStatus = { ...watchedEpisodes }
      episodes.forEach(ep => {
        delete newWatched[`${ep.seasonNumber}_${ep.episodeNumber}`]
      })
      setWatchedEpisodes(newWatched)
      
      toast.success('Sezon işaretleri kaldırıldı')
    } catch (error) {
      console.error('Error unmarking season:', error)
      toast.error('Bir hata oluştu')
    }
  }

  const revealSpoiler = (e: React.MouseEvent, episodeId: number) => {
    e.stopPropagation()
    setSpoilerRevealed(prev => ({ ...prev, [episodeId]: true }))
  }

  const getSeasonWatchedCount = () => {
    return episodes.filter(ep => isEpisodeWatched(ep.seasonNumber, ep.episodeNumber)).length
  }

  const isSeasonFullyWatched = () => {
    return episodes.length > 0 && getSeasonWatchedCount() === episodes.length
  }

  const handleEpisodeClick = (episode: EpisodeInfo) => {
    if (expandedEpisode === episode.id) {
      setExpandedEpisode(null)
    } else {
      setExpandedEpisode(episode.id)
      if (onEpisodeSelect) {
        onEpisodeSelect(episode.seasonNumber, episode.episodeNumber)
      }
    }
  }

  // Find expanded episode for detail panel
  const expandedEpisodeData = episodes.find(ep => ep.id === expandedEpisode)

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Sezonlar & Bölümler</h2>
        
        <div className="flex items-center gap-3">
          {/* Season Selector */}
          <div className="relative">
            <select
              value={activeSeason}
              onChange={(e) => {
                setActiveSeason(Number(e.target.value))
                setExpandedEpisode(null)
                setCurrentPage(1)
              }}
              className="h-10 px-4 pr-10 rounded-lg bg-muted border-0 text-sm font-medium focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.seasonNumber}>
                  {season.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
          </div>

          {/* Season Actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSeasonInfo(!showSeasonInfo)}
            className="gap-1"
          >
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Sezon Bilgisi</span>
          </Button>
          
          {user && (
            isSeasonFullyWatched() ? (
              <Button
                variant="outline"
                size="sm"
                onClick={unmarkSeasonAsWatched}
                className="gap-1 text-green-500 border-green-500/30"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">İşaretleri Kaldır</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={markSeasonAsWatched}
                className="gap-1"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Tümünü İzledim</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* Season Info Panel */}
      {showSeasonInfo && currentSeason && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex gap-4">
            {currentSeason.posterPath && (
              <div className="relative w-24 h-36 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={getImageUrl(currentSeason.posterPath, 'w185') || ''}
                  alt={currentSeason.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{currentSeason.name}</h3>
              <div className="text-sm text-muted-foreground mb-2">
                {currentSeason.episodeCount} Bölüm
                {currentSeason.airDate && (
                  <> • {new Date(currentSeason.airDate).getFullYear()}</>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {currentSeason.overview || 'Bu sezon için açıklama bulunmuyor.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {user && episodes.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${(getSeasonWatchedCount() / episodes.length) * 100}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {getSeasonWatchedCount()}/{episodes.length} İzlendi
          </span>
        </div>
      )}

      {/* Episodes Grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-muted rounded-lg mb-2" />
              <div className="h-3 bg-muted rounded w-full mb-1" />
              <div className="h-6 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <div className="space-y-4">
          {/* Pagination Info & Controls (Top) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, episodes.length)} / {episodes.length} bölüm gösteriliyor
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, current and neighbors
                      return page === 1 || page === totalPages || 
                             (page >= currentPage - 1 && page <= currentPage + 1)
                    })
                    .map((page, idx, arr) => (
                      <div key={page} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="text-muted-foreground mx-1">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      </div>
                    ))
                  }
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Grid of Episode Cards */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {paginatedEpisodes.map((episode) => {
              const watched = isEpisodeWatched(episode.seasonNumber, episode.episodeNumber)
              const spoilerHidden = !spoilerRevealed[episode.id] && !watched
              const isExpanded = expandedEpisode === episode.id

              return (
                <div key={episode.id} className="flex flex-col">
                  {/* Episode Card */}
                  <button
                    onClick={() => handleEpisodeClick(episode)}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden border-2 transition-all group",
                      isExpanded 
                        ? "border-primary ring-2 ring-primary/30" 
                        : "border-transparent hover:border-primary/50",
                      watched && "ring-2 ring-green-500/30"
                    )}
                  >
                    {episode.stillPath ? (
                      <>
                        <Image
                          src={getImageUrl(episode.stillPath, 'w300') || ''}
                          alt={episode.name}
                          fill
                          className={cn(
                            "object-cover transition-all",
                            spoilerHidden && "blur-lg scale-110"
                          )}
                        />
                        {spoilerHidden && (
                          <div 
                            className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center"
                            onClick={(e) => revealSpoiler(e, episode.id)}
                          >
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mb-0.5" />
                            <span className="text-[10px] text-white font-medium">Spoiler</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-muted flex items-center justify-center">
                        <Play className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Episode Number Badge */}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-bold">
                      {episode.episodeNumber}
                    </div>
                    
                    {/* Watched Badge */}
                    {watched && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Duration */}
                    {episode.runtime && (
                      <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-white text-[10px]">
                        {episode.runtime}dk
                      </div>
                    )}

                    {/* Hover Play Icon */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="h-4 w-4 text-black ml-0.5" />
                      </div>
                    </div>

                    {/* Selected Indicator */}
                    {isExpanded && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-primary rotate-45" />
                    )}
                  </button>

                  {/* Episode Title */}
                  <p className="text-xs font-medium mt-1.5 line-clamp-1 text-center" title={episode.name}>
                    {episode.name}
                  </p>

                  {/* Watched Button */}
                  <button
                    onClick={(e) => toggleEpisodeWatched(e, episode.seasonNumber, episode.episodeNumber, episode.name)}
                    className={cn(
                      "mt-1 w-full py-1 rounded text-xs font-medium transition-all flex items-center justify-center gap-1",
                      watched 
                        ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" 
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {watched ? (
                      <>
                        <Check className="h-3 w-3" />
                        İzledim
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        İzledim
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Expanded Episode Detail Panel */}
          {expandedEpisodeData && (
            <div className="p-4 rounded-xl bg-card border border-primary/30 relative">
              {/* Close Button */}
              <button
                onClick={() => setExpandedEpisode(null)}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col md:flex-row gap-4">
                {/* Thumbnail */}
                <div className="relative w-full md:w-64 aspect-video rounded-lg overflow-hidden flex-shrink-0">
                  {expandedEpisodeData.stillPath ? (
                    <Image
                      src={getImageUrl(expandedEpisodeData.stillPath, 'w500') || ''}
                      alt={expandedEpisodeData.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Sezon {expandedEpisodeData.seasonNumber}, Bölüm {expandedEpisodeData.episodeNumber}
                      </p>
                      <h3 className="text-xl font-bold">{expandedEpisodeData.name}</h3>
                    </div>
                    {expandedEpisodeData.voteAverage > 0 && (
                      <div className="flex items-center gap-1 text-sm bg-muted px-2 py-1 rounded">
                        <Icons.star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        {expandedEpisodeData.voteAverage.toFixed(1)}
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    {expandedEpisodeData.overview || 'Bu bölüm için açıklama bulunmuyor.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                    {expandedEpisodeData.airDate && (
                      <span>
                        {formatDateTR(new Date(expandedEpisodeData.airDate), { longMonth: true })}
                      </span>
                    )}
                    {expandedEpisodeData.runtime && (
                      <span>{expandedEpisodeData.runtime} dakika</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/izle/${watchPath}/${tvId}?s=${expandedEpisodeData.seasonNumber}&e=${expandedEpisodeData.episodeNumber}`}>
                      <Button className="gap-2">
                        <Play className="h-4 w-4" />
                        Bu Bölümü İzle
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={(e) => toggleEpisodeWatched(
                        e as unknown as React.MouseEvent, 
                        expandedEpisodeData.seasonNumber, 
                        expandedEpisodeData.episodeNumber, 
                        expandedEpisodeData.name
                      )}
                      className={cn(
                        "gap-2",
                        isEpisodeWatched(expandedEpisodeData.seasonNumber, expandedEpisodeData.episodeNumber) && 
                        "text-green-500 border-green-500/30"
                      )}
                    >
                      {isEpisodeWatched(expandedEpisodeData.seasonNumber, expandedEpisodeData.episodeNumber) ? (
                        <>
                          <Check className="h-4 w-4" />
                          İzledim
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          İzledim İşaretle
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pagination Controls (Bottom) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-4 text-sm">
                Sayfa {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Icons.tv className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Bu sezon için bölüm bilgisi bulunamadı.</p>
        </div>
      )}
    </section>
  )
}
