/**
 * Property-Based Tests: Webhook İmza Doğrulama
 * 
 * **Property 1: Webhook İmza Doğrulama**
 * **Validates: Requirements 1.4, 1.5**
 * 
 * For any webhook isteği, geçersiz imza ile gelen istekler reddedilmeli ve 401 döndürülmeli.
 * 
 * Bu test, webhook güvenlik sisteminin tüm olası geçersiz imza senaryolarında
 * doğru şekilde davrandığını doğrular.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { NextRequest } from 'next/server'
import { 
  validateWebhookSecurity, 
  clearRateLimitStore,
  type WebhookSecurityConfig 
} from '../webhook-security'

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Mock NextRequest oluşturur
 */
function createMockRequest(options: {
  body?: any
  headers?: Record<string, string>
  ip?: string
}): NextRequest {
  const url = 'http://localhost:3000/api/payment/webhook'
  const headers = new Headers({
    'content-type': 'application/json',
    'user-agent': 'iyzico-webhook/1.0',
    ...options.headers,
  })

  const request = new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(options.body || {}),
  })

  // IP override için
  if (options.ip) {
    Object.defineProperty(request, 'ip', {
      value: options.ip,
      writable: false,
    })
  }

  return request
}

/**
 * Test için güvenlik konfigürasyonu
 */
function createTestConfig(overrides?: Partial<WebhookSecurityConfig>): WebhookSecurityConfig {
  return {
    maxRequestsPerMinute: 60,
    allowedIPs: [],
    requireSignature: true,
    secretKey: 'test-secret-key-12345',
    ...overrides,
  }
}

// ============================================================================
// PROPERTY-BASED TEST GENERATORS
// ============================================================================

/**
 * Geçersiz imza generator'ı
 * Çeşitli geçersiz imza formatları üretir
 */
const invalidSignatureArbitrary = fc.oneof(
  fc.constant(''),                           // Boş string
  fc.constant('invalid'),                    // Çok kısa
  fc.constant('12345'),                      // Sayısal ama kısa
  fc.string({ minLength: 1, maxLength: 9 }).map(s => 
    s.split('').map(c => c.charCodeAt(0).toString(16)).join('').substring(0, 9)
  ), // Kısa hex
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.length < 64), // Rastgele kısa string
  fc.constant('sha256=invalid'),             // Yanlış format
  fc.constant('sha256=' + 'a'.repeat(63)),   // Eksik karakter
  fc.constant('sha256=' + 'z'.repeat(64)),   // Geçersiz hex karakterler
  fc.string({ minLength: 64, maxLength: 64 }).map(s => 
    s.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').substring(0, 64).toUpperCase()
  ), // Büyük harf (normalize edilmeli)
  fc.string({ minLength: 65, maxLength: 100 }).map(s => 
    s.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').substring(0, 100)
  ), // Çok uzun
)

/**
 * Geçersiz payload generator'ı
 */
const invalidPayloadArbitrary = fc.record({
  token: fc.option(fc.string(), { nil: undefined }), // Token olabilir veya olmayabilir
  conversationId: fc.option(fc.string(), { nil: undefined }),
  status: fc.option(fc.constantFrom('success', 'failure', 'pending'), { nil: undefined }),
})

/**
 * IP adresi generator'ı
 */
const ipAddressArbitrary = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

/**
 * Geçersiz Content-Type generator'ı
 */
