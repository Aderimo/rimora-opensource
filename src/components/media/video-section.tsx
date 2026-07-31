'use client'

import { useState } from 'react'
import { useLanguage } from '@/contexts/language-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { Video } from '@/types'

interface VideoSectionProps {
  videos: Video[]
}

export function VideoSection({ videos }: VideoSectionProps) {
  const { t } = useLanguage()
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)

  // Filter trailers and teasers
  const trailers = videos.filter(v => v.type === 'Trailer' || v.type === 'Teaser')
  const displayVideos = trailers.length > 0 ? trailers : videos.slice(0, 4)

  if (displayVideos.length === 0) return null

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{t('media.trailer')}</h2>
      
      {/* Video Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayVideos.map((video) => (
          <button
            key={video.id}
            onClick={() => setSelectedVideo(video)}
            className="group relative aspect-video rounded-lg overflow-hidden bg-muted border border-border hover:border-primary transition-colors"
          >
            {/* YouTube Thumbnail */}
            <img
              src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
              alt={video.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icons.play className="h-6 w-6 text-white ml-1" />
              </div>
            </div>

            {/* Title */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-sm text-white font-medium line-clamp-1">{video.name}</p>
              <p className="text-xs text-white/70">{video.type}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="relative w-full max-w-5xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-white hover:bg-white/10"
              onClick={() => setSelectedVideo(null)}
            >
              <Icons.close className="h-6 w-6" />
            </Button>
            <iframe
              src={`https://www.youtube.com/embed/${selectedVideo.key}?autoplay=1`}
              title={selectedVideo.name}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </section>
  )
}
