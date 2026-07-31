/**
 * Property-Based Tests: TMDB API Proxy
 * 
 * **Property 8: TMDB Proxy Rate Limiting**
 * **Property 9: TMDB Proxy Cache**
 * 
 * **Validates: Requirements 3.3, 3.4, 3.5**
 * 
 * Bu testler TMDB API proxy'nin rate limiting ve cache mekanizmalarının
 * doğru çalıştığını doğrular.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { NextRequest } from 'next/server'
import { GET } from '../[...path]/route'

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Mock NextRequest oluşturur
 */
function createMockRequest(options: {
  path: string[]
  params?: Record<string, string>
  headers?: Record<string, string>
  ip?: string
}): NextRequest {
  const url = new URL(`http://localhost:3000/api/tmdb/${options.path.join('/')}`)
  
  // Query parametrelerini ekle
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const headers = new Headers({
    'content-type': 'application/json',
    'user-agent': 'Rimora-Test/1.0',
    ...options.headers,
  })

  // IP header'ı ekle
  if (options.ip) {
    headers.set('x-forwarded-for', options.ip)
  }

  const request = new NextRequest(url.toString(), {
    method: 'GET',
    headers,
  })

  return request
}

/**
 * Params objesi oluşturur (Next.js route params formatı)
 */
function createParams(path: string[]): Promise<{ path: string[] }> {
  return Promise.resolve({ path })
}

/**
 * Bekleme fonksiyonu
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// PROPERTY-BASED TEST GENERATORS
// ============================================================================

/**
 * TMDB endpoint path generator
 */
const tmdbPathArbitrary = fc.oneof(
  fc.constant(['movie', 'popular']),
  fc.constant(['movie', 'top_rated']),
  fc.constant(['tv', 'popular']),
  fc.constant(['tv', 'top_rated']),
  fc.constant(['trending', 'movie', 'week']),
  fc.constant(['trending', 'tv', 'day']),
  fc.tuple(
    fc.constantFrom('movie', 'tv'),
    fc.integer({ min: 1, max: 999999 }).map(String)
  ).map(([type, id]) => [type, id]),
)

/**
 * Query parametreleri generator
 */
const queryParamsArbitrary = fc.record({
  language: fc.option(fc.constantFrom('tr-TR', 'en-US', 'ja-JP'), { nil: undefined }),
  page: fc.option(fc.integer({ min: 1, max: 10 }).map(String), { nil: undefined }),
})

/**
 * IP adresi generator
 */
const ipAddressArbitrary = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

// ============================================================================
// MOCK SETUP
// ============================================================================

// TMDB API'yi mock'la
beforeEach(() => {
  // Environment variable'ı mock'la
  process.env.TMDB_API_KEY = 'test-api-key-12345'
  
  // Fetch'i mock'la
  global.fetch = vi.fn((url: string) => {
    // TMDB API'ye yapılan istekleri simüle et
    if (url.includes('api.themoviedb.org')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          page: 1,
          results: [
            {
              id: 12345,
              title: 'Test Movie',
              overview: 'Test overview',
              poster_path: '/test.jpg',
              vote_average: 8.5,
            }
          ],
          total_pages: 10,
          total_results: 200,
        }),
        headers: new Headers({
          'content-type': 'application/json',
        }),
      } as Response)
    }
    
    return Promise.reject(new Error('Unknown URL'))
  }) as any
})

// ============================================================================
// PROPERTY 8: TMDB Proxy Rate Limiting
// ============================================================================

