import { getPopularMovies, getTrendingMovies, getTopRatedMovies, getNowPlayingMovies } from '@/lib/api/tmdb'
import { CategoryPageContent } from '@/components/category-page-content'

export const revalidate = 3600

async function getMoviesData() {
  try {
    // Timeout ile birlikte parallel çağrılar - maksimum 15 saniye
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const [popular, trending, topRated, nowPlaying] = await Promise.all([
        getPopularMovies(),
        getTrendingMovies(),
        getTopRatedMovies(),
        getNowPlayingMovies(),
      ])

      clearTimeout(timeoutId)

      return {
        featured: trending.results?.slice(0, 5) || [],
        sections: [
          { id: 'trending', titleKey: 'home.sections.trending', items: trending.results || [] },
          { id: 'popular', titleKey: 'home.sections.popular', items: popular.results || [] },
          { id: 'topRated', titleKey: 'home.sections.topRated', items: topRated.results || [] },
          { id: 'nowPlaying', titleKey: 'home.sections.newReleases', items: nowPlaying.results || [] },
        ],
      }
    } catch (timeoutError) {
      clearTimeout(timeoutId)
      throw timeoutError
    }
  } catch (error) {
    console.error('Error fetching movies:', error)
    // Fallback: boş veri döndür (boş sayfa yerine)
    return { 
      featured: [], 
      sections: [
        { id: 'trending', titleKey: 'home.sections.trending', items: [] },
        { id: 'popular', titleKey: 'home.sections.popular', items: [] },
        { id: 'topRated', titleKey: 'home.sections.topRated', items: [] },
        { id: 'nowPlaying', titleKey: 'home.sections.newReleases', items: [] },
      ]
    }
  }
}

export default async function MoviesPage() {
  const data = await getMoviesData()

  return (
    <CategoryPageContent
      title="Filmler"
      featured={data.featured}
      sections={data.sections}
    />
  )
}
