'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useCallback, useRef } from 'react'

interface UrlState {
  q?: string
  type?: 'movie' | 'tv' | 'anime'
  genres?: number[]
  yearFrom?: number | null
  yearTo?: number | null
  country?: string
  minRating?: string
  sortBy?: string
  page?: number
}

interface UseUrlSyncOptions {
  onUrlChange?: (state: UrlState) => void
  debounceMs?: number
}

/**
 * URL ↔ State senkronizasyonu hook'u
 * Netflix/Disney+ tarzı paylaşılabilir linkler
 * 
 * @example
 * const { urlState, updateUrl, clearUrl } = useUrlSync({
 *   onUrlChange: (state) => applyFilters(state)
 * })
 */
export function useUrlSync(options: UseUrlSyncOptions = {}) {
  const { onUrlChange, debounceMs = 300 } = options
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  // URL'den state oku
  const parseUrlState = useCallback((): UrlState => {
    if (!searchParams) return {}
    
    const state: UrlState = {}
    
    const q = searchParams.get('q')
    if (q) state.q = q
    
    const type = searchParams.get('type') as UrlState['type']
    if (type && ['movie', 'tv', 'anime'].includes(type)) state.type = type
    
    const genres = searchParams.get('genres')
    if (genres) state.genres = genres.split(',').map(Number).filter(n => !isNaN(n))
    
    const yearFrom = searchParams.get('yearFrom')
    if (yearFrom) state.yearFrom = parseInt(yearFrom)
    
    const yearTo = searchParams.get('yearTo')
    if (yearTo) state.yearTo = parseInt(yearTo)
    
    const country = searchParams.get('country')
    if (country) state.country = country
    
    const minRating = searchParams.get('minRating')
    if (minRating) state.minRating = minRating
    
    const sortBy = searchParams.get('sortBy')
    if (sortBy) state.sortBy = sortBy
    
    const page = searchParams.get('page')
    if (page) state.page = parseInt(page)
    
    return state
  }, [searchParams])

  // State'i URL'e yaz
  const updateUrl = useCallback((state: UrlState, replace = true) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      
      if (state.q) params.set('q', state.q)
      if (state.type && state.type !== 'movie') params.set('type', state.type)
      if (state.genres?.length) params.set('genres', state.genres.join(','))
      if (state.yearFrom) params.set('yearFrom', String(state.yearFrom))
      if (state.yearTo) params.set('yearTo', String(state.yearTo))
      if (state.country) params.set('country', state.country)
      if (state.minRating) params.set('minRating', state.minRating)
      if (state.sortBy && state.sortBy !== 'popularity.desc') params.set('sortBy', state.sortBy)
      if (state.page && state.page > 1) params.set('page', String(state.page))
      
      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname
      
      if (replace) {
        router.replace(newUrl, { scroll: false })
      } else {
        router.push(newUrl, { scroll: false })
      }
    }, debounceMs)
  }, [pathname, router, debounceMs])

  // URL'i temizle
  const clearUrl = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  // İlk yüklemede URL'den state oku
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      const initialState = parseUrlState()
      if (Object.keys(initialState).length > 0 && onUrlChange) {
        onUrlChange(initialState)
      }
    }
  }, [parseUrlState, onUrlChange])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    urlState: parseUrlState(),
    updateUrl,
    clearUrl,
    searchParams,
  }
}