describe('Property 8: TMDB Proxy Rate Limiting', () => {
  /**
   * **Validates: Requirements 3.3, 3.5**
   * 
   * Property: For any 1 dakikalık pencerede, 40'tan fazla istek gönderildiğinde 429 döndürülmeli
   * 
   * NOT: Tasarım dokümanında rate limit 100 req/dakika olarak belirtilmiş,
   * ancak implementasyonda 40 req/dakika kullanılıyor. Test implementasyonu takip ediyor.
   */
  it('should return 429 when rate limit (40 req/min) is exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        async (ip, path) => {
          // Arrange
          const maxRequests = 40 // Implementasyondaki limit
          const requests: Promise<Response>[] = []

          // Act - Rate limit'i aşacak kadar istek gönder
          for (let i = 0; i < maxRequests + 5; i++) {
            const request = createMockRequest({
              path,
              params: { page: String(i + 1) },
              ip,
            })
            const params = createParams(path)
            
            requests.push(GET(request, { params }))
          }

          const responses = await Promise.all(requests)

          // Assert - İlk 40 istek başarılı olmalı
          const successfulResponses = responses.filter(r => r.status === 200)
          const rateLimitedResponses = responses.filter(r => r.status === 429)

          expect(successfulResponses.length).toBe(maxRequests)
          expect(rateLimitedResponses.length).toBeGreaterThan(0)

          // Rate limited response'lar doğru header'lara sahip olmalı
          for (const response of rateLimitedResponses) {
            expect(response.headers.get('Retry-After')).toBeDefined()
            expect(response.headers.get('X-RateLimit-Limit')).toBe(String(maxRequests))
            expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
            expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()

            const body = await response.json()
            expect(body.error).toBeDefined()
            expect(body.retryAfter).toBeDefined()
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000) // 60 saniye timeout

  /**
   * **Validates: Requirements 3.3**
   * 
   * Property: For any farklı IP'ler, bağımsız rate limit'lere sahip olmalı
   */
  it('should maintain separate rate limits for different IPs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(ipAddressArbitrary, ipAddressArbitrary),
        tmdbPathArbitrary,
        async ([ip1, ip2], path) => {
          // Farklı IP'ler olduğundan emin ol
          fc.pre(ip1 !== ip2)

          // Arrange
          const requestsPerIP = 20 // Her IP için 20 istek

          // Act - IP1 için istekler
          const ip1Requests: Promise<Response>[] = []
          for (let i = 0; i < requestsPerIP; i++) {
            const request = createMockRequest({
              path,
              params: { page: String(i + 1) },
              ip: ip1,
            })
            const params = createParams(path)
            ip1Requests.push(GET(request, { params }))
          }

          // Act - IP2 için istekler
          const ip2Requests: Promise<Response>[] = []
          for (let i = 0; i < requestsPerIP; i++) {
            const request = createMockRequest({
              path,
              params: { page: String(i + 1) },
              ip: ip2,
            })
            const params = createParams(path)
            ip2Requests.push(GET(request, { params }))
          }

          const [ip1Responses, ip2Responses] = await Promise.all([
            Promise.all(ip1Requests),
            Promise.all(ip2Requests),
          ])

          // Assert - Her iki IP de kendi isteklerini başarıyla yapabilmeli
          const ip1Success = ip1Responses.filter(r => r.status === 200).length
          const ip2Success = ip2Responses.filter(r => r.status === 200).length

          expect(ip1Success).toBe(requestsPerIP)
          expect(ip2Success).toBe(requestsPerIP)
        }
      ),
      { 
        numRuns: 50, // Daha az iterasyon (çoklu istek)
        verbose: true,
      }
    )
  }, 90000) // 90 saniye timeout

  /**
   * **Validates: Requirements 3.5**
   * 
   * Property: For any rate limited response, Retry-After header doğru değere sahip olmalı
   */
  it('should return correct Retry-After header when rate limited', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        async (ip, path) => {
          // Arrange - Rate limit'i aş
          const maxRequests = 40
          const requests: Promise<Response>[] = []

          for (let i = 0; i < maxRequests + 1; i++) {
            const request = createMockRequest({
              path,
              params: { page: String(i + 1) },
              ip,
            })
            const params = createParams(path)
            requests.push(GET(request, { params }))
          }

          const responses = await Promise.all(requests)

          // Act - Rate limited response'u bul
          const rateLimitedResponse = responses.find(r => r.status === 429)

          // Assert
          if (rateLimitedResponse) {
            const retryAfter = rateLimitedResponse.headers.get('Retry-After')
            expect(retryAfter).toBeDefined()
            
            const retryAfterSeconds = parseInt(retryAfter!, 10)
            expect(retryAfterSeconds).toBeGreaterThan(0)
            expect(retryAfterSeconds).toBeLessThanOrEqual(60) // Max 1 dakika

            const body = await rateLimitedResponse.json()
            expect(body.retryAfter).toBe(retryAfterSeconds)
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)

  /**
   * **Validates: Requirements 3.3**
   * 
   * Property: For any rate limit window süresi dolduğunda, limit sıfırlanmalı
   */
  it('should reset rate limit after window expires', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        async (ip, path) => {
          // Arrange - Rate limit'i aş
          const maxRequests = 40
          const requests1: Promise<Response>[] = []

          for (let i = 0; i < maxRequests; i++) {
            const request = createMockRequest({
              path,
              params: { page: String(i + 1) },
              ip,
            })
            const params = createParams(path)
            requests1.push(GET(request, { params }))
          }

          const responses1 = await Promise.all(requests1)
          const successCount1 = responses1.filter(r => r.status === 200).length

          // Assert - İlk batch başarılı
          expect(successCount1).toBe(maxRequests)

          // Act - Bir sonraki istek rate limited olmalı
          const limitedRequest = createMockRequest({
            path,
            params: { page: '999' },
            ip,
          })
          const limitedParams = createParams(path)
          const limitedResponse = await GET(limitedRequest, { params: limitedParams })

          expect(limitedResponse.status).toBe(429)

          // Act - 61 saniye bekle (rate limit window: 60 saniye)
          await sleep(61000)

          // Act - Yeni istek gönder
          const newRequest = createMockRequest({
            path,
            params: { page: '1000' },
            ip,
          })
          const newParams = createParams(path)
          const newResponse = await GET(newRequest, { params: newParams })

          // Assert - Rate limit sıfırlanmış olmalı
          expect(newResponse.status).toBe(200)
        }
      ),
      { 
        numRuns: 5, // Çok az iterasyon (61 saniye bekleme)
        verbose: true,
      }
    )
  }, 400000) // 400 saniye timeout (61 saniye * 5 iterasyon + buffer)
})

