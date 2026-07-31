/**
 * OpenSubtitles API Client
 * 
 * OpenSubtitles REST API v2 entegrasyonu
 * - API authentication
 * - Rate limiting (40 istek/10 saniye)
 * 
 * @see https://opensubtitles.stoplight.io/docs/opensubtitles-api
 * 
 * Requirements: 6.1, 6.2
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OpenSubtitlesConfig {
  apiKey: string
  userAgent: string
  rateLimit: {
    maxRequests: number  // 40
    windowMs: number     // 10000 (10 saniye)
  }
}

export interface SubtitleSearchParams {
  imdbId?: string
  tmdbId?: number
  query?: string
  languages: string[]
  season?: number
  episode?: number
}

export interface SubtitleResult {
  id: string
  language: string
  languageName: string
  downloadUrl: string
  format: 'srt' | 'vtt' | 'ass'
  rating: number
  downloads: number
  uploadDate: string
}

// OpenSubtitles API Response Types
interface OpenSubtitlesSearchResponse {
  total_count: number
  total_pages: number
  page: number
  data: OpenSubtitlesSubtitle[]
}

interface OpenSubtitlesSubtitle {
  id: string
  type: string
  attributes: {
    subtitle_id: string
    language: string
    download_count: number
    new_download_count: number
    hearing_impaired: boolean
    hd: boolean
    fps: number
    votes: number
    ratings: number
    from_trusted: boolean
    foreign_parts_only: boolean
    upload_date: string
    ai_translated: boolean
    machine_translated: boolean
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
      season_number?: number
      episode_number?: number
      parent_imdb_id?: number
      parent_title?: string
      parent_tmdb_id?: number
      parent_feature_id?: number
    }
    url: string
    related_links: Array<{
      label: string
      url: string
      img_url: string
    }>
    files: Array<{
      file_id: number
      cd_number: number
      file_name: string
    }>
  }
}

interface OpenSubtitlesDownloadResponse {
  link: string
  file_name: string
  requests: number
  remaining: number
  message: string
  reset_time: string
  reset_time_utc: string
}

// ============================================================================
// Rate Limiter
// ============================================================================

interface RateLimitState {
  requests: number[]
  lastReset: number
}

class RateLimiter {
  private maxRequests: number
  private windowMs: number
  private state: RateLimitState

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.state = {
      requests: [],
      lastReset: Date.now()
    }
  }

  /**
   * İstek yapılabilir mi kontrol eder
   * @returns true ise istek yapılabilir, false ise rate limit aşılmış
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests()
    return this.state.requests.length < this.maxRequests
  }

  /**
   * Yeni istek kaydeder
   */
  recordRequest(): void {
    this.cleanupOldRequests()
    this.state.requests.push(Date.now())
  }

  /**
   * Rate limit aşıldığında beklenecek süreyi döndürür (ms)
   */
  getWaitTime(): number {
    this.cleanupOldRequests()
    
    if (this.state.requests.length < this.maxRequests) {
      return 0
    }

    const oldestRequest = this.state.requests[0]
    const waitTime = (oldestRequest + this.windowMs) - Date.now()
    return Math.max(0, waitTime)
  }

  /**
   * Pencere dışındaki eski istekleri temizler
   */
  private cleanupOldRequests(): void {
    const now = Date.now()
    const windowStart = now - this.windowMs
    this.state.requests = this.state.requests.filter(time => time > windowStart)
  }

  /**
   * Mevcut istek sayısını döndürür
   */
  getCurrentRequestCount(): number {
    this.cleanupOldRequests()
    return this.state.requests.length
  }

  /**
   * Rate limiter'ı sıfırlar (test için)
   */
  reset(): void {
    this.state = {
      requests: [],
      lastReset: Date.now()
    }
  }
}

// ============================================================================
// Language Mapping
// ============================================================================

