'use client'

import Script from 'next/script'

// ============ TYPES ============

interface Person {
  id: number
  name: string
  profilePath?: string | null
  character?: string
  job?: string
}

interface Genre {
  id: number
  name: string
}

interface BaseMediaProps {
  id: number
  title: string
  overview?: string | null
  posterPath?: string | null
  backdropPath?: string | null
  voteAverage?: number
  voteCount?: number
  genres?: Genre[]
  cast?: Person[]
  crew?: Person[]
}

interface MovieJsonLdProps extends BaseMediaProps {
  releaseDate?: string | null
  runtime?: number | null
}

interface TVSeriesJsonLdProps extends BaseMediaProps {
  firstAirDate?: string | null
  numberOfSeasons?: number
  numberOfEpisodes?: number
}

interface AnimeJsonLdProps extends TVSeriesJsonLdProps {}

interface WebsiteJsonLdProps {
  name?: string
  description?: string
  url?: string
}

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[]
}

// ============ HELPERS ============

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rimora.com'

function getImageUrl(path: string | null | undefined): string | undefined {
  return `${TMDB_IMAGE_BASE}/w500${path}`
  if (!path) return undefined
  if (path.startsWith('http')) return path
  return `${TMDB_IMAGE_BASE}/w500${path}`
}

function formatDate(date: string | null | undefined): string | undefined {
  if (!date) return undefined
  return date
}

// ============ MOVIE JSON-LD ============

/**
 * Film için JSON-LD structured data komponenti
 * schema.org/Movie tipini kullanır
 * 
 * @example
 * <MovieJsonLd
 *   id={movie.id}
 *   title={movie.title}
 *   overview={movie.overview}
 *   posterPath={movie.posterPath}
 *   releaseDate={movie.releaseDate}
 *   voteAverage={movie.voteAverage}
 *   voteCount={movie.voteCount}
 *   genres={movie.genres}
 *   cast={movie.cast}
 *   crew={movie.crew}
 *   runtime={movie.runtime}
 * />
 */
