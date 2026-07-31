// API Response Types

// TMDB API Raw Response Types
export interface TMDBMovieResponse {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
  adult: boolean
  original_language: string
  video: boolean
}

export interface TMDBTVResponse {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
  adult: boolean
  original_language: string
  origin_country: string[]
}

export interface TMDBPersonResponse {
  id: number
  name: string
  profile_path: string | null
  character?: string
  job?: string
  department?: string
  credit_id: string
  cast_id?: number
  order?: number
}

export interface TMDBVideoResponse {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
  published_at: string
  size: number
  iso_639_1: string
  iso_3166_1: string
}

export interface TMDBGenreResponse {
  id: number
  name: string
}

export interface TMDBSeasonResponse {
  id: number
  season_number: number
  name: string
  overview: string
  poster_path: string | null
  episode_count: number
  air_date: string | null
}

export interface TMDBEpisodeResponse {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview: string
  still_path: string | null
  air_date: string | null
  runtime: number | null
  vote_average: number
  vote_count: number
  crew: TMDBPersonResponse[]
  guest_stars: TMDBPersonResponse[]
}

export interface TMDBMovieDetailResponse extends TMDBMovieResponse {
  belongs_to_collection: {
    id: number
    name: string
    poster_path: string | null
    backdrop_path: string | null
  } | null
  budget: number
  genres: TMDBGenreResponse[]
  homepage: string | null
  imdb_id: string | null
  production_companies: {
    id: number
    logo_path: string | null
    name: string
    origin_country: string
  }[]
  production_countries: {
    iso_3166_1: string
    name: string
  }[]
  revenue: number
  runtime: number | null
  spoken_languages: {
    english_name: string
    iso_639_1: string
    name: string
  }[]
  status: string
  tagline: string | null
  credits?: {
    cast: TMDBPersonResponse[]
    crew: TMDBPersonResponse[]
  }
  similar?: {
    results: TMDBMovieResponse[]
  }
  videos?: {
    results: TMDBVideoResponse[]
  }
}

export interface TMDBTVDetailResponse extends TMDBTVResponse {
  created_by: {
    id: number
    credit_id: string
    name: string
    gender: number
    profile_path: string | null
  }[]
  episode_run_time: number[]
  genres: TMDBGenreResponse[]
  homepage: string
  in_production: boolean
  languages: string[]
  last_air_date: string | null
  last_episode_to_air: TMDBEpisodeResponse | null
  next_episode_to_air: TMDBEpisodeResponse | null
  networks: {
    id: number
    logo_path: string | null
    name: string
    origin_country: string
  }[]
  number_of_episodes: number
  number_of_seasons: number
  production_companies: {
    id: number
    logo_path: string | null
    name: string
    origin_country: string
  }[]
  production_countries: {
    iso_3166_1: string
    name: string
  }[]
  seasons: TMDBSeasonResponse[]
  spoken_languages: {
    english_name: string
    iso_639_1: string
    name: string
  }[]
  status: string
  tagline: string
  type: string
  credits?: {
    cast: TMDBPersonResponse[]
    crew: TMDBPersonResponse[]
  }
  similar?: {
    results: TMDBTVResponse[]
  }
  videos?: {
    results: TMDBVideoResponse[]
  }
}

export interface TMDBSearchResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface TMDBMultiSearchItem extends TMDBMovieResponse, TMDBTVResponse {
  media_type: 'movie' | 'tv' | 'person'
}

export interface TMDBMultiSearchResponse {
  page: number
  results: TMDBMultiSearchItem[]
  total_pages: number
  total_results: number
}

// Firebase API Response Types
export interface FirebaseUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  createdAt?: string
  lastLoginAt?: string
}