const LANGUAGE_NAMES: Record<string, string> = {
  'tr': 'Türkçe',
  'en': 'English',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
  'it': 'Italiano',
  'pt': 'Português',
  'ru': 'Русский',
  'ja': '日本語',
  'ko': '한국어',
  'zh': '中文',
  'ar': 'العربية',
  'nl': 'Nederlands',
  'pl': 'Polski',
  'sv': 'Svenska',
  'no': 'Norsk',
  'da': 'Dansk',
  'fi': 'Suomi',
  'el': 'Ελληνικά',
  'he': 'עברית',
  'hu': 'Magyar',
  'cs': 'Čeština',
  'ro': 'Română',
  'bg': 'Български',
  'uk': 'Українська',
  'vi': 'Tiếng Việt',
  'th': 'ไทย',
  'id': 'Bahasa Indonesia',
  'ms': 'Bahasa Melayu',
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] || code.toUpperCase()
}

// ============================================================================
// OpenSubtitles API Client
// ============================================================================

export class OpenSubtitlesClient {
  private config: OpenSubtitlesConfig
  private rateLimiter: RateLimiter
  private baseUrl = 'https://api.opensubtitles.com/api/v1'

  constructor(config?: Partial<OpenSubtitlesConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.OPENSUBTITLES_API_KEY || '',
      userAgent: config?.userAgent || process.env.OPENSUBTITLES_USER_AGENT || 'Rimora/1.0',
      rateLimit: {
        maxRequests: config?.rateLimit?.maxRequests || 40,
        windowMs: config?.rateLimit?.windowMs || 10000
      }
    }

    this.rateLimiter = new RateLimiter(
      this.config.rateLimit.maxRequests,
      this.config.rateLimit.windowMs
    )
  }

  /**
   * API anahtarının yapılandırılıp yapılandırılmadığını kontrol eder
   */
  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0
  }

  /**
   * Rate limit durumunu döndürür
   */
  getRateLimitStatus(): { canRequest: boolean; currentCount: number; maxRequests: number; waitTime: number } {
    return {
      canRequest: this.rateLimiter.canMakeRequest(),
      currentCount: this.rateLimiter.getCurrentRequestCount(),
      maxRequests: this.config.rateLimit.maxRequests,
      waitTime: this.rateLimiter.getWaitTime()
    }
  }

  /**
   * Rate limiter'ı sıfırlar (test için)
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset()
  }

  /**
   * API isteği yapar (rate limiting ile)
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Rate limit kontrolü
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime()
      throw new OpenSubtitlesRateLimitError(
        `Rate limit aşıldı. ${Math.ceil(waitTime / 1000)} saniye bekleyin.`,
        waitTime
      )
    }

    // API key kontrolü
    if (!this.isConfigured()) {
      throw new OpenSubtitlesConfigError('OpenSubtitles API anahtarı yapılandırılmamış.')
    }

    // İsteği kaydet
    this.rateLimiter.recordRequest()

    const url = `${this.baseUrl}${endpoint}`
    const headers: HeadersInit = {
      'Api-Key': this.config.apiKey,
      'User-Agent': this.config.userAgent,
      'Content-Type': 'application/json',
      ...options.headers
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new OpenSubtitlesAuthError('Geçersiz API anahtarı.')
        }
        if (response.status === 429) {
          throw new OpenSubtitlesRateLimitError(
            'OpenSubtitles API rate limit aşıldı.',
            10000
          )
        }
        if (response.status === 404) {
          throw new OpenSubtitlesNotFoundError('Altyazı bulunamadı.')
        }
        
        const errorText = await response.text()
        throw new OpenSubtitlesApiError(
          `API hatası: ${response.status} - ${errorText}`,
          response.status
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof OpenSubtitlesError) {
        throw error
      }
      throw new OpenSubtitlesApiError(
        `İstek başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        0
      )
    }
  }

  /**
   * Altyazı arar
   * 
   * @param params Arama parametreleri
   * @returns Altyazı sonuçları
   * 
   * Requirements: 6.1 (gerçek altyazı verisi)
   */
  async searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleResult[]> {
    // Query parametrelerini oluştur
    const queryParams = new URLSearchParams()

    if (params.tmdbId) {
      queryParams.append('tmdb_id', params.tmdbId.toString())
    }

    if (params.imdbId) {
      // IMDB ID'yi temizle (tt prefix'i olmadan)
      const cleanImdbId = params.imdbId.replace(/^tt/, '')
      queryParams.append('imdb_id', cleanImdbId)
    }

    if (params.query) {
      queryParams.append('query', params.query)
    }

    if (params.languages && params.languages.length > 0) {
      queryParams.append('languages', params.languages.join(','))
    }

    if (params.season !== undefined) {
      queryParams.append('season_number', params.season.toString())
    }

    if (params.episode !== undefined) {
      queryParams.append('episode_number', params.episode.toString())
    }

    // Sıralama: en çok indirilen
    queryParams.append('order_by', 'download_count')
    queryParams.append('order_direction', 'desc')

    const response = await this.makeRequest<OpenSubtitlesSearchResponse>(
      `/subtitles?${queryParams.toString()}`
    )

    // Sonuçları dönüştür
    return response.data.map(subtitle => this.transformSubtitle(subtitle))
  }

  /**
   * Altyazı indirme URL'i alır
   * 
   * @param fileId Dosya ID'si
   * @returns İndirme URL'i
   */
  async getDownloadUrl(fileId: number): Promise<string> {
    const response = await this.makeRequest<OpenSubtitlesDownloadResponse>(
      '/download',
      {
        method: 'POST',
        body: JSON.stringify({ file_id: fileId })
      }
    )

    return response.link
  }

  /**
   * OpenSubtitles yanıtını SubtitleResult'a dönüştürür
   */
  private transformSubtitle(subtitle: OpenSubtitlesSubtitle): SubtitleResult {
    const attrs = subtitle.attributes
    const file = attrs.files[0]
    
    // Format belirleme
    let format: 'srt' | 'vtt' | 'ass' = 'srt'
    if (file?.file_name) {
      const ext = file.file_name.split('.').pop()?.toLowerCase()
      if (ext === 'vtt') format = 'vtt'
      else if (ext === 'ass' || ext === 'ssa') format = 'ass'
    }

    return {
      id: subtitle.id,
      language: attrs.language,
      languageName: getLanguageName(attrs.language),
      downloadUrl: attrs.url,
      format,
      rating: attrs.ratings || 0,
      downloads: attrs.download_count || 0,
      uploadDate: attrs.upload_date
    }
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class OpenSubtitlesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenSubtitlesError'
  }
}