export function MovieJsonLd({
  id,
  title,
  overview,
  posterPath,
  backdropPath,
  releaseDate,
  voteAverage,
  voteCount,
  genres,
  cast,
  crew,
  runtime,
}: MovieJsonLdProps) {
  const directors = crew?.filter(p => p.job === 'Director') || []
  const actors = cast?.slice(0, 5) || []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    '@id': `${SITE_URL}/filmler/${id}`,
    name: title,
    description: overview || undefined,
    image: getImageUrl(posterPath) || getImageUrl(backdropPath),
    datePublished: formatDate(releaseDate),
    duration: runtime ? `PT${runtime}M` : undefined,
    genre: genres?.map(g => g.name),
    director: directors.length > 0 ? directors.map(d => ({
      '@type': 'Person',
      name: d.name,
    })) : undefined,
    actor: actors.length > 0 ? actors.map(a => ({
      '@type': 'Person',
      name: a.name,
    })) : undefined,
    aggregateRating: voteAverage && voteCount && voteCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: voteAverage.toFixed(1),
      bestRating: '10',
      worstRating: '0',
      ratingCount: voteCount,
    } : undefined,
    url: `${SITE_URL}/filmler/${id}`,
    inLanguage: 'tr',
    potentialAction: {
      '@type': 'WatchAction',
      target: `${SITE_URL}/filmler/${id}`,
    },
  }

  // undefined değerleri temizle
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd))

  return (
    <Script
      id={`movie-jsonld-${id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  )
}

// ============ TV SERIES JSON-LD ============

/**
 * Dizi için JSON-LD structured data komponenti
 * schema.org/TVSeries tipini kullanır
 * 
 * @example
 * <TVSeriesJsonLd
 *   id={series.id}
 *   title={series.title}
 *   overview={series.overview}
 *   posterPath={series.posterPath}
 *   firstAirDate={series.firstAirDate}
 *   voteAverage={series.voteAverage}
 *   voteCount={series.voteCount}
 *   genres={series.genres}
 *   cast={series.cast}
 *   numberOfSeasons={series.numberOfSeasons}
 *   numberOfEpisodes={series.numberOfEpisodes}
 * />
 */
export function TVSeriesJsonLd({
  id,
  title,
  overview,
  posterPath,
  backdropPath,
  firstAirDate,
  voteAverage,
  voteCount,
  genres,
  cast,
  crew,
  numberOfSeasons,
  numberOfEpisodes,
}: TVSeriesJsonLdProps) {
  const creators = crew?.filter(p => p.job === 'Creator') || []
  const actors = cast?.slice(0, 5) || []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': `${SITE_URL}/diziler/${id}`,
    name: title,
    description: overview || undefined,
    image: getImageUrl(posterPath) || getImageUrl(backdropPath),
    datePublished: formatDate(firstAirDate),
    numberOfSeasons: numberOfSeasons,
    numberOfEpisodes: numberOfEpisodes,
    genre: genres?.map(g => g.name),
    creator: creators.length > 0 ? creators.map(c => ({
      '@type': 'Person',
      name: c.name,
    })) : undefined,
    actor: actors.length > 0 ? actors.map(a => ({
      '@type': 'Person',
      name: a.name,
    })) : undefined,
    aggregateRating: voteAverage && voteCount && voteCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: voteAverage.toFixed(1),
      bestRating: '10',
      worstRating: '0',
      ratingCount: voteCount,
    } : undefined,
    url: `${SITE_URL}/diziler/${id}`,
    inLanguage: 'tr',
    potentialAction: {
      '@type': 'WatchAction',
      target: `${SITE_URL}/diziler/${id}`,
    },
  }

  // undefined değerleri temizle
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd))

  return (
    <Script
      id={`tvseries-jsonld-${id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  )
}

// ============ ANIME JSON-LD ============

/**
 * Anime için JSON-LD structured data komponenti
 * schema.org/TVSeries tipini kullanır (anime için özel tip yok)
 * 
 * @example
 * <AnimeJsonLd
 *   id={anime.id}
 *   title={anime.title}
 *   overview={anime.overview}
 *   posterPath={anime.posterPath}
 *   firstAirDate={anime.firstAirDate}
 *   voteAverage={anime.voteAverage}
 *   voteCount={anime.voteCount}
 *   genres={anime.genres}
 *   cast={anime.cast}
 *   numberOfSeasons={anime.numberOfSeasons}
 *   numberOfEpisodes={anime.numberOfEpisodes}
 * />
 */
export function AnimeJsonLd({
  id,
  title,
  overview,
  posterPath,
  backdropPath,
  firstAirDate,
  voteAverage,
  voteCount,
  genres,
  cast,
  crew,
  numberOfSeasons,
  numberOfEpisodes,
}: AnimeJsonLdProps) {
  const creators = crew?.filter(p => p.job === 'Creator') || []
  const actors = cast?.slice(0, 5) || []

  // Anime için genre'lere "Animation" ekle
  const animeGenres = genres?.map(g => g.name) || []
  if (!animeGenres.includes('Animation') && !animeGenres.includes('Animasyon')) {
    animeGenres.unshift('Animation')
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': `${SITE_URL}/animeler/${id}`,
    name: title,
    description: overview || undefined,
    image: getImageUrl(posterPath) || getImageUrl(backdropPath),
    datePublished: formatDate(firstAirDate),
    numberOfSeasons: numberOfSeasons,
    numberOfEpisodes: numberOfEpisodes,
    genre: animeGenres,
    countryOfOrigin: {
      '@type': 'Country',
      name: 'Japan',
    },
    creator: creators.length > 0 ? creators.map(c => ({
      '@type': 'Person',
      name: c.name,
    })) : undefined,
    actor: actors.length > 0 ? actors.map(a => ({
      '@type': 'Person',
      name: a.name,
    })) : undefined,
    aggregateRating: voteAverage && voteCount && voteCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: voteAverage.toFixed(1),
      bestRating: '10',
      worstRating: '0',
      ratingCount: voteCount,
    } : undefined,
    url: `${SITE_URL}/animeler/${id}`,
    inLanguage: 'ja',
    potentialAction: {
      '@type': 'WatchAction',
      target: `${SITE_URL}/animeler/${id}`,
    },
  }

  // undefined değerleri temizle
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd))

  return (
    <Script
      id={`anime-jsonld-${id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  )
}

// ============ WEBSITE JSON-LD ============

/**
 * Ana sayfa için JSON-LD structured data komponenti
 * schema.org/WebSite tipini kullanır
 * 
 * @example
 * <WebsiteJsonLd
 *   name="Rimora"
 *   description="Film, dizi ve anime izleme platformu"
 *   url="https://rimora.com"
 * />
 */
export function WebsiteJsonLd({
  name = 'Rimora',
  description = 'Film, dizi ve anime izleme platformu',
  url = SITE_URL,
}: WebsiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    name,
    description,
    url,
    inLanguage: 'tr',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${url}/arama?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Rimora',
      url,
      logo: {
        '@type': 'ImageObject',
        url: `${url}/logo.png`,
      },
    },
  }

  return (
    <Script
      id="website-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============ BREADCRUMB JSON-LD ============

/**
 * Breadcrumb navigasyonu için JSON-LD structured data komponenti
 * schema.org/BreadcrumbList tipini kullanır
 * 
 * @example
 * <BreadcrumbJsonLd
 *   items={[
 *     { name: 'Ana Sayfa', url: 'https://rimora.com' },
 *     { name: 'Filmler', url: 'https://rimora.com/filmler' },
 *     { name: 'Inception', url: 'https://rimora.com/filmler/27205' },
 *   ]}
 * />
 */
export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  if (!items || items.length === 0) return null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <Script
      id="breadcrumb-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============ ORGANIZATION JSON-LD ============

/**
 * Organizasyon bilgisi için JSON-LD structured data komponenti
 * schema.org/Organization tipini kullanır
 */
export function OrganizationJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Rimora',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    sameAs: [
      // Sosyal medya linkleri eklenebilir
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Turkish', 'English'],
    },
  }

  return (
    <Script
      id="organization-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============ VIDEO OBJECT JSON-LD ============

interface VideoObjectJsonLdProps {
  name: string
  description?: string
  thumbnailUrl?: string
  uploadDate?: string
  duration?: number // dakika cinsinden
  contentUrl?: string
  embedUrl?: string
}

/**
 * Video içeriği için JSON-LD structured data komponenti
 * schema.org/VideoObject tipini kullanır
 */
export function VideoObjectJsonLd({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  contentUrl,
  embedUrl,
}: VideoObjectJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description: description || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    uploadDate: uploadDate || undefined,
    duration: duration ? `PT${duration}M` : undefined,
    contentUrl: contentUrl || undefined,
    embedUrl: embedUrl || undefined,
  }

  // undefined değerleri temizle
  const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd))

  return (
    <Script
      id="video-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
    />
  )
}
