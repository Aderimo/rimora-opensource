import { MetadataRoute } from 'next'
import { setDefaultResultOrder } from 'node:dns'

// TMDB API yapılandırması
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Windows'ta IPv6 (::1) sorununu önlemek için IPv4 önceliği
setDefaultResultOrder('ipv4first')

// Anime için genre ID (Animation = 16)
const ANIME_GENRE_ID = 16

interface TMDBResult {
  id: number
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
}

interface TMDBResponse {
  results: TMDBResult[]
  total_pages: number
}

// TMDB'den veri çekme fonksiyonu
async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}): Promise<TMDBResponse | null> {
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not configured for sitemap generation')
    return null
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'tr-TR')

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 86400 } // 24 saat cache
    })

    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('TMDB fetch error:', error)
    return null
  }
}

// Popüler filmleri çek
async function getPopularMovies(): Promise<TMDBResult[]> {
  const results: TMDBResult[] = []

  // İlk 3 sayfa (60 film)
  for (let page = 1; page <= 3; page++) {
    const data = await fetchFromTMDB('/movie/popular', { page: String(page) })
    if (data?.results) {
      results.push(...data.results)
    }
  }

  return results
}

// Popüler dizileri çek
async function getPopularTVShows(): Promise<TMDBResult[]> {
  const results: TMDBResult[] = []

  // İlk 3 sayfa (60 dizi)
  for (let page = 1; page <= 3; page++) {
    const data = await fetchFromTMDB('/tv/popular', { page: String(page) })
    if (data?.results) {
      results.push(...data.results)
    }
  }

  return results
}

// Popüler animeleri çek (Animation genre'ı ile filtrelenmiş TV dizileri)
async function getPopularAnime(): Promise<TMDBResult[]> {
  const results: TMDBResult[] = []

  // İlk 3 sayfa (60 anime)
  for (let page = 1; page <= 3; page++) {
    const data = await fetchFromTMDB('/discover/tv', {
      page: String(page),
      with_genres: String(ANIME_GENRE_ID),
      sort_by: 'popularity.desc',
      with_original_language: 'ja' // Japonca orijinal dil (anime için)
    })
    if (data?.results) {
      results.push(...data.results)
    }
  }

  return results
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://rimora-indol.vercel.app'

  // Statik sayfalar
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/filmler`,
      lastModified: new Date(),
      priority: 0.9,
    },
    {
      url: `${baseUrl}/diziler`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/animeler`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/arama`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/giris`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/kayit`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/gizlilik`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/kullanim-kosullari`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Dinamik içerik sayfaları
  const dynamicPages: MetadataRoute.Sitemap = []

  try {
    // Paralel olarak tüm içerikleri çek
    const [movies, tvShows, anime] = await Promise.all([
      getPopularMovies(),
      getPopularTVShows(),
      getPopularAnime()
    ])

    // Film sayfaları
    movies.forEach((movie) => {
      const lastModified = movie.release_date
        ? new Date(movie.release_date)
        : new Date()

      dynamicPages.push({
        url: `${baseUrl}/filmler/${movie.id}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    })

    // Dizi sayfaları
    tvShows.forEach((show) => {
      const lastModified = show.first_air_date
        ? new Date(show.first_air_date)
        : new Date()

      dynamicPages.push({
        url: `${baseUrl}/diziler/${show.id}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    })

    // Anime sayfaları
    anime.forEach((animeItem) => {
      const lastModified = animeItem.first_air_date
        ? new Date(animeItem.first_air_date)
        : new Date()

      dynamicPages.push({
        url: `${baseUrl}/animeler/${animeItem.id}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    })

    console.log(`Sitemap generated: ${staticPages.length} static + ${dynamicPages.length} dynamic pages`)
  } catch (error) {
    console.error('Error generating dynamic sitemap entries:', error)
    // Hata durumunda sadece statik sayfaları döndür
  }

  return [...staticPages, ...dynamicPages]
}
