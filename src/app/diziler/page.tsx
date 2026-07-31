import { getPopularTVShows, getTrendingTVShows, getTopRatedTVShows } from '@/lib/api/tmdb'
import { CategoryPageContent } from '@/components/category-page-content'

export const revalidate = 3600

async function getTVData() {
  try {
    const [popular, trending, topRated] = await Promise.all([
      getPopularTVShows(),
      getTrendingTVShows(),
      getTopRatedTVShows(),
    ])

    return {
      featured: trending.results.slice(0, 5),
      sections: [
        { id: 'trending', titleKey: 'home.sections.trending', items: trending.results },
        { id: 'popular', titleKey: 'home.sections.popular', items: popular.results },
        { id: 'topRated', titleKey: 'home.sections.topRated', items: topRated.results },
      ],
    }
  } catch (error) {
    console.error('Error fetching TV shows:', error)
    return { featured: [], sections: [] }
  }
}

export default async function SeriesPage() {
  const data = await getTVData()

  return (
    <CategoryPageContent
      title="Diziler"
      featured={data.featured}
      sections={data.sections}
    />
  )
}
