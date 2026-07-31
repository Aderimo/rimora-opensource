'use client'

import { useState, useCallback, useRef } from 'react'
import type { Media } from '@/types'

interface Collection {
  id: number
  name: string
  overview?: string
  posterPath?: string
  backdropPath?: string
  partCount?: number
  parts?: Media[]
}

interface UseCollectionsReturn {
  collections: Collection[]
  selectedCollection: Collection | null
  isLoading: boolean
  error: string | null
  loadCollections: (searchQuery?: string) => Promise<void>
  loadCollectionDetails: (collectionId: number) => Promise<void>
  clearSelection: () => void
}

/**
 * Koleksiyon yönetimi hook'u
 * TMDB Collections API ile film serileri
 * 
 * @example
 * const { collections, selectedCollection, loadCollections } = useCollections()
 */
export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const abortRef = useRef<AbortController | null>(null)

  const loadCollections = useCallback(async (searchQuery = '') => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()
    
    setIsLoading(true)
    setError(null)
    
    try {
      const url = searchQuery 
        ? `/api/collections?q=${encodeURIComponent(searchQuery)}`
        : '/api/collections'
        
      const response = await fetch(url, {
        signal: abortRef.current.signal,
      })
      
      if (!response.ok) throw new Error('API hatası')
      
      const data = await response.json()
      setCollections(data.results || [])
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Koleksiyonlar yüklenemedi')
        console.error('Collections error:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadCollectionDetails = useCallback(async (collectionId: number) => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/collections?id=${collectionId}`, {
        signal: abortRef.current.signal,
      })
      
      if (!response.ok) throw new Error('API hatası')
      
      const data = await response.json()
      setSelectedCollection(data)
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Koleksiyon detayları yüklenemedi')
        console.error('Collection details error:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCollection(null)
  }, [])

  return {
    collections,
    selectedCollection,
    isLoading,
    error,
    loadCollections,
    loadCollectionDetails,
    clearSelection,
  }
}