export interface FirestoreTimestamp {
  seconds: number
  nanoseconds: number
  toDate(): Date
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  bio?: string
  location?: string
  website?: string
  birthDate?: FirestoreTimestamp
  isPrivate: boolean
  followersCount: number
  followingCount: number
  listsCount: number
  reviewsCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

export interface UserListItem {
  id: string
  userId: string
  mediaId: number
  mediaType: 'movie' | 'tv' | 'anime'
  listType: 'watchlist' | 'favorites' | 'watched' | 'custom'
  customListId?: string
  title: string
  posterPath: string | null
  addedAt: FirestoreTimestamp
  rating?: number
  review?: string
  progress?: {
    currentTime: number
    duration: number
    seasonNumber?: number
    episodeNumber?: number
  }
  // Extended properties for stats calculation
  genres?: string[]
  season?: number
  episode?: number
}

export interface CustomList {
  id: string
  userId: string
  name: string
  description?: string
  isPublic: boolean
  coverImage?: string
  itemCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

export interface UserStats {
  userId: string
  totalWatchTime: number
  moviesWatched: number
  tvShowsWatched: number
  animesWatched: number
  episodesWatched: number
  favoriteGenres: { [genre: string]: number }
  watchingStreak: number
  longestStreak: number
  averageRating: number
  totalRatings: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}

// Payment API Response Types
export interface IyzicoCheckoutResponse {
  status: 'success' | 'failure'
  locale: string
  systemTime: number
  conversationId: string
  checkoutFormContent?: string
  token?: string
  tokenExpireTime?: number
  paymentPageUrl?: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

export interface IyzicoRetrieveResponse {
  status: 'success' | 'failure'
  locale: string
  systemTime: number
  conversationId: string
  paymentId?: string
  paymentStatus?: 'SUCCESS' | 'FAILURE' | 'INIT_THREEDS' | 'CALLBACK_THREEDS'
  fraudStatus?: number
  merchantCommissionRate?: number
  merchantCommissionRateAmount?: number
  iyziCommissionRateAmount?: number
  iyziCommissionFee?: number
  cardType?: string
  cardAssociation?: string
  cardFamily?: string
  binNumber?: string
  lastFourDigits?: string
  basketId?: string
  currency?: string
  itemTransactions?: IyzicoItemTransaction[]
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

export interface IyzicoItemTransaction {
  itemId: string
  paymentTransactionId: string
  transactionStatus: number
  price: number
  paidPrice: number
  merchantCommissionRate: number
  merchantCommissionRateAmount: number
  iyziCommissionRateAmount: number
  iyziCommissionFee: number
  blockageRate: number
  blockageRateAmountMerchant: number
  blockageRateAmountSubMerchant: number
  blockageResolvedDate: string
  subMerchantPrice: number
  subMerchantPayoutRate: number
  subMerchantPayoutAmount: number
  merchantPayoutAmount: number
  convertedPayout: {
    paidPrice: number
    iyziCommissionRateAmount: number
    iyziCommissionFee: number
    blockageRateAmountMerchant: number
    blockageRateAmountSubMerchant: number
    subMerchantPayoutAmount: number
    merchantPayoutAmount: number
    iyziConversationRate: number
    iyziConversationRateAmount: number
  }
}

// OpenSubtitles API Response Types
export interface OpenSubtitlesSearchResponse {
  total_pages: number
  total_count: number
  per_page: number
  page: number
  data: OpenSubtitlesSubtitle[]
}

export interface OpenSubtitlesSubtitle {
  id: string
  type: 'subtitle'
  attributes: {
    subtitle_id: string
    language: string
    download_count: number
    new_download_count: number
    hearing_impaired: boolean
    hd: boolean
    fps: number
    votes: number
    points: number
    ratings: number
    from_trusted: boolean
    foreign_parts_only: boolean
    auto_translation: boolean
    ai_translated: boolean
    machine_translated: boolean
    upload_date: string
    release: string
    comments: string
    legacy_subtitle_id: number
    uploader: {
      uploader_id: number
      name: string
      rank: string
    }
    feature_details: {
      feature_id: number
      feature_type: string
      year: number
      title: string
      movie_name: string
      imdb_id: number
      tmdb_id: number
    }
    url: string
    related_links: {
      label: string
      url: string
      img_url: string
    }[]
    files: {
      file_id: number
      cd_number: number
      file_name: string
    }[]
  }
}

export interface OpenSubtitlesDownloadResponse {
  link: string
  file_name: string
  requests: number
  remaining: number
  message: string
  reset_time: string
  reset_time_utc: string
}

// FCM API Response Types
export interface FCMTokenResponse {
  token: string
  expirationTime?: string
}

export interface FCMMessageResponse {
  name: string
  success?: boolean
  error?: {
    code: string
    message: string
    details: unknown[]
  }
}

export interface IyzicoRefundResponse {
  status: 'success' | 'failure'
  locale: string
  systemTime: number
  conversationId: string
  paymentId?: string
  paymentTransactionId?: string
  price?: number
  currency?: string
  connectorName?: string
  authCode?: string
  hostReference?: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}

export interface IyzicoCancelSubscriptionResponse {
  status: 'success' | 'failure'
  locale: string
  systemTime: number
  conversationId: string
  subscriptionReferenceCode?: string
  errorCode?: string
  errorMessage?: string
  errorGroup?: string
}
// Generic API Response Wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    page?: number
    totalPages?: number
    totalResults?: number
    cached?: boolean
    timestamp?: string
  }
}

// Error Response Types
export interface ApiError {
  code: string
  message: string
  details?: unknown
  timestamp: string
  path?: string
  method?: string
}

export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR'
  details: {
    field: string
    message: string
    value?: unknown
  }[]
}

export interface AuthenticationError extends ApiError {
  code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR'
}

export interface RateLimitError extends ApiError {
  code: 'RATE_LIMIT_EXCEEDED'
  details: {
    limit: number
    remaining: number
    resetTime: string
  }
}