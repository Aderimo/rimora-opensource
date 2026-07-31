'use client'

import { useState, useEffect, useCallback } from 'react'

const SEARCH_HISTORY_KEY = 'rimora-search-history'
const SAVED_SEARCHES_KEY = 'rimora-saved-searches'
const MAX_HISTORY = 10
const MAX_SAVED = 20

interface UseSearchHistoryReturn {
  history: string[]
  savedSearches: string[]
  addToHistory: (query: string) => void
  clearHistory: () => void
  toggleSave: (query: string) => void
  isSaved: (query: string) => boolean
}

/**
 * Arama geçmişi ve kayıtlı aramalar hook'u
 * LocalStorage ile persist edilir
 * 
 * @example
 * const { history, savedSearches, addToHistory, toggleSave } = useSearchHistory()
 */
export function useSearchHistory(): UseSearchHistoryReturn {
  const [history, setHistory] = useState<string[]>([])
  const [savedSearches, setSavedSearches] = useState<string[]>([])

  // LocalStorage'dan yükle
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const storedHistory = localStorage.getItem(SEARCH_HISTORY_KEY)
      const storedSaved = localStorage.getItem(SAVED_SEARCHES_KEY)
      
      if (storedHistory) setHistory(JSON.parse(storedHistory))
      if (storedSaved) setSavedSearches(JSON.parse(storedSaved))
    } catch (error) {
      console.error('Search history load error:', error)
    }
  }, [])

  // Geçmişe ekle
  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return
    
    setHistory(prev => {
      // Duplicate temizle ve başa ekle
      const newHistory = [query, ...prev.filter(h => h !== query)].slice(0, MAX_HISTORY)
      
      // LocalStorage'a kaydet
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
      } catch (error) {
        console.error('History save error:', error)
      }
      
      return newHistory
    })
  }, [])

  // Geçmişi temizle
  const clearHistory = useCallback(() => {
    setHistory([])
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
    } catch (error) {
      console.error('History clear error:', error)
    }
  }, [])

  // Kayıtlı aramalara ekle/çıkar
  const toggleSave = useCallback((query: string) => {
    if (!query.trim()) return
    
    setSavedSearches(prev => {
      const isSaved = prev.includes(query)
      const newSaved = isSaved 
        ? prev.filter(s => s !== query)
        : [query, ...prev].slice(0, MAX_SAVED)
      
      try {
        localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(newSaved))
      } catch (error) {
        console.error('Saved search error:', error)
      }
      
      return newSaved
    })
  }, [])

  // Kayıtlı mı kontrol
  const isSaved = useCallback((query: string) => {
    return savedSearches.includes(query)
  }, [savedSearches])

  return {
    history,
    savedSearches,
    addToHistory,
    clearHistory,
    toggleSave,
    isSaved,
  }
}
