import { NextRequest, NextResponse } from 'next/server'
import { setDefaultResultOrder } from 'node:dns'

// ============ CONFIGURATION ============
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Windows'ta IPv6 (::1) sorununu önlemek için IPv4 önceliği
setDefaultResultOrder('ipv4first')

// Rate limiting config - Tasarım gereksinimlerine göre güncellendi (Gereksinim 3.3)
const RATE_LIMIT_WINDOW_MS = 60000 // 1 dakika
const RATE_LIMIT_MAX_REQUESTS = 40 // 40 istek/dakika

// Cache config - Tasarım gereksinimlerine göre güncellendi (Gereksinim 3.4)
const CACHE_TTL_SECONDS = 900 // 15 dakika

// ============ RATE LIMITING ============
interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory rate limit store (production'da Redis kullanılmalı)
const rateLimitStore = new Map<string, RateLimitEntry>()

function getClientIP(request: NextRequest): string {
  // Cloudflare, Vercel, nginx gibi proxy'lerden gelen gerçek IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback
  return 'unknown'
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(clientIP)

  // Yeni pencere başlat veya süresi dolmuş pencereyi sıfırla
  if (!entry || now >= entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    }
    rateLimitStore.set(clientIP, newEntry)
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime: newEntry.resetTime
    }
  }

  // Limit kontrolü
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }

  // İstek sayısını artır
  entry.count++
  rateLimitStore.set(clientIP, entry)

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime
  }
}

// Periyodik olarak eski rate limit entry'lerini temizle
function cleanupRateLimitStore() {
  const now = Date.now()
  const keysToDelete: string[] = []
  rateLimitStore.forEach((entry, key) => {
    if (now >= entry.resetTime) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => rateLimitStore.delete(key))
}

// Her 5 dakikada bir temizlik yap
setInterval(cleanupRateLimitStore, 5 * 60 * 1000)

// ============ CACHE ============
interface CacheEntry {
  data: any
  expiresAt: number
}

// In-memory cache store (production'da Redis kullanılmalı)
const cacheStore = new Map<string, CacheEntry>()

function getCacheKey(path: string, params: URLSearchParams): string {
  // API key'i cache key'den çıkar
  const entries: [string, string][] = []
  params.forEach((value, key) => {
    if (key !== 'api_key') {
      entries.push([key, value])
    }
  })
  entries.sort((a, b) => a[0].localeCompare(b[0]))
  const sortedParams = new URLSearchParams(entries)
  return `${path}?${sortedParams.toString()}`
}

function getFromCache(cacheKey: string): any | null {
  const entry = cacheStore.get(cacheKey)

  if (!entry) {
    return null
  }

  // Cache süresi dolmuş mu kontrol et
  if (Date.now() >= entry.expiresAt) {
    cacheStore.delete(cacheKey)
    return null
  }

  return entry.data
}

function setCache(cacheKey: string, data: any): void {
  const entry: CacheEntry = {
    data,
    expiresAt: Date.now() + (CACHE_TTL_SECONDS * 1000)
  }
  cacheStore.set(cacheKey, entry)
}

// Periyodik olarak eski cache entry'lerini temizle
function cleanupCacheStore() {
  const now = Date.now()
  const keysToDelete: string[] = []
  cacheStore.forEach((entry, key) => {
    if (now >= entry.expiresAt) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => cacheStore.delete(key))
}

// Her 10 dakikada bir temizlik yap
setInterval(cleanupCacheStore, 10 * 60 * 1000)

// ============ ERROR LOGGING ============
function logError(error: any, context: string, clientIP: string) {
  console.error(`[TMDB Proxy Error] ${context}:`, {
    error: error.message || error,
    stack: error.stack,
    clientIP,
    timestamp: new Date().toISOString()
  })
}

// ============ PROXY HANDLER ============
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const clientIP = getClientIP(request)

  // API key kontrolü (Gereksinim 3.2)
  if (!TMDB_API_KEY) {
    logError(new Error('TMDB_API_KEY is not configured'), 'Configuration', clientIP)
    return NextResponse.json(
      { error: 'API yapılandırma hatası' },
      { status: 500 }
    )
  }

  // Rate limiting kontrolü (Gereksinim 3.3)
  const rateLimit = checkRateLimit(clientIP)

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: 'Çok Fazla İstek',
        message: 'İstek sınırı aşıldı. Lütfen daha sonra tekrar deneyin.',
        retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
        }
      }
    )
  }

  try {
    // Path'i oluştur
    const resolvedParams = await params
    const pathSegments = resolvedParams.path
    const tmdbPath = '/' + pathSegments.join('/')

    // Query parametrelerini al
    const searchParams = new URLSearchParams(request.nextUrl.searchParams)

    // Cache key oluştur
    const cacheKey = getCacheKey(tmdbPath, searchParams)

    // Cache'den kontrol et (Gereksinim 3.4)
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: {
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000)),
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`
        }
      })
    }

    // TMDB API URL'ini oluştur
    const tmdbUrl = new URL(`${TMDB_BASE_URL}${tmdbPath}`)

    // API key ekle (server-side'da gizli - Gereksinim 3.1, 3.2)
    tmdbUrl.searchParams.set('api_key', TMDB_API_KEY)

    // Varsayılan dil (eğer belirtilmemişse)
    if (!searchParams.has('language')) {
      tmdbUrl.searchParams.set('language', 'tr-TR')
    }

    // Diğer parametreleri ekle
    searchParams.forEach((value, key) => {
      if (key !== 'api_key') { // Client'tan gelen api_key'i yoksay
        tmdbUrl.searchParams.set(key, value)
      }
    })

    // Timeout ekle - TMDB yanıt vermezse 15 saniyede iptal et
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(tmdbUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Rimora-Platform/1.0'
      },
      signal: controller.signal,
      cache: 'no-store', // Next.js extended fetch cache'ini devre dışı bırak
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // TMDB hata yanıtını ilet
      const errorData = await response.json().catch(() => ({}))
      logError(
        { status: response.status, message: errorData.status_message },
        'TMDB API Error',
        clientIP
      )
      
      return NextResponse.json(
        {
          error: 'TMDB API Hatası',
          status: response.status,
          message: errorData.status_message || 'Bilinmeyen hata'
        },
        {
          status: response.status,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
          }
        }
      )
    }

    const data = await response.json()

    // Cache'e kaydet
    setCache(cacheKey, data)

    return NextResponse.json(data, {
      headers: {
        'X-Cache': 'MISS',
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000)),
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`
      }
    })
  } catch (error) {
    logError(error, 'Proxy Error', clientIP)
    return NextResponse.json(
      {
        error: 'Proxy Hatası',
        message: 'TMDB\'den veri alınamadı'
      },
      {
        status: 502,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
        }
      }
    )
  }
}