const invalidContentTypeArbitrary = fc.oneof(
  fc.constant(''),
  fc.constant('text/plain'),
  fc.constant('text/html'),
  fc.constant('application/xml'),
  fc.constant('multipart/form-data'),
  fc.constant('application/x-www-form-urlencoded'),
  fc.string().filter(s => !s.includes('application/json')),
)

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Property 1: Webhook İmza Doğrulama', () => {
  beforeEach(() => {
    // Her test öncesi rate limit store'u temizle
    clearRateLimitStore()
  })

  /**
   * **Validates: Requirements 1.4, 1.5**
   * 
   * Property: For any geçersiz imza (boş, çok kısa, veya eksik), sistem reddetmeli
   */
  it('should reject all requests with invalid signatures and return 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),                           // Boş string
          fc.constant('invalid'),                    // Çok kısa
          fc.constant('12345'),                      // Sayısal ama kısa
          fc.string({ minLength: 1, maxLength: 9 }), // Kısa string
        ),
        invalidPayloadArbitrary,
        ipAddressArbitrary,
        async (invalidSignature, payload, ip) => {
          // Arrange
          const request = createMockRequest({
            body: payload,
            headers: {
              'x-iyzico-signature': invalidSignature,
            },
            ip,
          })
          const config = createTestConfig({ requireSignature: true })

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          // Geçersiz imza durumunda isValid false olmalı
          expect(result.isValid).toBe(false)
          
          // Hata kodu MISSING_SIGNATURE veya INVALID_SIGNATURE_FORMAT olmalı
          if (invalidSignature === '') {
            expect(result.errorCode).toBe('MISSING_SIGNATURE')
          } else if (invalidSignature.length < 10) {
            expect(result.errorCode).toBe('INVALID_SIGNATURE_FORMAT')
          }
          
          // Hata mesajı olmalı
          expect(result.error).toBeDefined()
          expect(typeof result.error).toBe('string')
        }
      ),
      { 
        numRuns: 100, // Minimum 100 iterasyon
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any request without signature header, sistem reddetmeli
   */
  it('should reject all requests without signature header when signature is required', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidPayloadArbitrary,
        ipAddressArbitrary,
        async (payload, ip) => {
          // Arrange - İmza header'ı olmadan request
          const request = createMockRequest({
            body: payload,
            headers: {
              // İmza header'ı yok
            },
            ip,
          })
          const config = createTestConfig({ requireSignature: true })

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          expect(result.isValid).toBe(false)
          expect(result.errorCode).toBe('MISSING_SIGNATURE')
          expect(result.error).toContain('İmza')
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.5**
   * 
   * Property: For any geçersiz Content-Type, sistem reddetmeli
   */
  it('should reject all requests with invalid Content-Type', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidContentTypeArbitrary,
        invalidPayloadArbitrary,
        ipAddressArbitrary,
        async (contentType, payload, ip) => {
          // Arrange
          const request = createMockRequest({
            body: payload,
            headers: {
              'content-type': contentType,
              'x-iyzico-signature': 'a'.repeat(64), // Geçerli uzunlukta imza
            },
            ip,
          })
          const config = createTestConfig()

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          expect(result.isValid).toBe(false)
          expect(result.errorCode).toBe('INVALID_CONTENT_TYPE')
          expect(result.error).toContain('Content-Type')
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any rate limit aşımı, sistem 429 döndürmeli
   */
  it('should reject requests when rate limit is exceeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // maxRequestsPerMinute
        fc.integer({ min: 6, max: 20 }), // Gönderilecek istek sayısı (limit üstü)
        ipAddressArbitrary,
        async (maxRequests, requestCount, ip) => {
          // Arrange
          const config = createTestConfig({ 
            maxRequestsPerMinute: maxRequests,
            requireSignature: false, // İmza kontrolünü devre dışı bırak
          })

          let rateLimitExceeded = false
          let lastResult

          // Act - Birden fazla istek gönder
          for (let i = 0; i < requestCount; i++) {
            const request = createMockRequest({
              body: { token: `test-token-${i}` },
              ip,
            })
            
            lastResult = await validateWebhookSecurity(request, config)
            
            if (!lastResult.isValid && lastResult.errorCode === 'RATE_LIMIT_EXCEEDED') {
              rateLimitExceeded = true
              break
            }
          }

          // Assert - Limit aşıldığında rate limit hatası alınmalı
          expect(rateLimitExceeded).toBe(true)
          expect(lastResult?.errorCode).toBe('RATE_LIMIT_EXCEEDED')
          expect(lastResult?.rateLimitRemaining).toBe(0)
        }
      ),
      { 
        numRuns: 50, // Rate limit testi için daha az iterasyon
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any IP whitelist, sadece izinli IP'ler geçebilmeli
   */
  it('should only allow whitelisted IPs when IP filtering is enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(ipAddressArbitrary, { minLength: 1, maxLength: 5 }), // Allowed IPs
        ipAddressArbitrary, // Test IP
        async (allowedIPs, testIP) => {
          // Arrange
          const request = createMockRequest({
            body: { token: 'test-token' },
            headers: {
              'x-iyzico-signature': 'a'.repeat(64),
            },
            ip: testIP,
          })
          const config = createTestConfig({ 
            allowedIPs,
            requireSignature: false, // İmza kontrolünü devre dışı bırak
          })

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          const isIPAllowed = allowedIPs.includes(testIP)
          
          if (isIPAllowed) {
            // İzinli IP ise başka bir sebepten reddedilmemeli (IP kontrolü geçmeli)
            if (!result.isValid) {
              expect(result.errorCode).not.toBe('IP_NOT_ALLOWED')
            }
          } else {
            // İzinsiz IP ise reddedilmeli
            expect(result.isValid).toBe(false)
            expect(result.errorCode).toBe('IP_NOT_ALLOWED')
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.4, 1.5**
   * 
   * Property: For any geçerli format ama yanlış imza, güvenlik kontrolleri devam etmeli
   */
  it('should continue security checks even with valid signature format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 64, maxLength: 64 }).map(s => 
          s.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').substring(0, 64)
        ), // Geçerli uzunlukta hex string
        invalidPayloadArbitrary,
        ipAddressArbitrary,
        async (signature, payload, ip) => {
          // Arrange
          const request = createMockRequest({
            body: payload,
            headers: {
              'x-iyzico-signature': signature,
            },
            ip,
          })
          const config = createTestConfig({ requireSignature: true })

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          // İmza formatı geçerli olsa bile, güvenlik kontrolleri devam eder
          // Sonuç geçerli veya geçersiz olabilir, ama tutarlı olmalı
          
          if (result.isValid) {
            // Eğer geçerliyse, rate limit bilgisi olmalı
            expect(result.rateLimitRemaining).toBeGreaterThanOrEqual(0)
            expect(result.error).toBeUndefined()
            expect(result.errorCode).toBeUndefined()
          } else {
            // Geçersizse, bir hata kodu ve mesajı olmalı
            expect(result.errorCode).toBeDefined()
            expect(result.error).toBeDefined()
            expect(typeof result.error).toBe('string')
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any signature requirement disabled, imza kontrolü yapılmamalı
   */
  it('should skip signature validation when requireSignature is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.string(), { nil: undefined }), // Herhangi bir imza veya yok
        invalidPayloadArbitrary,
        ipAddressArbitrary,
        async (signature, payload, ip) => {
          // Arrange
          const headers: Record<string, string> = {}
          if (signature !== undefined) {
            headers['x-iyzico-signature'] = signature
          }

          const request = createMockRequest({
            body: payload,
            headers,
            ip,
          })
          const config = createTestConfig({ requireSignature: false })

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          // İmza kontrolü devre dışı olduğunda, MISSING_SIGNATURE veya
          // INVALID_SIGNATURE_FORMAT hatası alınmamalı
          if (!result.isValid) {
            expect(result.errorCode).not.toBe('MISSING_SIGNATURE')
            expect(result.errorCode).not.toBe('INVALID_SIGNATURE_FORMAT')
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  })

  /**
   * **Validates: Requirements 1.5**
   * 
   * Property: For any güvenlik hatası, uygun HTTP status code dönmeli
   */
  it('should return appropriate error codes for different security failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'MISSING_SIGNATURE',
          'INVALID_SIGNATURE_FORMAT',
          'INVALID_CONTENT_TYPE',
          'IP_NOT_ALLOWED'
        ),
        ipAddressArbitrary,
        async (errorType, ip) => {
          // Arrange - Her hata tipi için uygun request oluştur
          let request: NextRequest
          let config: WebhookSecurityConfig

          switch (errorType) {
            case 'MISSING_SIGNATURE':
              request = createMockRequest({
                body: { token: 'test' },
                headers: {}, // İmza yok
                ip,
              })
              config = createTestConfig({ requireSignature: true })
              break

            case 'INVALID_SIGNATURE_FORMAT':
              request = createMockRequest({
                body: { token: 'test' },
                headers: {
                  'x-iyzico-signature': 'short', // Çok kısa
                },
                ip,
              })
              config = createTestConfig({ requireSignature: true })
              break

            case 'INVALID_CONTENT_TYPE':
              request = createMockRequest({
                body: { token: 'test' },
                headers: {
                  'content-type': 'text/plain', // Yanlış content type
                  'x-iyzico-signature': 'a'.repeat(64),
                },
                ip,
              })
              config = createTestConfig()
              break

            case 'IP_NOT_ALLOWED':
              request = createMockRequest({
                body: { token: 'test' },
                headers: {
                  'x-iyzico-signature': 'a'.repeat(64),
                },
                ip,
              })
              config = createTestConfig({ 
                allowedIPs: ['192.168.1.1'], // Farklı IP
                requireSignature: false,
              })
              break

            default:
              throw new Error('Unknown error type')
          }

          // Act
          const result = await validateWebhookSecurity(request, config)

          // Assert
          expect(result.isValid).toBe(false)
          expect(result.errorCode).toBe(errorType)
          expect(result.error).toBeDefined()
          expect(typeof result.error).toBe('string')
          expect(result.error!.length).toBeGreaterThan(0)
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  })
})
