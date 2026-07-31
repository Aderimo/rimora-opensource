'use client'

import { useSettings } from '@/contexts/settings-context'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search, X, Mic, MicOff, Grid3X3, List, ChevronLeft, ChevronRight,
  Shuffle, Filter, Loader2, Clock, Trash2, Star, Calendar, Globe,
  ChevronDown, SlidersHorizontal, Layers, TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaCard } from '@/components/media/media-card'
import type { Media, TMDBResponse } from '@/types'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

// Sabit değerler
const SEARCH_HISTORY_KEY = 'rimora-search-history'
const MAX_HISTORY = 10

// Arama türleri
type SearchType = 'content' | 'users'

// Filtre tipleri
interface SearchFilters {
  mediaType: 'movie' | 'tv' | 'anime'
  genres: number[]
  yearFrom: number | null
  yearTo: number | null
  country: string
  minRating: string
  sortBy: string
}

const DEFAULT_FILTERS: SearchFilters = {
  mediaType: 'movie',
  genres: [],
  yearFrom: null,
  yearTo: null,
  country: '',
  minRating: '',
  sortBy: 'popularity.desc',
}

// Sıralama seçenekleri
const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Popülerlik (Azalan)' },
  { value: 'popularity.asc', label: 'Popülerlik (Artan)' },
  { value: 'vote_average.desc', label: 'Puan (Yüksek)' },
  { value: 'vote_average.asc', label: 'Puan (Düşük)' },
  { value: 'release_date.desc', label: 'Yeni Çıkanlar' },
  { value: 'release_date.asc', label: 'Eski Çıkanlar' },
  { value: 'original_title.asc', label: 'İsim (A-Z)' },
]

// Ülkeler
const COUNTRIES = [
  { code: '', label: 'Tüm Ülkeler' },
  { code: 'TR', label: '🇹🇷 Türkiye' },
  { code: 'US', label: '🇺🇸 ABD' },
  { code: 'GB', label: '🇬🇧 İngiltere' },
  { code: 'KR', label: '🇰🇷 Güney Kore' },
  { code: 'JP', label: '🇯🇵 Japonya' },
  { code: 'FR', label: '🇫🇷 Fransa' },
  { code: 'DE', label: '🇩🇪 Almanya' },
  { code: 'IN', label: '🇮🇳 Hindistan' },
  { code: 'ES', label: '🇪🇸 İspanya' },
  { code: 'IT', label: '🇮🇹 İtalya' },
]

// Puan seçenekleri
const RATING_OPTIONS = [
  { value: '', label: 'Tüm Puanlar' },
  { value: '9', label: '9+ Mükemmel' },
  { value: '8', label: '8+ Çok İyi' },
  { value: '7', label: '7+ İyi' },
  { value: '6', label: '6+ Orta' },
  { value: '5', label: '5+ Vasat' },
]

// Yıl aralığı
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 50 }, (_, i) => currentYear - i)

// Genre listesi
const GENRES: Record<string, { id: number; name: string }[]> = {
  movie: [
    { id: 28, name: 'Aksiyon' }, { id: 12, name: 'Macera' }, { id: 16, name: 'Animasyon' },
    { id: 35, name: 'Komedi' }, { id: 80, name: 'Suç' }, { id: 99, name: 'Belgesel' },
    { id: 18, name: 'Drama' }, { id: 10751, name: 'Aile' }, { id: 14, name: 'Fantastik' },
    { id: 36, name: 'Tarih' }, { id: 27, name: 'Korku' }, { id: 10402, name: 'Müzik' },
    { id: 9648, name: 'Gizem' }, { id: 10749, name: 'Romantik' }, { id: 878, name: 'Bilim Kurgu' },
    { id: 53, name: 'Gerilim' }, { id: 10752, name: 'Savaş' }, { id: 37, name: 'Western' },
  ],
  tv: [
    { id: 10759, name: 'Aksiyon & Macera' }, { id: 16, name: 'Animasyon' }, { id: 35, name: 'Komedi' },
    { id: 80, name: 'Suç' }, { id: 99, name: 'Belgesel' }, { id: 18, name: 'Drama' },
    { id: 10751, name: 'Aile' }, { id: 10762, name: 'Çocuk' }, { id: 9648, name: 'Gizem' },
    { id: 10763, name: 'Haber' }, { id: 10764, name: 'Reality' }, { id: 10765, name: 'Bilim Kurgu & Fantastik' },
    { id: 10766, name: 'Pembe Dizi' }, { id: 10767, name: 'Talk Show' }, { id: 10768, name: 'Savaş & Politik' },
    { id: 37, name: 'Western' },
  ],
  anime: [
    { id: 16, name: 'Animasyon' }, { id: 28, name: 'Aksiyon' }, { id: 12, name: 'Macera' },
    { id: 35, name: 'Komedi' }, { id: 18, name: 'Drama' }, { id: 14, name: 'Fantastik' },
    { id: 878, name: 'Bilim Kurgu' }, { id: 10749, name: 'Romantik' }, { id: 27, name: 'Korku' },
  ],
}

