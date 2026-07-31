import { getPopularAnime, getTrendingAnime } from '@/lib/api/tmdb'
import { CategoryPageContent } from '@/components/category-page-content'

export const revalidate = 3600

async function getAnimeData() {
  try {
    const [popular, trending] = await Promise.all([
      getPopularAnime(),
      getTrendingAnime(),
    ])

    return {
      featured: popular.results.slice(0, 5),
      sections: [
        { id: 'popular', titleKey: 'home.sections.popular', items: popular.results },
        { id: 'topRated', titleKey: 'home.sections.topRated', items: trending.results },
      ],
    }
  } catch (error) {
    console.error('Error fetching anime:', error)
    return { featured: [], sections: [] }
  }
}

export default async function AnimePage() {
  const data = await getAnimeData()

  return (
    <CategoryPageContent
      title="Animeler"
      featured={data.featured}
      sections={data.sections}
    />
  )
}
