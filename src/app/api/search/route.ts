import { NextRequest, NextResponse } from 'next/server'
import { searchMulti, searchMovies, searchTVShows } from '@/lib/api/tmdb'
import { searchAnime } from '@/lib/api/anilist'

const SEARCH_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const page = searchParams.get('page') || '1'
  const type = searchParams.get('type')
  const year = searchParams.get('year') || undefined
  const includeAdult = searchParams.get('includeAdult') === 'true'

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], totalResults: 0, page: 1, totalPages: 0 })
  }

  try {
    let results

    if (type === 'movie') {
      results = await withTimeout(searchMovies(query, parseInt(page), year, includeAdult), SEARCH_TIMEOUT_MS)
    } else if (type === 'tv') {
      results = await withTimeout(searchTVShows(query, parseInt(page), year, includeAdult), SEARCH_TIMEOUT_MS)
    } else if (type === 'anime') {
      // Anime için AniList kullan
      results = await withTimeout(searchAnime(query, parseInt(page)), SEARCH_TIMEOUT_MS)
    } else {
      // Multi search - TMDB + AniList birleştir
      const [tmdbResults, animeResults] = await Promise.allSettled([
        withTimeout(searchMulti(query, parseInt(page), includeAdult), SEARCH_TIMEOUT_MS),
        withTimeout(searchAnime(query, 1, 5), SEARCH_TIMEOUT_MS) // İlk 5 anime
      ])

      const tmdb = tmdbResults.status === 'fulfilled' ? tmdbResults.value : { results: [], totalResults: 0, totalPages: 0 }
      const anime = animeResults.status === 'fulfilled' ? animeResults.value : { results: [] }

      // Anime sonuçlarını TMDB sonuçlarına ekle
      results = {
        results: [...tmdb.results, ...anime.results],
        totalResults: tmdb.totalResults + (anime.results?.length || 0),
        totalPages: tmdb.totalPages,
        page: parseInt(page)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ results: [], totalResults: 0, page: 1, totalPages: 0 }, { status: 500 })
  }
}
