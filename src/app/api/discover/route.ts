import { NextRequest, NextResponse } from 'next/server'
import { setDefaultResultOrder } from 'node:dns'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Windows'ta IPv6 (::1) sorununu önlemek için IPv4 önceliği
setDefaultResultOrder('ipv4first')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'movie'
  const page = searchParams.get('page') || '1'
  const genres = searchParams.get('genres') || ''
  const yearFrom = searchParams.get('yearFrom') || ''
  const yearTo = searchParams.get('yearTo') || ''
  const country = searchParams.get('country') || ''
  const sortBy = searchParams.get('sortBy') || 'popularity.desc'
  const minRating = searchParams.get('minRating') || ''
  const includeAdult = searchParams.get('includeAdult') === 'true'

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY || '',
      language: 'tr-TR',
      page,
      sort_by: sortBy,
      include_adult: String(includeAdult),
    })

    // Genres
    if (genres) {
      params.set('with_genres', genres)
    }

    // Year range
    if (type === 'movie') {
      if (yearFrom) params.set('primary_release_date.gte', `${yearFrom}-01-01`)
      if (yearTo) params.set('primary_release_date.lte', `${yearTo}-12-31`)
    } else {
      if (yearFrom) params.set('first_air_date.gte', `${yearFrom}-01-01`)
      if (yearTo) params.set('first_air_date.lte', `${yearTo}-12-31`)
    }

    // Country
    if (country) {
      params.set('with_origin_country', country)
    }

    // Min rating
    if (minRating) {
      params.set('vote_average.gte', minRating)
    }

    // Anime filter
    if (type === 'anime') {
      params.set('with_genres', genres ? `${genres},16` : '16')
      params.set('with_origin_country', 'JP')
    }

    const endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv'
    
    // Timeout kontrolü
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${params.toString()}`, {
      next: { revalidate: 3600 },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const data = await response.json()

    const results = (data.results || []).map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      posterPath: item.poster_path,
      backdropPath: item.backdrop_path,
      overview: item.overview,
      releaseDate: item.release_date || item.first_air_date,
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
      genreIds: item.genre_ids,
      type: type === 'anime' ? 'anime' : type,
      popularity: item.popularity,
    }))

    return NextResponse.json({
      results,
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  } catch (error) {
    console.error('Discover API error:', error)
    return NextResponse.json({ results: [], page: 1, totalPages: 0, totalResults: 0 }, { status: 500 })
  }
}