interface SearchContentProps {
  initialQuery: string
  initialResults: TMDBResponse<Media> | null
}

export function SearchContent({ initialQuery, initialResults }: SearchContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isInitialMount = useRef(true)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { showAdultContent } = useSettings()

  // Core State
  const [query, setQuery] = useState(initialQuery)
  const [searchType, setSearchType] = useState<SearchType>('content')
  const [results, setResults] = useState<Media[]>(initialResults?.results || [])
  const [userResults, setUserResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalResults, setTotalResults] = useState(initialResults?.totalResults || 0)
  const [totalPages, setTotalPages] = useState(initialResults?.totalPages || 0)
  const [currentPage, setCurrentPage] = useState(1)

  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [scrollMode, setScrollMode] = useState<'pagination' | 'infinite'>('pagination')
  const [showFilters, setShowFilters] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)

  // Search History
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [inputFocused, setInputFocused] = useState(false)

  // Voice Search
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Trends
  const TRENDING_SEARCHES = ["Dune", "Oppenheimer", "One Piece", "Solo Leveling", "Avengers", "Breaking Bad"]

  // Refs
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])


  // Arama geçmişini yükle
  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved))
      } catch (e) {
        console.error('History parse error:', e)
      }
    }
  }, [])

  // Arama geçmişine ekle
  const addToHistory = useCallback((term: string) => {
    if (!term || term.length < 2) return

    setSearchHistory(prev => {
      const filtered = prev.filter(h => h.toLowerCase() !== term.toLowerCase())
      const updated = [term, ...filtered].slice(0, MAX_HISTORY)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Geçmişten sil
  const removeFromHistory = (term: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(h => h !== term)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }

  // Tüm geçmişi temizle
  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  }

  // URL'den state'i oku
  useEffect(() => {
    if (!searchParams) return

    const urlQuery = searchParams.get('q') || ''
    const urlType = searchParams.get('type') as SearchFilters['mediaType'] || 'movie'
    const urlPage = searchParams.get('page')
    const urlMode = searchParams.get('mode')

    if (urlQuery) setQuery(urlQuery)
    if (['movie', 'tv', 'anime'].includes(urlType)) {
      setFilters(prev => ({ ...prev, mediaType: urlType }))
    }
    if (urlPage) setCurrentPage(parseInt(urlPage))
    if (urlMode === 'infinite') setScrollMode('infinite')

    const savedViewMode = localStorage.getItem('rimora-view-mode')
    if (savedViewMode) setViewMode(savedViewMode as 'grid' | 'list')

    const savedScrollMode = localStorage.getItem('rimora-scroll-mode')
    if (savedScrollMode) setScrollMode(savedScrollMode as 'pagination' | 'infinite')

    isInitialMount.current = false
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // URL güncelle
  const updateUrl = useCallback((q: string, page: number, type: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type !== 'movie') params.set('type', type)
    if (page > 1) params.set('page', String(page))
    if (scrollMode === 'infinite') params.set('mode', 'infinite')

    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    router.replace(newUrl, { scroll: false })
  }, [pathname, router, scrollMode])

  // Ana fetch fonksiyonu
  const fetchContent = useCallback(async (
    searchQuery: string,
    page: number,
    currentFilters: SearchFilters,
    append: boolean = false
  ) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      if (searchType === 'users') {
        // Kullanıcı arama
        if (searchQuery.length >= 2) {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&page=${page}`, {
            signal: abortRef.current.signal
          })
          const data = await res.json()
          
          if (append) {
            setUserResults(prev => [...prev, ...data.results || []])
          } else {
            setUserResults(data.results || [])
            setResults([])
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
          
          setTotalResults(data.totalResults || 0)
          setTotalPages(data.totalPages || 0)
          setCurrentPage(page)
        } else {
          setUserResults([])
          setResults([])
        }
      } else {
        // İçerik arama (mevcut kod)
        let url: string

        if (searchQuery.length >= 2) {
          url = `/api/search?q=${encodeURIComponent(searchQuery)}&page=${page}&type=${currentFilters.mediaType}&includeAdult=${showAdultContent}`
          if (currentFilters.yearFrom) url += `&year=${currentFilters.yearFrom}`
        } else {
          const params = new URLSearchParams()
          params.set('type', currentFilters.mediaType)
          params.set('page', String(page))
          params.set('sortBy', currentFilters.sortBy)
          params.set('includeAdult', String(showAdultContent))

          if (currentFilters.genres.length > 0) params.set('genres', currentFilters.genres.join(','))
          if (currentFilters.yearFrom) params.set('yearFrom', String(currentFilters.yearFrom))
          if (currentFilters.yearTo) params.set('yearTo', String(currentFilters.yearTo))
          if (currentFilters.minRating) params.set('minRating', currentFilters.minRating)
          if (currentFilters.country) params.set('country', currentFilters.country)

          url = `/api/discover?${params.toString()}`
        }

        const res = await fetch(url, { signal: abortRef.current.signal })
        const data = await res.json()

        const items = data.results || []

        if (append) {
          setResults(prev => [...prev, ...items])
        } else {
          setResults(items)
          setUserResults([])
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }

        setTotalResults(data.totalResults || 0)
        setTotalPages(data.totalPages || 0)
        setCurrentPage(page)
      }

      // Arama geçmişine ekle
      if (searchQuery.length >= 2 && !append) {
        addToHistory(searchQuery)
      }

    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Fetch error:', e)
        if (!append) {
          setResults([])
          setUserResults([])
        }
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [addToHistory, showAdultContent, searchType])

  // Infinite scroll observer
  useEffect(() => {
    if (scrollMode !== 'infinite') return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && currentPage < totalPages) {
          fetchContent(query, currentPage + 1, filters, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [scrollMode, isLoading, isLoadingMore, currentPage, totalPages, query, filters, fetchContent])

  // Query değiştiğinde ara
  useEffect(() => {
    if (isInitialMount.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      fetchContent(query, 1, filters)
      updateUrl(query, 1, filters.mediaType)
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filters, fetchContent, updateUrl])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Sayfa değiştir
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || isLoading) return
    fetchContent(query, page, filters)
    updateUrl(query, page, filters.mediaType)
  }

  // View mode değiştir
  const handleViewModeToggle = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid'
    setViewMode(newMode)
    localStorage.setItem('rimora-view-mode', newMode)
  }

  // Scroll mode değiştir
  const handleScrollModeToggle = () => {
    const newMode = scrollMode === 'pagination' ? 'infinite' : 'pagination'
    setScrollMode(newMode)
    localStorage.setItem('rimora-scroll-mode', newMode)

    // Infinite'e geçerken mevcut sonuçları koru
    if (newMode === 'pagination') {
      // Pagination'a geçerken ilk sayfaya dön
      fetchContent(query, 1, filters)
    }
  }

  // Sesli arama
  const toggleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Tarayıcınız sesli aramayı desteklemiyor')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'tr-TR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setQuery(transcript)
      setIsListening(false)
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  // Rastgele içerik
  const handleRandomContent = async () => {
    setIsLoading(true)
    try {
      const randomPage = Math.floor(Math.random() * 20) + 1
      const res = await fetch(`/api/discover?type=${filters.mediaType}&page=${randomPage}&sortBy=popularity.desc`)
      const data = await res.json()

      if (data.results?.length > 0) {
        const randomItem = data.results[Math.floor(Math.random() * data.results.length)]
        const path = filters.mediaType === 'movie' ? `/filmler/${randomItem.id}`
          : filters.mediaType === 'anime' ? `/animeler/${randomItem.id}`
            : `/diziler/${randomItem.id}`
        router.push(path)
      }
    } catch (e) {
      console.error('Random content error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Filtreleri temizle
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  // Aktif filtre sayısı
  const activeFilterCount = [
    filters.genres.length > 0,
    filters.yearFrom !== null,
    filters.yearTo !== null,
    filters.minRating !== '',
    filters.country !== '',
    filters.sortBy !== 'popularity.desc',
  ].filter(Boolean).length


  // Pagination numaralarını hesapla
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 7

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  // Geçmiş dropdown'ı göster/gizle
  const shouldShowHistory = inputFocused && searchHistory.length > 0 && query.length === 0

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Arama Başlığı */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Keşfet
          </h1>
          <p className="text-muted-foreground">
            Film, dizi ve anime ara veya keşfet
          </p>
        </div>

        {/* Arama Çubuğu */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 200)}
              placeholder="Film, dizi, anime veya kullanıcı ara..."
              className="w-full h-12 pl-12 pr-20 rounded-xl bg-card border border-border/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuery('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isListening ? 'text-red-500 animate-pulse' : ''}`}
                onClick={toggleVoiceSearch}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>

            {/* Arama Geçmişi Dropdown */}
            {(shouldShowHistory || (inputFocused && query.length === 0)) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Geçmiş */}
                {searchHistory.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Son Aramalar
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearHistory} className="h-7 text-xs text-muted-foreground hover:text-red-500">
                        <Trash2 className="h-3 w-3 mr-1" />
                        Temizle
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {searchHistory.map((term, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-4 py-2 hover:bg-muted/50 cursor-pointer group"
                          onClick={() => {
                            setQuery(term)
                            setInputFocused(false)
                          }}
                        >
                          <span className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {term}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromHistory(term)
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Trendler */}
                <div className="border-t border-border/50">
                  <div className="flex items-center px-4 py-2 border-b border-border/50 bg-muted/20">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Popüler Aramalar
                    </span>
                  </div>
                  <div className="p-2 flex flex-wrap gap-2">
                    {TRENDING_SEARCHES.map((term) => (
                      <button
                        key={term}
                        className="px-3 py-1.5 rounded-full bg-muted/50 hover:bg-primary/10 hover:text-primary text-sm transition-colors"
                        onClick={() => {
                          setQuery(term)
                          setInputFocused(false)
                        }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filtre Butonu - Sadece içerik aramasında göster */}
          {searchType === 'content' && (
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              <Filter className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-pink-500 text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}

          {/* Scroll Mode Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleScrollModeToggle}
            title={scrollMode === 'pagination' ? 'Sonsuz kaydırma' : 'Sayfalama'}
          >
            <Layers className={`h-5 w-5 ${scrollMode === 'infinite' ? 'text-purple-500' : ''}`} />
          </Button>

          {/* View Mode Toggle */}
          <Button variant="outline" size="icon" onClick={handleViewModeToggle}>
            {viewMode === 'grid' ? <List className="h-5 w-5" /> : <Grid3X3 className="h-5 w-5" />}
          </Button>

          {/* Random */}
          <Button variant="outline" size="icon" onClick={handleRandomContent} disabled={isLoading}>
            <Shuffle className="h-5 w-5" />
          </Button>
        </div>


        {/* Arama Türü Seçici */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex bg-card border border-border/50 rounded-lg p-1">
            <button
              onClick={() => setSearchType('content')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                searchType === 'content'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              İçerik
            </button>
            <button
              onClick={() => setSearchType('users')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                searchType === 'users'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Kullanıcılar
            </button>
          </div>
        </div>

        {/* Filtreler - Sadece içerik aramasında göster */}
        {searchType === 'content' && showFilters && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-border/50 animate-in slide-in-from-top duration-200 space-y-4">
            {/* Medya Tipi */}
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-[80px]">Tür:</span>
              <div className="flex gap-2">
                {(['movie', 'tv', 'anime'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={filters.mediaType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, mediaType: type, genres: [] }))}
                    className={filters.mediaType === type ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    {type === 'movie' ? 'Filmler' : type === 'tv' ? 'Diziler' : 'Animeler'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Kategoriler */}
            <div className="flex flex-wrap items-start gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-[80px] pt-1">Kategori:</span>
              <div className="flex flex-wrap gap-2 flex-1">
                {GENRES[filters.mediaType]?.map((genre) => (
                  <Button
                    key={genre.id}
                    variant={filters.genres.includes(genre.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        genres: prev.genres.includes(genre.id)
                          ? prev.genres.filter(g => g !== genre.id)
                          : [...prev.genres, genre.id]
                      }))
                    }}
                    className={filters.genres.includes(genre.id) ? 'bg-pink-600 hover:bg-pink-700' : ''}
                  >
                    {genre.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Gelişmiş Filtreler Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-muted-foreground hover:text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Gelişmiş Filtreler
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </Button>

            {/* Gelişmiş Filtreler */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/50 animate-in slide-in-from-top duration-200">
                {/* Yıl Aralığı */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Yıl Aralığı
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={filters.yearFrom || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, yearFrom: e.target.value ? parseInt(e.target.value) : null }))}
                      className="flex-1 h-9 px-3 rounded-lg bg-background border border-border/50 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                    >
                      <option value="">Başlangıç</option>
                      {YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <span className="text-muted-foreground">-</span>
                    <select
                      value={filters.yearTo || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, yearTo: e.target.value ? parseInt(e.target.value) : null }))}
                      className="flex-1 h-9 px-3 rounded-lg bg-background border border-border/50 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                    >
                      <option value="">Bitiş</option>
                      {YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Minimum Puan */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Minimum Puan
                  </label>
                  <select
                    value={filters.minRating}
                    onChange={(e) => setFilters(prev => ({ ...prev, minRating: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/50 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                  >
                    {RATING_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {/* Ülke */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Ülke
                  </label>
                  <select
                    value={filters.country}
                    onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/50 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country.code} value={country.code}>{country.label}</option>
                    ))}
                  </select>
                </div>

                {/* Sıralama */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    Sıralama
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border/50 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sonuçlar */}
        {isLoading && !isLoadingMore ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          </div>
        ) : searchType === 'users' ? (
          /* Kullanıcı Sonuçları */
          userResults.length > 0 ? (
            <div className="grid gap-4">
              {userResults.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors"
                >
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {user.photoURL ? (
                      <Image src={user.photoURL} alt={user.displayName} fill className="object-cover" sizes="64px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-white font-bold text-xl">{user.displayName?.[0]?.toUpperCase() || 'A'}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">{user.displayName}</h3>
                    {user.bio && <p className="text-muted-foreground text-sm line-clamp-2">{user.bio}</p>}
                    {user.stats && (
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{user.stats.followersCount} takipçi</span>
                        <span>{user.stats.followingCount} takip</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/kullanici/${user.id}`}>
                      <Button variant="outline" size="sm">
                        Profil
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              {query.length > 0 ? (
                <>
                  <p className="text-lg">Kullanıcı bulunamadı.</p>
                  <p className="text-sm">Farklı anahtar kelimeler deneyin.</p>
                </>
              ) : (
                <p>Kullanıcı aramaya başlamak için yukarıya yazın.</p>
              )}
            </div>
          )
        ) : results.length > 0 ? (
          /* İçerik Sonuçları */
          <>
            <div className={cn(
              "grid gap-4 md:gap-6",
              viewMode === 'grid'
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                : "grid-cols-1"
            )}>
              {results.map((item, index) => (
                <MediaCard
                  key={`${item.id}-${index}`}
                  media={item}
                  priority={index < 4}
                  className={viewMode === 'list' ? 'flex-row h-48' : ''}
                />
              ))}
            </div>

            {/* Pagination / Loading More */}
            {isLoadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            )}

            {!isLoadingMore && currentPage < totalPages && (
              scrollMode === 'infinite' ? (
                <div ref={loadMoreRef} className="h-10" />
              ) : (
                <div className="flex justify-center gap-2 mt-8 flex-wrap">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {getPageNumbers().map((page, i) => (
                    typeof page === 'number' ? (
                      <Button
                        key={i}
                        variant={currentPage === page ? 'default' : 'outline'}
                        onClick={() => handlePageChange(page)}
                        className={currentPage === page ? 'bg-purple-600' : ''}
                      >
                        {page}
                      </Button>
                    ) : (
                      <span key={i} className="px-2 py-2 text-muted-foreground">...</span>
                    )
                  ))}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )
            )}
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            {query.length > 0 ? (
              <>
                <p className="text-lg">Sonuç bulunamadı.</p>
                <p className="text-sm">Farklı anahtar kelimeler veya filtreler deneyin.</p>
                {searchType === 'content' && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Filtreleri Temizle
                  </Button>
                )}
              </>
            ) : (
              <p>Aramaya başlamak için yukarıya yazın veya bir kategori seçin.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
