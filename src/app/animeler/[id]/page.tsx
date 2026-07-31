import { Metadata } from 'next'
import { getAnimeDetails } from '@/lib/api/anilist'
import { MediaDetailContent } from '@/components/media/media-detail-content'
import { AnimeJsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld'
import { notFound } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rimora.com'

interface AnimeDetailPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: AnimeDetailPageProps): Promise<Metadata> {
  const id = parseInt(params.id)
  if (isNaN(id)) return {}

  try {
    const anime = await getAnimeDetails(id)
    
    // Dinamik OG image URL'i oluştur
    const posterUrl = anime.posterPath || ''
    const year = anime.firstAirDate ? new Date(anime.firstAirDate).getFullYear().toString() : ''
    const rating = anime.voteAverage ? anime.voteAverage.toFixed(1) : ''
    
    const ogImageUrl = new URL(`${SITE_URL}/api/og`)
    ogImageUrl.searchParams.set('title', anime.title)
    ogImageUrl.searchParams.set('type', 'anime')
    if (year) ogImageUrl.searchParams.set('year', year)
    if (rating) ogImageUrl.searchParams.set('rating', rating)
    if (posterUrl) ogImageUrl.searchParams.set('poster', posterUrl)
    
    const description = anime.overview?.slice(0, 160) || `${anime.title} animesini Rimora'da izle`
    const canonicalUrl = `${SITE_URL}/animeler/${id}`
    
    return {
      title: anime.title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: `${anime.title} | Rimora`,
        description,
        url: canonicalUrl,
        siteName: 'Rimora',
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: anime.title,
          },
        ],
        type: 'video.tv_show',
        locale: 'tr_TR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${anime.title} | Rimora`,
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

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const id = parseInt(params.id)
  
  if (isNaN(id)) {
    notFound()
  }

  try {
    const anime = await getAnimeDetails(id)
    
    // Breadcrumb verileri
    const breadcrumbItems = [
      { name: 'Ana Sayfa', url: SITE_URL },
      { name: 'Animeler', url: `${SITE_URL}/animeler` },
      { name: anime.title, url: `${SITE_URL}/animeler/${id}` },
    ]
    
    return (
      <>
        {/* JSON-LD Structured Data */}
        <AnimeJsonLd
          id={anime.id}
          title={anime.title}
          overview={anime.overview}
          posterPath={anime.posterPath}
          backdropPath={anime.backdropPath}
          firstAirDate={anime.firstAirDate}
          voteAverage={anime.voteAverage}
          voteCount={anime.voteCount}
          genres={anime.genres}
          cast={anime.cast}
          crew={anime.crew}
          numberOfSeasons={anime.numberOfSeasons}
          numberOfEpisodes={anime.numberOfEpisodes}
        />
        <BreadcrumbJsonLd items={breadcrumbItems} />
        
        <MediaDetailContent media={anime} />
      </>
    )
  } catch (error) {
    console.error('Error fetching anime:', error)
    notFound()
  }
}
