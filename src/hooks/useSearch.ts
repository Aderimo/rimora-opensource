'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Media } from '@/types'

interface SearchResult {
  results: Media[]
  totalResults: number
  totalPages: number
  page: number
}

interface UseSearchOptions {
  debounceMs?: number
  minQueryLength?: number
  onSearch?: (query: string) => void
}

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: Media[]
  suggestions: Media[]
  isLoading: boolean
  isLoadingSuggestions: boolean
  error: string | null
  totalResults: number
  totalPages: number
  currentPage: number
  goToPage: (page: number) => void
  clear: () => void
}

/**
 * Arama hook'u
 * Debounce, suggestions ve pagination ile tam arama deneyimi
 * AbortController ile race condition önleme
 * 
 * @example
 * const { query, setQuery, results, suggestions, isLoading } = useSearch({
 *   debounceMs: 300,
 *   onSearch: (q) => addToHistory(q)
 * })
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 500, minQueryLength = 2, onSearch } = options
  
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<Media[]>([])
  const [suggestions, setSuggestions] = useState<Media[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalResults, setTotalResults] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  
  // AbortController refs
  const searchAbortRef = useRef<AbortController | null>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Suggestions fetch
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < minQueryLength) {
      setSuggestions([])
      return
    }

    if (suggestAbortRef.current) {
      suggestAbortRef.current.abort()
    }
    suggestAbortRef.current = new AbortController()
    const suggestTimeoutId = setTimeout(() => suggestAbortRef.current?.abort(), 12000)
    
    setIsLoadingSuggestions(true)
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
        signal: suggestAbortRef.current.signal,
      })
      
      if (!response.ok) throw new Error('API hatası')
      
      const data = await response.json()
      setSuggestions((data.results || []).slice(0, 5))
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Suggestions error:', err)
      }
    } finally {
      clearTimeout(suggestTimeoutId)
      setIsLoadingSuggestions(false)
    }
  }, [minQueryLength])

  // Search fetch
  const fetchSearch = useCallback(async (q: string, page: number) => {
    if (q.length < minQueryLength) {
      setResults([])
      setTotalResults(0)
      setTotalPages(0)
      return
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }
    searchAbortRef.current = new AbortController()
    const searchTimeoutId = setTimeout(() => searchAbortRef.current?.abort(), 15000)
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}`, {
        signal: searchAbortRef.current.signal,
      })
      
      if (!response.ok) throw new Error('API hatası')
      
      const data: SearchResult = await response.json()
      
      setResults(data.results || [])
      setTotalResults(data.totalResults || 0)
      setTotalPages(data.totalPages || 0)
      setCurrentPage(page)
      
      // İlk sayfa aramasında callback çağır (history için)
      if (page === 1 && onSearch) {
        onSearch(q)
      }
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Arama yapılırken hata oluştu')
        console.error('Search error:', err)
      }
    } finally {
      clearTimeout(searchTimeoutId)
      setIsLoading(false)
    }
  }, [minQueryLength, onSearch])

  // Query değiştiğinde debounce ile fetch
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query)
      fetchSearch(query, 1)
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, debounceMs, fetchSuggestions, fetchSearch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort()
      suggestAbortRef.current?.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)
  }, [])

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages || isLoading) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    fetchSearch(query, page)
  }, [query, totalPages, isLoading, fetchSearch])

  const clear = useCallback(() => {
    setQueryState('')
    setResults([])
    setSuggestions([])
    setTotalResults(0)
    setTotalPages(0)
    setCurrentPage(1)
    setError(null)
  }, [])

  return {
    query,
    setQuery,
    results,
    suggestions,
    isLoading,
    isLoadingSuggestions,
    error,
    totalResults,
    totalPages,
    currentPage,
    goToPage,
    clear,
  }
}
