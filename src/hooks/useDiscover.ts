'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Media } from '@/types'

export interface DiscoverFilters {
  type: 'movie' | 'tv' | 'anime'
  genres: number[]
  yearFrom: number | null
  yearTo: number | null
  country: string
  sortBy: string
  minRating: string
}

interface DiscoverResult {
  results: Media[]
  totalResults: number
  totalPages: number
  page: number
}

interface UseDiscoverReturn {
  results: Media[]
  isLoading: boolean
  error: string | null
  totalResults: number
  totalPages: number
  currentPage: number
  filters: DiscoverFilters
  setFilters: (filters: Partial<DiscoverFilters>) => void
  resetFilters: () => void
  goToPage: (page: number) => void
  refresh: () => void
}

const DEFAULT_FILTERS: DiscoverFilters = {
  type: 'movie',
  genres: [],
  yearFrom: null,
  yearTo: null,
  country: '',
  sortBy: 'popularity.desc',
  minRating: '',
}

/**
 * Discover (keşfet) hook'u
 * Filtreleme ve pagination ile içerik keşfi
 * AbortController ile race condition önleme
 * 
 * @example
 * const { results, isLoading, filters, setFilters, goToPage } = useDiscover()
 */
export function useDiscover(): UseDiscoverReturn {
  const [results, setResults] = useState<Media[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalResults, setTotalResults] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFiltersState] = useState<DiscoverFilters>(DEFAULT_FILTERS)
  
  // AbortController ref - race condition önleme
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchDiscover = useCallback(async (page: number, currentFilters: DiscoverFilters) => {
    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Yeni AbortController oluştur
    abortControllerRef.current = new AbortController()
    
    setIsLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      params.set('type', currentFilters.type)
      params.set('page', String(page))
      params.set('sortBy', currentFilters.sortBy)
      
      if (currentFilters.genres.length > 0) {
        params.set('genres', currentFilters.genres.join(','))
      }
      if (currentFilters.yearFrom) {
        params.set('yearFrom', String(currentFilters.yearFrom))
      }
      if (currentFilters.yearTo) {
        params.set('yearTo', String(currentFilters.yearTo))
      }
      if (currentFilters.country) {
        params.set('country', currentFilters.country)
      }
      if (currentFilters.minRating) {
        params.set('minRating', currentFilters.minRating)
      }

      const response = await fetch(`/api/discover?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      })
      
      if (!response.ok) {
        throw new Error('API hatası')
      }
      
      const data: DiscoverResult = await response.json()
      
      setResults(data.results || [])
      setTotalResults(data.totalResults || 0)
      setTotalPages(data.totalPages || 0)
      setCurrentPage(page)
      
    } catch (err: any) {
      // Abort hatası değilse error set et
      if (err.name !== 'AbortError') {
        setError('İçerikler yüklenirken hata oluştu')
        console.error('Discover error:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Filtreler değiştiğinde otomatik fetch
  useEffect(() => {
    fetchDiscover(1, filters)
    
    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [filters, fetchDiscover])

  const setFilters = useCallback((newFilters: Partial<DiscoverFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS)
  }, [])

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages || isLoading) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    fetchDiscover(page, filters)
  }, [totalPages, isLoading, filters, fetchDiscover])

  const refresh = useCallback(() => {
    fetchDiscover(currentPage, filters)
  }, [currentPage, filters, fetchDiscover])

  return {
    results,
    isLoading,
    error,
    totalResults,
    totalPages,
    currentPage,
    filters,
    setFilters,
    resetFilters,
    goToPage,
    refresh,
  }
}
