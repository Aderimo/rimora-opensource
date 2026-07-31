import { NextRequest, NextResponse } from 'next/server'
import { getMovieGenres, getTVGenres } from '@/lib/api/tmdb'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'movie'

  try {
    const genres = type === 'movie' ? await getMovieGenres() : await getTVGenres()
    return NextResponse.json({ genres })
  } catch (error) {
    console.error('Genres API error:', error)
    return NextResponse.json({ genres: [] }, { status: 500 })
  }
}
