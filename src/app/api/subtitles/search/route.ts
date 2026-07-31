/**
 * Altyazı Arama Proxy Endpoint
 * 
 * OpenSubtitles API'ye proxy görevi görür ve sonuçları cache'ler.
 * - 24 saat TTL ile cache
 * - Rate limiting (OpenSubtitles client'tan)
 * - Güvenlik kontrolü ve format dönüştürme desteği
 * 
 * Requirements: 6.2 (Güvenlik ve format dönüştürme), 6.3 (Cache)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOpenSubtitlesClient,
  SubtitleSearchParams,
  SubtitleResult,
  OpenSubtitlesRateLimitError,
  OpenSubtitlesNotFoundError,
  OpenSubtitlesConfigError,
  OpenSubtitlesAuthError
} from '@/lib/api/opensubtitles'
import {
  validateSubtitleContent,
  type SubtitleFormat
} from '@/lib/api/subtitle-processor'

// ============ CONFIGURATION ============

// Cache config - 24 saat TTL
const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 saat = 86400 saniye

// ============ CACHE ============

interface CacheEntry {
  data: SubtitleResult[]
  expiresAt: number
  cachedAt: number
}

// In-memory cache store (production'da Redis kullanılmalı)
const subtitleCacheStore = new Map<string, CacheEntry>()

/**
 * Cache key oluşturur
 * Format: tmdbId|imdbId|languages|season|episode
 */
function getCacheKey(params: SubtitleSearchParams): string {
  const parts = [
    params.tmdbId?.toString() || '',
    params.imdbId || '',
    params.languages?.sort().join(',') || '',
    params.season?.toString() || '',
    params.episode?.toString() || ''
  ]
  return parts.join('|')
}

/**
 * Cache'den veri alır
 */
function getFromCache(cacheKey: string): SubtitleResult[] | null {
  const entry = subtitleCacheStore.get(cacheKey)

  if (!entry) {
    return null
  }

  // Cache süresi dolmuş mu kontrol et
  if (Date.now() >= entry.expiresAt) {
    subtitleCacheStore.delete(cacheKey)
    return null
  }

  return entry.data
}

/**
 * Cache'e veri yazar
 */
function setCache(cacheKey: string, data: SubtitleResult[]): void {
  const now = Date.now()
  const entry: CacheEntry = {
    data,
    cachedAt: now,
    expiresAt: now + (CACHE_TTL_SECONDS * 1000)
  }
  subtitleCacheStore.set(cacheKey, entry)
}

/**
 * Cache'deki entry'nin ne zaman expire olacağını döndürür
 */
function getCacheExpiry(cacheKey: string): number | null {
  const entry = subtitleCacheStore.get(cacheKey)
  if (!entry) return null
  return entry.expiresAt
}

/**
 * Periyodik olarak eski cache entry'lerini temizle
 */
