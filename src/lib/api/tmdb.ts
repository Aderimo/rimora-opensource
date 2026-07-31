import type { Media, MediaDetail, TMDBResponse, Genre } from '@/types'
import type { 
  TMDBMovieResponse, 
  TMDBTVResponse, 
  TMDBMovieDetailResponse, 
  TMDBTVDetailResponse,
  TMDBSeasonResponse,
  TMDBEpisodeResponse,
  TMDBPersonResponse,
  TMDBVideoResponse,
  TMDBMultiSearchResponse,
  TMDBMultiSearchItem
} from '@/types/api'

// Server-side'da doğrudan TMDB'ye bağlan (self-referencing loop'u önle)
// Client-side'da proxy üzerinden git (API key gizli kalır)
const isServer = typeof window === 'undefined'
const TMDB_PROXY_URL = '/api/tmdb'
const TMDB_DIRECT_URL = 'https://api.themoviedb.org/3'
const TMDB_API_KEY = isServer ? process.env.TMDB_API_KEY : undefined

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

// Image sizes
export const posterSizes = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
  original: 'original',
} as const

export const backdropSizes = {
  small: 'w300',
  medium: 'w780',
  large: 'w1280',
  original: 'original',
} as const

// Helper to build image URLs
// DPI bypass için image proxy kullanılıyor (Türkiye'de image.tmdb.org engelli)
export function getImageUrl(
  path: string | null,
  size: string = 'w500'
): string | null {
  if (!path) return null
  // AniList gibi dış kaynaklardan gelen tam URL'ler (https://...) doğrudan proxy'lenir
  if (path.startsWith('http')) {
    return `/api/image-proxy?url=${encodeURIComponent(path)}`
  }
  const originalUrl = `${TMDB_IMAGE_BASE}/${size}${path}`
  // Proxy üzerinden yönlendir - DPI bypass
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`
}

// Orijinal URL'i döndüren fonksiyon (gerekirse)
export function getDirectImageUrl(
  path: string | null,
  size: string = 'w500'
): string | null {
  if (!path) return null
  // Tam URL zaten varsa doğrudan döndür
  if (path.startsWith('http')) return path
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

// API fetch helper - Proxy üzerinden TMDB'ye istek yapar
// NOT: IPv4 önceliği next.config.js'de global olarak ayarlanır (node:dns burada kullanılamaz, webpack client bundle hatası verir)

async function fetchTMDB<T>(
  endpoint: string,
  params: Record<string, string> = {},
  attempt = 1
): Promise<T> {
  let url: URL

  if (isServer && TMDB_API_KEY) {
    // Server-side: TMDB'ye doğrudan bağlan (proxy self-loop'u önle)
    url = new URL(`${TMDB_DIRECT_URL}${endpoint}`)
    url.searchParams.set('api_key', TMDB_API_KEY)
  } else {
    // Client-side: proxy üzerinden git
    url = new URL(`${TMDB_PROXY_URL}${endpoint}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  }

  // Dil parametresini ekle
  url.searchParams.set('language', 'tr-TR')

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })

  const controller = new AbortController()
  const timeoutMs = attempt === 1 ? 20000 : 35000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    }

    // Client-side'da Next.js cache kullan, server-side'da cache kullanma
    if (!isServer) {
      fetchOptions.next = { revalidate: 3600 }
    }

    const res = await fetch(url.toString(), fetchOptions)

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(`TMDB API Error: ${res.status} - ${errorData.status_message || 'Unknown error'}`)
    }

    return res.json()
  } catch (error) {
    const name = (error as Error)?.name
    if (name === 'AbortError' && attempt < 2) {
      return fetchTMDB<T>(endpoint, params, attempt + 1)
    }
    console.error(`TMDB Fetch Error for ${endpoint}:`, error)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// Transform TMDB movie to our Media type
function transformMovie(movie: TMDBMovieResponse): Media {
  return {
    id: movie.id,
    type: 'movie',
    title: movie.title || movie.name,
    originalTitle: movie.original_title || movie.original_name,
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    genreIds: movie.genre_ids || [],
    popularity: movie.popularity,
  }
}

// Transform TMDB TV show to our Media type
function transformTVShow(show: TMDBTVResponse): Media {
  return {
    id: show.id,
    type: 'tv',
    title: show.name || show.title,
    originalTitle: show.original_name || show.original_title,
    overview: show.overview,
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    firstAirDate: show.first_air_date,
    voteAverage: show.vote_average,
    voteCount: show.vote_count,
    genreIds: show.genre_ids || [],
    popularity: show.popularity,
  }
}

// ============ MOVIES ============

export async function getPopularMovies(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>('/movie/popular', { page: String(page) })
  return {
    page: data.page,
    results: data.results.map(transformMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>(`/trending/movie/${timeWindow}`)
  return {
    page: data.page,
    results: data.results.map(transformMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getTopRatedMovies(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>('/movie/top_rated', { page: String(page) })
  return {
    page: data.page,
    results: data.results.map(transformMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getNowPlayingMovies(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>('/movie/now_playing', { page: String(page) })
  return {
    page: data.page,
    results: data.results.map(transformMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getUpcomingMovies(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>('/movie/upcoming', { page: String(page) })
  return {
    page: data.page,
    results: data.results.map(transformMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

// ============ TV SHOWS ============

export async function getPopularTVShows(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>('/tv/popular', { page: String(page) })
  return {
    page: data.page,
    results: data.results.map(transformTVShow),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getTrendingTVShows(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>(`/trending/tv/${timeWindow}`)
  return {
    page: data.page,
    results: data.results.map(transformTVShow),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getTopRatedTVShows(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<any>('/tv/top_rated', { page: String(page) })
  return {
    page: data.page,
    results: data.results.map(transformTVShow),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

// ============ ANIME (Animation genre) ============

export async function getPopularAnime(page = 1): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<TMDBResponse<TMDBTVResponse>>('/discover/tv', {
    page: String(page),
    with_genres: '16',
    with_origin_country: 'JP',
    sort_by: 'popularity.desc',
  })
  return {
    page: data.page,
    results: data.results.map((show: TMDBTVResponse) => ({ ...transformTVShow(show), type: 'anime' as const })),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function getTrendingAnime(): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<TMDBResponse<TMDBTVResponse>>('/discover/tv', {
    with_genres: '16',
    with_origin_country: 'JP',
    sort_by: 'vote_count.desc',
  })
  return {
    page: data.page,
    results: data.results.map((show: TMDBTVResponse) => ({ ...transformTVShow(show), type: 'anime' as const })),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

// ============ SEARCH ============

export async function searchMulti(query: string, page = 1, includeAdult = false): Promise<TMDBResponse<Media>> {
  const data = await fetchTMDB<TMDBMultiSearchResponse>('/search/multi', {
    query,
    page: String(page),
    include_adult: String(includeAdult)
  })
  return {
    page: data.page,
    results: data.results
      .filter((item: TMDBMultiSearchItem) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item: TMDBMultiSearchItem) => {
        if (item.media_type === 'movie') {
          return transformMovie(item as TMDBMovieResponse)
        }
        return transformTVShow(item as TMDBTVResponse)
      }),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function searchMovies(query: string, page = 1, year?: string, includeAdult = false): Promise<TMDBResponse<Media>> {
  const params: Record<string, string> = {
    query,
    page: String(page),
    include_adult: String(includeAdult)
  }
  if (year) params.primary_release_year = year

  const data = await fetchTMDB<any>('/search/movie', params)
  return {
    page: data.page,
    results: data.results.map(transformMovie),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

export async function searchTVShows(query: string, page = 1, year?: string, includeAdult = false): Promise<TMDBResponse<Media>> {
  const params: Record<string, string> = {
    query,
    page: String(page),
    include_adult: String(includeAdult)
  }
  if (year) params.first_air_date_year = year

  const data = await fetchTMDB<any>('/search/tv', params)
  return {
    page: data.page,
    results: data.results.map(transformTVShow),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

// ============ DISCOVER WITH FILTERS ============

export interface DiscoverFilters {
  type?: 'movie' | 'tv' | 'anime'
  genres?: string[]
  yearFrom?: number
  yearTo?: number
  country?: string
  sortBy?: string
  minRating?: number
  page?: number
  includeAdult?: boolean
}

export async function discoverMedia(filters: DiscoverFilters): Promise<TMDBResponse<Media>> {
  const { type = 'movie', genres, yearFrom, yearTo, country, sortBy = 'popularity.desc', minRating, page = 1, includeAdult = false } = filters

  const params: Record<string, string> = {
    page: String(page),
    sort_by: sortBy,
    include_adult: String(includeAdult),
  }

  // Genre filter
  if (genres && genres.length > 0) {
    params.with_genres = genres.join(',')
  }

  // Year filter
  if (type === 'movie') {
    if (yearFrom) params['primary_release_date.gte'] = `${yearFrom}-01-01`
    if (yearTo) params['primary_release_date.lte'] = `${yearTo}-12-31`
  } else {
    if (yearFrom) params['first_air_date.gte'] = `${yearFrom}-01-01`
    if (yearTo) params['first_air_date.lte'] = `${yearTo}-12-31`
  }

  // Country filter
  if (country) {
    params.with_origin_country = country
  }

  // Min rating filter
  if (minRating) {
    params['vote_average.gte'] = String(minRating)
    params['vote_count.gte'] = '100' // En az 100 oy almış olsun
  }

  // Anime special case
  if (type === 'anime') {
    params.with_genres = genres?.length ? `16,${genres.join(',')}` : '16'
    params.with_origin_country = 'JP'
    const data = await fetchTMDB<TMDBResponse<TMDBTVResponse>>('/discover/tv', params)
    return {
      page: data.page,
      results: data.results.map((show: TMDBTVResponse) => ({ ...transformTVShow(show), type: 'anime' as const })),
      totalPages: data.total_pages,
      totalResults: data.total_results,
    }
  }

  const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv'
  const data = await fetchTMDB<any>(endpoint, params)

  return {
    page: data.page,
    results: data.results.map(type === 'movie' ? transformMovie : transformTVShow),
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }
}

// ============ GENRES ============

export async function getMovieGenres(): Promise<Genre[]> {
  const data = await fetchTMDB<{ genres: Genre[] }>('/genre/movie/list')
  return data.genres
}

export async function getTVGenres(): Promise<Genre[]> {
  const data = await fetchTMDB<{ genres: Genre[] }>('/genre/tv/list')
  return data.genres
}

// ============ DETAILS ============

export async function getMovieDetails(id: number): Promise<MediaDetail> {
  const data = await fetchTMDB<TMDBMovieDetailResponse>(`/movie/${id}`, {
    append_to_response: 'credits,similar,videos',
  })

  return {
    ...transformMovie(data),
    genres: data.genres,
    runtime: data.runtime,
    status: data.status,
    tagline: data.tagline,
    cast: data.credits?.cast?.slice(0, 10).map((person: TMDBPersonResponse) => ({
      id: person.id,
      name: person.name,
      profilePath: person.profile_path,
      character: person.character,
    })) || [],
    crew: data.credits?.crew?.filter((p: TMDBPersonResponse) => p.job === 'Director').map((person: TMDBPersonResponse) => ({
      id: person.id,
      name: person.name,
      profilePath: person.profile_path,
      job: person.job,
    })) || [],
    similar: data.similar?.results?.slice(0, 12).map(transformMovie) || [],
    videos: data.videos?.results?.filter((v: TMDBVideoResponse) => v.site === 'YouTube') || [],
  }
}

export async function getTVDetails(id: number): Promise<MediaDetail> {
  const data = await fetchTMDB<TMDBTVDetailResponse>(`/tv/${id}`, {
    append_to_response: 'credits,similar,videos',
  })

  return {
    ...transformTVShow(data),
    genres: data.genres,
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    status: data.status,
    tagline: data.tagline,
    cast: data.credits?.cast?.slice(0, 10).map((person: TMDBPersonResponse) => ({
      id: person.id,
      name: person.name,
      profilePath: person.profile_path,
      character: person.character,
    })) || [],
    crew: data.credits?.crew?.filter((p: TMDBPersonResponse) => p.job === 'Director' || p.job === 'Creator').map((person: TMDBPersonResponse) => ({
      id: person.id,
      name: person.name,
      profilePath: person.profile_path,
      job: person.job,
    })) || [],
    similar: data.similar?.results?.slice(0, 12).map(transformTVShow) || [],
    videos: data.videos?.results?.filter((v: TMDBVideoResponse) => v.site === 'YouTube') || [],
  }
}


// ============ SEASONS & EPISODES ============

export interface SeasonInfo {
  id: number
  seasonNumber: number
  name: string
  overview: string
  posterPath: string | null
  episodeCount: number
  airDate: string | null
}

export interface EpisodeInfo {
  id: number
  episodeNumber: number
  seasonNumber: number
  name: string
  overview: string
  stillPath: string | null
  airDate: string | null
  runtime: number | null
  voteAverage: number
}

export async function getTVSeasons(tvId: number): Promise<SeasonInfo[]> {
  const data = await fetchTMDB<TMDBTVDetailResponse>(`/tv/${tvId}`)

  return (data.seasons || [])
    .filter((s: TMDBSeasonResponse) => s.season_number > 0) // Exclude specials (season 0)
    .map((season: TMDBSeasonResponse) => ({
      id: season.id,
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview,
      posterPath: season.poster_path,
      episodeCount: season.episode_count,
      airDate: season.air_date,
    }))
}

export async function getSeasonEpisodes(tvId: number, seasonNumber: number): Promise<EpisodeInfo[]> {
  const data = await fetchTMDB<{ episodes: TMDBEpisodeResponse[] }>(`/tv/${tvId}/season/${seasonNumber}`)

  return (data.episodes || []).map((episode: TMDBEpisodeResponse) => ({
    id: episode.id,
    episodeNumber: episode.episode_number,
    seasonNumber: episode.season_number,
    name: episode.name,
    overview: episode.overview,
    stillPath: episode.still_path,
    airDate: episode.air_date,
    runtime: episode.runtime,
    voteAverage: episode.vote_average,
  }))
}

export async function getEpisodeDetails(tvId: number, seasonNumber: number, episodeNumber: number): Promise<EpisodeInfo> {
  const data = await fetchTMDB<any>(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`)

  return {
    id: data.id,
    episodeNumber: data.episode_number,
    seasonNumber: data.season_number,
    name: data.name,
    overview: data.overview,
    stillPath: data.still_path,
    airDate: data.air_date,
    runtime: data.runtime,
    voteAverage: data.vote_average,
  }
}

// Get TV details with seasons included
export async function getTVDetailsWithSeasons(id: number): Promise<MediaDetail & { seasons: SeasonInfo[] }> {
  const data = await fetchTMDB<TMDBTVDetailResponse>(`/tv/${id}`, {
    append_to_response: 'credits,similar,videos',
  })

  const seasons = (data.seasons || [])
    .filter((s: TMDBSeasonResponse) => s.season_number > 0)
    .map((season: TMDBSeasonResponse) => ({
      id: season.id,
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview,
      posterPath: season.poster_path,
      episodeCount: season.episode_count,
      airDate: season.air_date,
    }))

  return {
    ...transformTVShow(data),
    genres: data.genres,
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    status: data.status,
    tagline: data.tagline,
    cast: data.credits?.cast?.slice(0, 10).map((person: TMDBPersonResponse) => ({
      id: person.id,
      name: person.name,
      profilePath: person.profile_path,
      character: person.character,
    })) || [],
    crew: data.credits?.crew?.filter((p: TMDBPersonResponse) => p.job === 'Director' || p.job === 'Creator').map((person: TMDBPersonResponse) => ({
      id: person.id,
      name: person.name,
      profilePath: person.profile_path,
      job: person.job,
    })) || [],
    similar: data.similar?.results?.slice(0, 12).map(transformTVShow) || [],
    videos: data.videos?.results?.filter((v: TMDBVideoResponse) => v.site === 'YouTube') || [],
    seasons,
  }
}
