import { 
  getTrendingMovies, 
  getPopularMovies, 
  getPopularTVShows, 
  getPopularAnime,
  getTopRatedMovies,
} from '@/lib/api/tmdb'
import { HeroSlider } from '@/components/media/hero-slider'
import { MediaRow } from '@/components/media/media-row'
import { HomeContent } from './home-content'

export const revalidate = 3600 // Revalidate every hour

async function getHomeData() {
  try {
    // Timeout ile paralel çağrılar - maksimum 15 saniye
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const [trending, popularMovies, popularTV, anime, topRated] = await Promise.all([
        getTrendingMovies('week'),
        getPopularMovies(),
        getPopularTVShows(),
        getPopularAnime(),
        getTopRatedMovies(),
      ])

      clearTimeout(timeoutId)

      return {
        featured: trending.results?.slice(0, 5) || [],
        trending: trending.results?.slice(0, 20) || [],
        popularMovies: popularMovies.results?.slice(0, 20) || [],
        popularTV: popularTV.results?.slice(0, 20) || [],
        anime: anime.results?.slice(0, 20) || [],
        topRated: topRated.results?.slice(0, 20) || [],
      }
    } catch (timeoutError) {
      clearTimeout(timeoutId)
      throw timeoutError
    }
  } catch (error) {
    console.error('Error fetching home data:', error)
    return {
      featured: [],
      trending: [],
      popularMovies: [],
      popularTV: [],
      anime: [],
      topRated: [],
    }
  }
}

export default async function Home() {
  const data = await getHomeData()

  return (
    <div className="flex flex-col">
      {/* Hero Slider */}
      {data.featured.length > 0 && (
        <HeroSlider items={data.featured} />
      )}

      {data.featured.length === 0 && (
        <section className="relative h-[50vh] min-h-[360px] overflow-hidden bg-gradient-to-r from-black via-purple-950/60 to-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.25),_transparent_55%)]" />
          <div className="relative z-10 flex h-full items-center">
            <div className="container mx-auto px-4">
              <div className="max-w-xl">
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Rimora'da keşfetmeye başla</h1>
                <p className="text-white/80 text-base md:text-lg">Popüler filmler, diziler ve animeler burada. İçerikler yüklenir yüklenmez burada görünecek.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Content Sections */}
      <HomeContent data={data} />
    </div>
  )
}
