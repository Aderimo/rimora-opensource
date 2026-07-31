import { NextRequest, NextResponse } from 'next/server'
import { setDefaultResultOrder } from 'node:dns'

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Windows'ta IPv6 (::1) sorununu önlemek için IPv4 önceliği
setDefaultResultOrder('ipv4first')

// Popüler koleksiyonlar (ID'ler TMDB'den)
const POPULAR_COLLECTIONS = [
  { id: 86311, name: 'Avengers Koleksiyonu', query: 'avengers' },
  { id: 10, name: 'Star Wars Koleksiyonu', query: 'star wars' },
  { id: 119, name: 'Lord of the Rings Koleksiyonu', query: 'lord of the rings' },
  { id: 328, name: 'Jurassic Park Koleksiyonu', query: 'jurassic' },
  { id: 2344, name: 'Matrix Koleksiyonu', query: 'matrix' },
  { id: 1241, name: 'Harry Potter Koleksiyonu', query: 'harry potter' },
  { id: 9485, name: 'Fast & Furious Koleksiyonu', query: 'fast furious' },
  { id: 131296, name: 'Spider-Man (MCU) Koleksiyonu', query: 'spider-man' },
  { id: 748, name: 'X-Men Koleksiyonu', query: 'x-men' },
  { id: 263, name: 'Dark Knight Koleksiyonu', query: 'dark knight' },
  { id: 87359, name: 'Mission: Impossible Koleksiyonu', query: 'mission impossible' },
  { id: 528, name: 'Terminator Koleksiyonu', query: 'terminator' },
  { id: 2806, name: 'American Pie Koleksiyonu', query: 'american pie' },
  { id: 1570, name: 'Die Hard Koleksiyonu', query: 'die hard' },
  { id: 529892, name: 'John Wick Koleksiyonu', query: 'john wick' },
  { id: 495, name: 'Shrek Koleksiyonu', query: 'shrek' },
  { id: 404609, name: 'Conjuring Koleksiyonu', query: 'conjuring' },
  { id: 656, name: 'Saw Koleksiyonu', query: 'saw' },
  { id: 2150, name: 'Godfather Koleksiyonu', query: 'godfather' },
  { id: 84, name: 'Indiana Jones Koleksiyonu', query: 'indiana jones' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const collectionId = searchParams.get('id')

  try {
    // Belirli bir koleksiyonun detaylarını getir
    if (collectionId) {
      const response = await fetch(
        `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${TMDB_API_KEY}&language=tr-TR`
      )
      const data = await response.json()

      if (data.success === false) {
        return NextResponse.json({ error: 'Koleksiyon bulunamadı' }, { status: 404 })
      }

      const collection = {
        id: data.id,
        name: data.name,
        overview: data.overview,
        posterPath: data.poster_path,
        backdropPath: data.backdrop_path,
        parts: (data.parts || []).map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          overview: movie.overview,
          releaseDate: movie.release_date,
          voteAverage: movie.vote_average,
          voteCount: movie.vote_count,
          type: 'movie',
        })).sort((a: any, b: any) => {
          // Yayın tarihine göre sırala
          if (!a.releaseDate) return 1
          if (!b.releaseDate) return -1
          return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
        }),
      }

      return NextResponse.json(collection)
    }

    // Koleksiyon ara
    if (query.length >= 2) {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/collection?api_key=${TMDB_API_KEY}&language=tr-TR&query=${encodeURIComponent(query)}`
      )
      const data = await response.json()

      const collections = (data.results || []).slice(0, 20).map((item: any) => ({
        id: item.id,
        name: item.name,
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        overview: item.overview,
      }))

      return NextResponse.json({ results: collections, totalResults: data.total_results })
    }

    // Query yoksa popüler koleksiyonları döndür
    const popularWithDetails = await Promise.all(
      POPULAR_COLLECTIONS.slice(0, 12).map(async (col) => {
        try {
          const response = await fetch(
            `${TMDB_BASE_URL}/collection/${col.id}?api_key=${TMDB_API_KEY}&language=tr-TR`
          )
          const data = await response.json()
          return {
            id: data.id,
            name: data.name,
            posterPath: data.poster_path,
            backdropPath: data.backdrop_path,
            overview: data.overview,
            partCount: data.parts?.length || 0,
          }
        } catch {
          return null
        }
      })
    )

    return NextResponse.json({
      results: popularWithDetails.filter(Boolean),
      totalResults: popularWithDetails.filter(Boolean).length,
    })
  } catch (error) {
    console.error('Collections API error:', error)
    return NextResponse.json({ results: [], totalResults: 0 }, { status: 500 })
  }
}
