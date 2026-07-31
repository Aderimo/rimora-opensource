import { getMovieDetails, getTVDetailsWithSeasons } from '@/lib/api/tmdb'
import { VideoPlayer } from '@/components/player/video-player'
import { notFound } from 'next/navigation'

interface WatchPageProps {
  params: { type: string; id: string }
  searchParams: { s?: string; e?: string }
}

export default async function WatchPage({ params, searchParams }: WatchPageProps) {
  const { type, id } = params
  const mediaId = parseInt(id)
  
  if (isNaN(mediaId) || !['film', 'dizi', 'anime'].includes(type)) {
    notFound()
  }

  try {
    const isMovie = type === 'film'
    const media = isMovie 
      ? await getMovieDetails(mediaId)
      : await getTVDetailsWithSeasons(mediaId)

    const season = searchParams.s ? parseInt(searchParams.s) : 1
    const episode = searchParams.e ? parseInt(searchParams.e) : 1

    // Set correct type for anime
    if (type === 'anime' && media.type !== 'anime') {
      media.type = 'anime'
    }

    return (
      <VideoPlayer
        media={media}
        season={!isMovie ? season : undefined}
        episode={!isMovie ? episode : undefined}
        totalSeasons={!isMovie ? media.numberOfSeasons : undefined}
      />
    )
  } catch (error) {
    console.error('Error fetching media:', error)
    notFound()
  }
}
