import { Metadata } from 'next'
import { getTVDetailsWithSeasons, posterSizes, TMDB_IMAGE_BASE } from '@/lib/api/tmdb'
import { MediaDetailContent } from '@/components/media/media-detail-content'
import { TVSeriesJsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld'
import { notFound } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rimora.com'

interface SeriesDetailPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: SeriesDetailPageProps): Promise<Metadata> {
  const id = parseInt(params.id)
  if (isNaN(id)) return {}

  try {
    const series = await getTVDetailsWithSeasons(id)
    
    // Dinamik OG image URL'i oluştur
    const posterUrl = series.posterPath 
      ? `${TMDB_IMAGE_BASE}/${posterSizes.large}${series.posterPath}`
      : ''
    const year = series.firstAirDate ? new Date(series.firstAirDate).getFullYear().toString() : ''
    const rating = series.voteAverage ? series.voteAverage.toFixed(1) : ''
    
    const ogImageUrl = new URL(`${SITE_URL}/api/og`)
    ogImageUrl.searchParams.set('title', series.title)
    ogImageUrl.searchParams.set('type', 'tv')
    if (year) ogImageUrl.searchParams.set('year', year)
    if (rating) ogImageUrl.searchParams.set('rating', rating)
    if (posterUrl) ogImageUrl.searchParams.set('poster', posterUrl)
    
    const description = series.overview?.slice(0, 160) || `${series.title} dizisini Rimora'da izle`
    const canonicalUrl = `${SITE_URL}/diziler/${id}`
    
    return {
      title: series.title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: `${series.title} | Rimora`,
        description,
        url: canonicalUrl,
        siteName: 'Rimora',
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: series.title,
          },
        ],
        type: 'video.tv_show',
        locale: 'tr_TR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${series.title} | Rimora`,
        description,
        images: [ogImageUrl.toString()],
        creator: '@rimora',
        site: '@rimora',
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
    }
  } catch {
    return {}
  }
}

export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const id = parseInt(params.id)
  
  if (isNaN(id)) {
    notFound()
  }

  try {
    const series = await getTVDetailsWithSeasons(id)
    
    // Breadcrumb verileri
    const breadcrumbItems = [
      { name: 'Ana Sayfa', url: SITE_URL },
      { name: 'Diziler', url: `${SITE_URL}/diziler` },
      { name: series.title, url: `${SITE_URL}/diziler/${id}` },
    ]
    
    return (
      <>
        {/* JSON-LD Structured Data */}
        <TVSeriesJsonLd
          id={series.id}
          title={series.title}
          overview={series.overview}
          posterPath={series.posterPath}
          backdropPath={series.backdropPath}
          firstAirDate={series.firstAirDate}
          voteAverage={series.voteAverage}
          voteCount={series.voteCount}
          genres={series.genres}
          cast={series.cast}
          crew={series.crew}
          numberOfSeasons={series.numberOfSeasons}
          numberOfEpisodes={series.numberOfEpisodes}
        />
        <BreadcrumbJsonLd items={breadcrumbItems} />
        
        <MediaDetailContent media={series} />
      </>
    )
  } catch (error) {
    console.error('Error fetching series:', error)
    notFound()
  }
}
