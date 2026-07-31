'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { getAllSources, type VideoSource } from '@/lib/api/video-sources'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { MediaDetail } from '@/types'

interface VideoPlayerModalProps {
    media: MediaDetail
    season?: number
    episode?: number
    isOpen: boolean
    onClose: () => void
}

export function VideoPlayerModal({
    media,
    season = 1,
    episode = 1,
    isOpen,
    onClose
}: VideoPlayerModalProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(false)
    const [sources, setSources] = useState<VideoSource[]>([])
    const [activeSource, setActiveSource] = useState<VideoSource | null>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    const isMovie = media.type === 'movie'

    // Load video sources
    useEffect(() => {
        if (isOpen) {
            const mediaType = media.type === 'movie' ? 'movie' : media.type === 'anime' ? 'anime' : 'tv'
            const allSources = getAllSources(mediaType, media.id, season, episode)
            setSources(allSources)
            if (allSources.length > 0) {
                setActiveSource(allSources[0])
            }
            setIsLoading(true)
            setError(false)
        }
    }, [isOpen, media.id, media.type, season, episode])

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => { })
                    setIsFullscreen(false)
                } else {
                    onClose()
                }
            }
        }
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [isOpen, isFullscreen, onClose])

    const handleIframeLoad = () => {
        setIsLoading(false)
        setError(false)
    }

    const handleIframeError = () => {
        setIsLoading(false)
        setError(true)
    }

    const toggleFullscreen = () => {
        const modal = document.getElementById('video-modal-container')
        if (!document.fullscreenElement && modal) {
            modal.requestFullscreen().catch(() => { })
            setIsFullscreen(true)
        } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { })
            setIsFullscreen(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/95"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                id="video-modal-container"
                className={cn(
                    "absolute bg-black rounded-xl overflow-hidden shadow-2xl transform-gpu",
                    isFullscreen
                        ? "inset-0 rounded-none"
                        : "inset-4 md:inset-8 lg:inset-16"
                )}
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/20"
                                onClick={onClose}
                            >
                                <Icons.close className="h-5 w-5" />
                            </Button>
                            <div>
                                <h2 className="text-white font-semibold text-sm md:text-base">{media.title}</h2>
                                {!isMovie && (
                                    <p className="text-white/70 text-xs">
                                        Sezon {season} • Bölüm {episode}
                                    </p>
                                )}
                            </div>
                        </div>
                        {/* Sunucu Seçici */}
                        {sources.length > 1 && (
                            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1">
                                {sources.map((source) => (
                                    <button
                                        key={source.id}
                                        className={cn(
                                            'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                                            activeSource?.id === source.id
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-white/70 hover:text-white hover:bg-white/10'
                                        )}
                                        onClick={() => {
                                            setActiveSource(source)
                                            setIsLoading(true)
                                            setError(false)
                                        }}
                                        title={`${source.name} - ${source.language}`}
                                    >
                                        {source.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Video Container */}
                <div className="absolute inset-0">
                    {activeSource && (
                        <iframe
                            src={activeSource.url}
                            className={cn(
                                'w-full h-full border-0',
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black">
                            <div className="text-center text-white">
                                <Icons.spinner className="h-12 w-12 mx-auto mb-4 animate-spin" />
                                <p className="text-lg">Video Yükleniyor...</p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black">
                            <div className="text-center text-white">
                                <Icons.info className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                <h3 className="text-xl font-bold mb-2">Video Yüklenemedi</h3>
                                <p className="text-white/70 mb-4">Kaynak şu anda kullanılamıyor.</p>
                                <Button variant="outline" onClick={onClose}>
                                    Kapat
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