// POST istekleri için de destek (bazı TMDB endpoint'leri POST kullanabilir)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const clientIP = getClientIP(request)

  // API key kontrolü
  if (!TMDB_API_KEY) {
    logError(new Error('TMDB_API_KEY is not configured'), 'Configuration', clientIP)
    return NextResponse.json(
      { error: 'API yapılandırma hatası' },
      { status: 500 }
    )
  }

  // Rate limiting kontrolü
  const rateLimit = checkRateLimit(clientIP)

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: 'Çok Fazla İstek',
        message: 'İstek sınırı aşıldı. Lütfen daha sonra tekrar deneyin.',
        retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
        }
      }
    )
  }

  try {
    // Path'i oluştur
    const resolvedParams = await params
    const pathSegments = resolvedParams.path
    const tmdbPath = '/' + pathSegments.join('/')

    // TMDB API URL'ini oluştur
    const tmdbUrl = new URL(`${TMDB_BASE_URL}${tmdbPath}`)
    tmdbUrl.searchParams.set('api_key', TMDB_API_KEY)

    const body = await request.json().catch(() => ({}))

    const response = await fetch(tmdbUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Rimora-Platform/1.0'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logError(
        { status: response.status, message: errorData.status_message },
        'TMDB API POST Error',
        clientIP
      )
      
      return NextResponse.json(
        {
          error: 'TMDB API Hatası',
          status: response.status,
          message: errorData.status_message || 'Bilinmeyen hata'
        },
        {
          status: response.status,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
          }
        }
      )
    }

    const data = await response.json()

    return NextResponse.json(data, {
      headers: {
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
      }
    })
  } catch (error) {
    logError(error, 'Proxy POST Error', clientIP)
    return NextResponse.json(
      {
        error: 'Proxy Hatası',
        message: 'TMDB\'den veri alınamadı'
      },
      {
        status: 502,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000))
        }
      }
    )
  }
}

// Geçersiz API isteği için 400 Bad Request hatası (Gereksinim 3.5)
export async function handler(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Geçersiz İstek',
      message: 'Desteklenmeyen HTTP metodu'
    },
    { status: 400 }
  )
}

// Test utilities are internal - do not export from route files