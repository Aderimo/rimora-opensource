// Search Types

export type SearchErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INVALID_QUERY'
  | 'NO_RESULTS'
  | 'API_ERROR'
  | 'UNKNOWN_ERROR'

export interface SearchError {
  type: SearchErrorType
  message: string
  code?: number
}

export interface SearchFilters {
  year?: number
  genre?: string
  type?: 'movie' | 'tv' | 'anime' | 'all'
  sortBy?: 'popularity' | 'rating' | 'release_date'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchState {
  query: string
  results: SearchResult[]
  isLoading: boolean
  error: SearchError | null
  page: number
  totalPages: number
  totalResults: number
}

export interface SearchResult {
  id: number
  type: 'movie' | 'tv' | 'anime'
  title: string
  originalTitle?: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate?: string
  firstAirDate?: string
  voteAverage: number
  voteCount: number
  genreIds: number[]
  popularity: number
}
