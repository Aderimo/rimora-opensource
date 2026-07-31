'use client'

import { useLanguage } from '@/contexts/language-context'
import { MediaRow } from '@/components/media/media-row'
import { RecommendationsSection } from '@/components/media/recommendations-section'
import { ContinueWatching } from '@/components/media/continue-watching'
import type { Media } from '@/types'

interface HomeContentProps {
  data: {
    trending: Media[]
    popularMovies: Media[]
    popularTV: Media[]
    anime: Media[]
    topRated: Media[]
  }
}

export function HomeContent({ data }: HomeContentProps) {
  const { t } = useLanguage()
  const hasAnyContent =
    data.trending.length > 0 ||
    data.popularMovies.length > 0 ||
    data.popularTV.length > 0 ||
    data.anime.length > 0 ||
    data.topRated.length > 0

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Main Content - Full Width */}
      <div className="space-y-10">
        {/* Continue Watching */}
        <ContinueWatching />

        {/* Popular Movies */}
        {data.popularMovies.length > 0 && (
          <MediaRow
            title={t('home.sections.popularMovies')}
            items={data.popularMovies}
            href="/filmler"
          />
        )}

        {/* Recommendations (Trending or Personalized) */}
        <RecommendationsSection fallbackData={data.trending} />

        {/* Popular TV Shows */}
        {data.popularTV.length > 0 && (
          <MediaRow
            title={t('home.sections.popularSeries')}
            items={data.popularTV}
            href="/diziler"
          />
        )}

        {/* Popular Anime */}
        {data.anime.length > 0 && (
          <MediaRow
            title={t('home.sections.popularAnime')}
            items={data.anime}
            href="/animeler"
          />
        )}

        {/* Top Rated */}
        {data.topRated.length > 0 && (
          <MediaRow
            title={t('home.sections.topRated')}
            items={data.topRated}
            href="/filmler"
          />
        )}

        {!hasAnyContent && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
            Şu anda içerik yüklenemiyor. Lütfen biraz sonra tekrar deneyin.
          </div>
        )}
      </div>
    </div>
  )
}
