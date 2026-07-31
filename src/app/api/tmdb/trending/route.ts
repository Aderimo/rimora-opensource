import { NextResponse } from 'next/server'
import { setDefaultResultOrder } from 'node:dns'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Windows'ta IPv6 (::1) sorununu önlemek için IPv4 önceliği
setDefaultResultOrder('ipv4first')

export async function GET() {
  try {
    // Timeout kontrolü ile fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=tr-TR`,
      { 
        next: { revalidate: 3600 },
        signal: controller.signal
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      console.error(`TMDB trending API error: ${res.status}`)
      return NextResponse.json({ results: [] }, { status: res.status })
    }
    
    const data = await res.json()
    
    const results = (data.results || []).map((item: any) => ({
      id: item.id,
      title: item.title || item.name,
      originalTitle: item.original_title || item.original_name,
      overview: item.overview,
      posterPath: item.poster_path,
      backdropPath: item.backdrop_path,
      releaseDate: item.release_date || item.first_air_date,
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
      genreIds: item.genre_ids,
      type: item.media_type === 'movie' ? 'movie' : 'tv',
    }))
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Trending API error:', error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
