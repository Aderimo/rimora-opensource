import { Metadata } from 'next'
import { getMovieDetails, getImageUrl, posterSizes, TMDB_IMAGE_BASE } from '@/lib/api/tmdb'
import { MediaDetailContent } from '@/components/media/media-detail-content'
import { MovieJsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld'
import { notFound } from 'next/navigation'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rimora.com'

interface MovieDetailPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: MovieDetailPageProps): Promise<Metadata> {
  const id = parseInt(params.id)
  if (isNaN(id)) return {}

  try {
    const movie = await getMovieDetails(id)
    
    // Dinamik OG image URL'i oluştur
    const posterUrl = movie.posterPath 
      ? `${TMDB_IMAGE_BASE}/${posterSizes.large}${movie.posterPath}`
      : ''
    const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear().toString() : ''
    const rating = movie.voteAverage ? movie.voteAverage.toFixed(1) : ''
    
    const ogImageUrl = new URL(`${SITE_URL}/api/og`)
    ogImageUrl.searchParams.set('title', movie.title)
    ogImageUrl.searchParams.set('type', 'movie')
    if (year) ogImageUrl.searchParams.set('year', year)
    if (rating) ogImageUrl.searchParams.set('rating', rating)
    if (posterUrl) ogImageUrl.searchParams.set('poster', posterUrl)
    
    const description = movie.overview?.slice(0, 160) || `${movie.title} filmini Rimora'da izle`
    const canonicalUrl = `${SITE_URL}/filmler/${id}`
    
    return {
      title: movie.title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: `${movie.title} | Rimora`,
        description,
        url: canonicalUrl,
        siteName: 'Rimora',
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: movie.title,
          },
        ],
        type: 'video.movie',
        locale: 'tr_TR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${movie.title} | Rimora`,
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

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  const id = parseInt(params.id)
  
  if (isNaN(id)) {
    notFound()
  }

  try {
    const movie = await getMovieDetails(id)
    
    // Breadcrumb verileri
    const breadcrumbItems = [
      { name: 'Ana Sayfa', url: SITE_URL },
      { name: 'Filmler', url: `${SITE_URL}/filmler` },
      { name: movie.title, url: `${SITE_URL}/filmler/${id}` },
    ]
    
    return (
      <>
        {/* JSON-LD Structured Data */}
        <MovieJsonLd
          id={movie.id}
          title={movie.title}
          overview={movie.overview}
          posterPath={movie.posterPath}
          backdropPath={movie.backdropPath}
          releaseDate={movie.releaseDate}
          voteAverage={movie.voteAverage}
          voteCount={movie.voteCount}
          genres={movie.genres}
          cast={movie.cast}
          crew={movie.crew}
          runtime={movie.runtime}
        />
        <BreadcrumbJsonLd items={breadcrumbItems} />
        
        <MediaDetailContent media={movie} />
      </>
    )
  } catch (error) {
    console.error('Error fetching movie:', error)
    notFound()
  }
}
