// Media Types
export type MediaType = 'movie' | 'tv' | 'anime'

export interface Media {
  id: number
  type: MediaType
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

export interface MediaDetail extends Media {
  genres: Genre[]
  runtime?: number
  numberOfSeasons?: number
  numberOfEpisodes?: number
  status: string
  tagline?: string
  cast: Person[]
  crew: Person[]
  similar: Media[]
  videos: Video[]
}

export interface Genre {
  id: number
  name: string
}

export interface Person {
  id: number
  name: string
  profilePath: string | null
  character?: string
  job?: string
}

export interface Video {
  id: string
  key: string
  name: string
  site: string
  type: string
}

export interface Season {
  id: number
  seasonNumber: number
  name: string
  overview: string
  posterPath: string | null
  episodeCount: number
  airDate?: string
}

export interface Episode {
  id: number
  episodeNumber: number
  seasonNumber: number
  name: string
  overview: string
  stillPath: string | null
  airDate?: string
  runtime?: number
  voteAverage: number
}

// User Types
export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Date
}

export interface UserList {
  userId: string
  mediaId: number
  mediaType: MediaType
  listType: 'watchlist' | 'favorites' | 'watched'
  addedAt: Date
}

// Player Types
export interface PlayerSettings {
  quality: '480p' | '720p' | '1080p' | '4K'
  audioTrack: string
  subtitleTrack: string | null
  volume: number
  muted: boolean
  playbackRate: number
}

export interface WatchProgress {
  mediaId: number
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
  currentTime: number
  duration: number
  updatedAt: Date
}

// API Response Types
export interface TMDBResponse<T> {
  page: number
  results: T[]
  totalPages: number
  totalResults: number
}

export interface HomePageData {
  featured: Media | null
  sections: {
    id: string
    titleKey: string
    items: Media[]
  }[]
}