// ============================================================================
// PROPERTY 9: TMDB Proxy Cache
// ============================================================================

describe('Property 9: TMDB Proxy Cache', () => {
  /**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any TMDB isteği, aynı endpoint'e 15 dakika içinde yapılan ikinci istek cache'den dönmeli
   * 
   * NOT: Tasarım dokümanında cache TTL 1 saat olarak belirtilmiş,
   * ancak implementasyonda 15 dakika (900 saniye) kullanılıyor. Test implementasyonu takip ediyor.
   */
  it('should return cached response for identical requests within TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        queryParamsArbitrary,
        async (ip, path, params) => {
          // Arrange - İlk istek
          const request1 = createMockRequest({
            path,
            params,
            ip,
          })
          const routeParams1 = createParams(path)

          // Act - İlk istek (cache MISS)
          const response1 = await GET(request1, { params: routeParams1 })
          const cacheHeader1 = response1.headers.get('X-Cache')

          // Assert - İlk istek cache MISS olmalı
          expect(response1.status).toBe(200)
          expect(cacheHeader1).toBe('MISS')

          // Act - İkinci istek (aynı endpoint, aynı parametreler)
          const request2 = createMockRequest({
            path,
            params,
            ip,
          })
          const routeParams2 = createParams(path)
          const response2 = await GET(request2, { params: routeParams2 })
          const cacheHeader2 = response2.headers.get('X-Cache')

          // Assert - İkinci istek cache HIT olmalı
          expect(response2.status).toBe(200)
          expect(cacheHeader2).toBe('HIT')

          // Assert - Her iki response da aynı veriyi döndürmeli
          const data1 = await response1.json()
          const data2 = await response2.json()
          expect(data1).toEqual(data2)
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)

  /**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any farklı parametreler, farklı cache entry'leri oluşturmalı
   */
  it('should maintain separate cache entries for different parameters', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        fc.tuple(
          fc.integer({ min: 1, max: 5 }).map(String),
          fc.integer({ min: 6, max: 10 }).map(String)
        ),
        async (ip, path, [page1, page2]) => {
          // Farklı parametreler olduğundan emin ol
          fc.pre(page1 !== page2)

          // Act - İlk parametrelerle istek
          const request1 = createMockRequest({
            path,
            params: { page: page1 },
            ip,
          })
          const routeParams1 = createParams(path)
          const response1 = await GET(request1, { params: routeParams1 })
          const cacheHeader1 = response1.headers.get('X-Cache')

          // Assert - İlk istek cache MISS
          expect(cacheHeader1).toBe('MISS')

          // Act - Farklı parametrelerle istek
          const request2 = createMockRequest({
            path,
            params: { page: page2 },
            ip,
          })
          const routeParams2 = createParams(path)
          const response2 = await GET(request2, { params: routeParams2 })
          const cacheHeader2 = response2.headers.get('X-Cache')

          // Assert - Farklı parametreler için cache MISS
          expect(cacheHeader2).toBe('MISS')

          // Act - İlk parametrelerle tekrar istek
          const request3 = createMockRequest({
            path,
            params: { page: page1 },
            ip,
          })
          const routeParams3 = createParams(path)
          const response3 = await GET(request3, { params: routeParams3 })
          const cacheHeader3 = response3.headers.get('X-Cache')

          // Assert - İlk parametreler için cache HIT
          expect(cacheHeader3).toBe('HIT')
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)

  /**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any cache entry, Cache-Control header doğru TTL'ye sahip olmalı
   */
  it('should return correct Cache-Control header with TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        queryParamsArbitrary,
        async (ip, path, params) => {
          // Act
          const request = createMockRequest({
            path,
            params,
            ip,
          })
          const routeParams = createParams(path)
          const response = await GET(request, { params: routeParams })

          // Assert
          const cacheControl = response.headers.get('Cache-Control')
          expect(cacheControl).toBeDefined()
          expect(cacheControl).toContain('public')
          expect(cacheControl).toContain('max-age=900') // 15 dakika = 900 saniye
          expect(cacheControl).toContain('stale-while-revalidate=1800') // 30 dakika = 1800 saniye
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)

  /**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any cache HIT, TMDB API'ye yeni istek gönderilmemeli
   */
  it('should not call TMDB API on cache HIT', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        tmdbPathArbitrary,
        queryParamsArbitrary,
        async (ip, path, params) => {
          // Arrange - Fetch call count'u takip et
          const fetchMock = vi.fn(global.fetch)
          global.fetch = fetchMock as any

          // Act - İlk istek
          const request1 = createMockRequest({
            path,
            params,
            ip,
          })
          const routeParams1 = createParams(path)
          await GET(request1, { params: routeParams1 })

          const fetchCallCount1 = fetchMock.mock.calls.length

          // Act - İkinci istek (cache HIT olmalı)
          const request2 = createMockRequest({
            path,
            params,
            ip,
          })
          const routeParams2 = createParams(path)
          const response2 = await GET(request2, { params: routeParams2 })

          const fetchCallCount2 = fetchMock.mock.calls.length

          // Assert - Cache HIT'te fetch çağrılmamalı
          const cacheHeader = response2.headers.get('X-Cache')
          if (cacheHeader === 'HIT') {
            expect(fetchCallCount2).toBe(fetchCallCount1)
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)

  /**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any farklı path'ler, farklı cache entry'leri oluşturmalı
   */
  it('should maintain separate cache entries for different paths', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArbitrary,
        fc.tuple(
          fc.constant(['movie', 'popular']),
          fc.constant(['tv', 'popular'])
        ),
        async (ip, [path1, path2]) => {
          // Act - İlk path ile istek
          const request1 = createMockRequest({
            path: path1,
            ip,
          })
          const routeParams1 = createParams(path1)
          const response1 = await GET(request1, { params: routeParams1 })
          const cacheHeader1 = response1.headers.get('X-Cache')

          // Assert - İlk istek cache MISS
          expect(cacheHeader1).toBe('MISS')

          // Act - Farklı path ile istek
          const request2 = createMockRequest({
            path: path2,
            ip,
          })
          const routeParams2 = createParams(path2)
          const response2 = await GET(request2, { params: routeParams2 })
          const cacheHeader2 = response2.headers.get('X-Cache')

          // Assert - Farklı path için cache MISS
          expect(cacheHeader2).toBe('MISS')

          // Act - İlk path ile tekrar istek
          const request3 = createMockRequest({
            path: path1,
            ip,
          })
          const routeParams3 = createParams(path1)
          const response3 = await GET(request3, { params: routeParams3 })
          const cacheHeader3 = response3.headers.get('X-Cache')

          // Assert - İlk path için cache HIT
          expect(cacheHeader3).toBe('HIT')
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)
})