function cleanupCacheStore(): void {
  const now = Date.now()
  const keysToDelete: string[] = []
  subtitleCacheStore.forEach((entry, key) => {
    if (now >= entry.expiresAt) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => subtitleCacheStore.delete(key))
}

// Her 1 saatte bir temizlik yap
setInterval(cleanupCacheStore, 60 * 60 * 1000)

// ============ REQUEST VALIDATION ============

interface SearchRequestBody {
  tmdbId?: number
  imdbId?: string
  languages?: string[]
  season?: number
  episode?: number
  query?: string
}

function validateSearchParams(body: SearchRequestBody): { valid: boolean; error?: string } {
  // En az bir tanımlayıcı gerekli
  if (!body.tmdbId && !body.imdbId && !body.query) {
    return {
      valid: false,
      error: 'En az bir tanımlayıcı gerekli: tmdbId, imdbId veya query'
    }
  }

  // tmdbId sayı olmalı
  if (body.tmdbId !== undefined && (typeof body.tmdbId !== 'number' || body.tmdbId <= 0)) {
    return {
      valid: false,
      error: 'tmdbId pozitif bir sayı olmalı'
    }
  }

  // languages array olmalı
  if (body.languages !== undefined && !Array.isArray(body.languages)) {
    return {
      valid: false,
      error: 'languages bir dizi olmalı'
    }
  }

  // season ve episode sayı olmalı
  if (body.season !== undefined && (typeof body.season !== 'number' || body.season < 0)) {
    return {
      valid: false,
      error: 'season pozitif bir sayı olmalı'
    }
  }

  if (body.episode !== undefined && (typeof body.episode !== 'number' || body.episode < 0)) {
    return {
      valid: false,
      error: 'episode pozitif bir sayı olmalı'
    }
  }

  return { valid: true }
}

// ============ PROXY HANDLER ============

export async function POST(request: NextRequest) {
  try {
    // Request body'yi parse et
    const body: SearchRequestBody = await request.json()

    // Parametreleri doğrula
    const validation = validateSearchParams(body)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: validation.error
        },
        { status: 400 }
      )
    }

    // Search parametrelerini oluştur
    const searchParams: SubtitleSearchParams = {
      tmdbId: body.tmdbId,
      imdbId: body.imdbId,
      query: body.query,
      languages: body.languages || ['tr', 'en'], // Varsayılan diller
      season: body.season,
      episode: body.episode
    }

    // Cache key oluştur
    const cacheKey = getCacheKey(searchParams)

    // Cache'den kontrol et
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      const expiresAt = getCacheExpiry(cacheKey)
      const remainingTTL = expiresAt ? Math.ceil((expiresAt - Date.now()) / 1000) : 0

      return NextResponse.json(
        {
          success: true,
          data: cachedData,
          total: cachedData.length,
          cached: true
        },
        {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-TTL': String(remainingTTL),
            'Cache-Control': `public, max-age=${remainingTTL}`
          }
        }
      )
    }

    // OpenSubtitles client'ı al
    const client = getOpenSubtitlesClient()

    // API yapılandırılmış mı kontrol et
    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'OpenSubtitles API yapılandırılmamış'
        },
        { status: 503 }
      )
    }

    // Rate limit durumunu kontrol et
    const rateLimitStatus = client.getRateLimitStatus()

    // Altyazı ara
    const subtitles = await client.searchSubtitles(searchParams)

    // Cache'e kaydet
    setCache(cacheKey, subtitles)

    // Başarılı yanıt
    return NextResponse.json(
      {
        success: true,
        data: subtitles,
        total: subtitles.length,
        cached: false
      },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Cache-TTL': String(CACHE_TTL_SECONDS),
          'X-RateLimit-Remaining': String(rateLimitStatus.maxRequests - rateLimitStatus.currentCount - 1),
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
        }
      }
    )

  } catch (error) {
    // Hata türüne göre yanıt
    if (error instanceof OpenSubtitlesRateLimitError) {
      const retryAfter = Math.ceil(error.waitTime / 1000)
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: error.message,
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter)
          }
        }
      )
    }

    if (error instanceof OpenSubtitlesNotFoundError) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          total: 0,
          message: 'Altyazı bulunamadı',
          cached: false
        },
        { status: 200 }
      )
    }

    if (error instanceof OpenSubtitlesConfigError) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: error.message
        },
        { status: 503 }
      )
    }

    if (error instanceof OpenSubtitlesAuthError) {
      return NextResponse.json(
        {
          error: 'Authentication Error',
          message: 'OpenSubtitles API kimlik doğrulama hatası'
        },
        { status: 401 }
      )
    }

    // Genel hata
    console.error('Subtitle Search Error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}

// GET endpoint - query parametreleri ile arama
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Query parametrelerini body formatına dönüştür
    const body: SearchRequestBody = {}

    const tmdbId = searchParams.get('tmdbId')
    if (tmdbId) body.tmdbId = parseInt(tmdbId, 10)

    const imdbId = searchParams.get('imdbId')
    if (imdbId) body.imdbId = imdbId

    const query = searchParams.get('query')
    if (query) body.query = query

    const languages = searchParams.get('languages')
    if (languages) body.languages = languages.split(',')

    const season = searchParams.get('season')
    if (season) body.season = parseInt(season, 10)

    const episode = searchParams.get('episode')
    if (episode) body.episode = parseInt(episode, 10)

    // Parametreleri doğrula
    const validation = validateSearchParams(body)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: validation.error
        },
        { status: 400 }
      )
    }

    // Search parametrelerini oluştur
    const subtitleSearchParams: SubtitleSearchParams = {
      tmdbId: body.tmdbId,
      imdbId: body.imdbId,
      query: body.query,
      languages: body.languages || ['tr', 'en'],
      season: body.season,
      episode: body.episode
    }

    // Cache key oluştur
    const cacheKey = getCacheKey(subtitleSearchParams)

    // Cache'den kontrol et
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      const expiresAt = getCacheExpiry(cacheKey)
      const remainingTTL = expiresAt ? Math.ceil((expiresAt - Date.now()) / 1000) : 0

      return NextResponse.json(
        {
          success: true,
          data: cachedData,
          total: cachedData.length,
          cached: true
        },
        {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-TTL': String(remainingTTL),
            'Cache-Control': `public, max-age=${remainingTTL}`
          }
        }
      )
    }

    // OpenSubtitles client'ı al
    const client = getOpenSubtitlesClient()

    // API yapılandırılmış mı kontrol et
    if (!client.isConfigured()) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'OpenSubtitles API yapılandırılmamış'
        },
        { status: 503 }
      )
    }

    // Rate limit durumunu kontrol et
    const rateLimitStatus = client.getRateLimitStatus()

    // Altyazı ara
    const subtitles = await client.searchSubtitles(subtitleSearchParams)

    // Cache'e kaydet
    setCache(cacheKey, subtitles)

    // Başarılı yanıt
    return NextResponse.json(
      {
        success: true,
        data: subtitles,
        total: subtitles.length,
        cached: false
      },
      {
        headers: {
          'X-Cache': 'MISS',
          'X-Cache-TTL': String(CACHE_TTL_SECONDS),
          'X-RateLimit-Remaining': String(rateLimitStatus.maxRequests - rateLimitStatus.currentCount - 1),
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
        }
      }
    )

  } catch (error) {
    // Hata türüne göre yanıt
    if (error instanceof OpenSubtitlesRateLimitError) {
      const retryAfter = Math.ceil(error.waitTime / 1000)
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: error.message,
          retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter)
          }
        }
      )
    }

    if (error instanceof OpenSubtitlesNotFoundError) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          total: 0,
          message: 'Altyazı bulunamadı',
          cached: false
        },
        { status: 200 }
      )
    }

    if (error instanceof OpenSubtitlesConfigError) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: error.message
        },
        { status: 503 }
      )
    }

    if (error instanceof OpenSubtitlesAuthError) {
      return NextResponse.json(
        {
          error: 'Authentication Error',
          message: 'OpenSubtitles API kimlik doğrulama hatası'
        },
        { status: 401 }
      )
    }

    // Genel hata
    console.error('Subtitle Search Error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}