export class OpenSubtitlesConfigError extends OpenSubtitlesError {
  constructor(message: string) {
    super(message)
    this.name = 'OpenSubtitlesConfigError'
  }
}

export class OpenSubtitlesAuthError extends OpenSubtitlesError {
  constructor(message: string) {
    super(message)
    this.name = 'OpenSubtitlesAuthError'
  }
}

export class OpenSubtitlesRateLimitError extends OpenSubtitlesError {
  waitTime: number

  constructor(message: string, waitTime: number) {
    super(message)
    this.name = 'OpenSubtitlesRateLimitError'
    this.waitTime = waitTime
  }
}

export class OpenSubtitlesNotFoundError extends OpenSubtitlesError {
  constructor(message: string) {
    super(message)
    this.name = 'OpenSubtitlesNotFoundError'
  }
}

export class OpenSubtitlesApiError extends OpenSubtitlesError {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'OpenSubtitlesApiError'
    this.statusCode = statusCode
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: OpenSubtitlesClient | null = null

/**
 * OpenSubtitles client singleton instance'ını döndürür
 */
export function getOpenSubtitlesClient(): OpenSubtitlesClient {
  if (!clientInstance) {
    clientInstance = new OpenSubtitlesClient()
  }
  return clientInstance
}

/**
 * Yeni bir OpenSubtitles client instance'ı oluşturur (test için)
 */
export function createOpenSubtitlesClient(config?: Partial<OpenSubtitlesConfig>): OpenSubtitlesClient {
  return new OpenSubtitlesClient(config)
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Altyazı arar (convenience function)
 * 
 * @param params Arama parametreleri
 * @returns Altyazı sonuçları
 */
export async function searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleResult[]> {
  const client = getOpenSubtitlesClient()
  return client.searchSubtitles(params)
}

/**
 * Rate limit durumunu kontrol eder
 */
export function checkRateLimit(): { canRequest: boolean; waitTime: number } {
  const client = getOpenSubtitlesClient()
  const status = client.getRateLimitStatus()
  return {
    canRequest: status.canRequest,
    waitTime: status.waitTime
  }
}
