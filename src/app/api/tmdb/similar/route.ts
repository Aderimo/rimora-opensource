import { NextRequest, NextResponse } from 'next/server'
import { setDefaultResultOrder } from 'node:dns'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Windows'ta IPv6 (::1) sorununu önlemek için IPv4 önceliği
setDefaultResultOrder('ipv4first')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')
  const type = searchParams.get('type') || 'movie'
  
  if (!id) {
    return NextResponse.json({ results: [] }, { status: 400 })
  }
  
  try {
    // Timeout kontrolü
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&language=tr-TR&page=1`,
      { 
        next: { revalidate: 3600 },
        signal: controller.signal
      }
    )
    
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: res.status })
    }
    
    const data = await res.json()
    
    const results = (data.results || []).slice(0, 10).map((item: any) => ({
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
      type: type,
    }))
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Similar API error:', error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
