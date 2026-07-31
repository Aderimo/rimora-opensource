import { searchMulti } from '@/lib/api/tmdb'
import { SearchContent } from './search-content'

interface SearchPageProps {
  searchParams: { q?: string }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || ''
  
  let results = null
  if (query.length >= 2) {
    try {
      results = await searchMulti(query)
    } catch (error) {
      console.error('Search error:', error)
    }
  }

  return <SearchContent initialQuery={query} initialResults={results} />
}
