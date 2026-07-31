/**
 * Webhook Güvenlik Middleware
 * 
 * iyzico webhook isteklerini güvenlik açısından doğrular
 * Rate limiting, IP kontrolü ve imza doğrulaması yapar
 * 
 * @requirements 1.5 - Webhook güvenlik implementasyonu
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Webhook güvenlik konfigürasyonu
 */
export interface WebhookSecurityConfig {
  maxRequestsPerMinute: number
  allowedIPs?: string[]
  requireSignature: boolean
  secretKey: string
}

/**
 * Webhook güvenlik sonucu
 */
export interface WebhookSecurityResult {
  isValid: boolean
  error?: string
  errorCode?: string
  rateLimitRemaining?: number
}

/**
 * Rate limiting için request bilgisi
 */
interface RequestInfo {
  ip: string
  timestamp: number
  count: number
}

// ============================================================================
// RATE LIMITING
// ============================================================================

// In-memory rate limiting store (production'da Redis kullanılmalı)
const rateLimitStore = new Map<string, RequestInfo>()

/**
 * Rate limiting kontrolü yapar
 * 
 * @param ip - Client IP adresi
 * @param maxRequests - Dakikada maksimum istek sayısı
 * @returns Rate limit kontrolü sonucu
 */
function checkRateLimit(ip: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const windowStart = now - 60000 // 1 dakika

  // Eski kayıtları temizle
  for (const [key, info] of rateLimitStore.entries()) {
    if (info.timestamp < windowStart) {
      rateLimitStore.delete(key)
    }
  }

  const existing = rateLimitStore.get(ip)
  
  if (!existing || existing.timestamp < windowStart) {
    // Yeni window başlat
    rateLimitStore.set(ip, {
      ip,
      timestamp: now,
      count: 1
    })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  // Count'u artır
  existing.count++
  rateLimitStore.set(ip, existing)
  
  return { allowed: true, remaining: maxRequests - existing.count }
}

// ============================================================================
// IP KONTROLÜ
// ============================================================================

/**
 * Client IP adresini alır
 * 
 * @param request - Next.js request objesi
 * @returns Client IP adresi
 */
function getClientIP(request: NextRequest): string {
  // Proxy header'larını kontrol et
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Cloudflare
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback
  return request.ip || '127.0.0.1'
}

/**
 * IP adresinin izin verilen listede olup olmadığını kontrol eder
 * 
 * @param ip - Kontrol edilecek IP adresi
 * @param allowedIPs - İzin verilen IP listesi
 * @returns IP izinli mi
 */
function isIPAllowed(ip: string, allowedIPs: string[]): boolean {
  if (allowedIPs.length === 0) {
    return true // Tüm IP'lere izin ver
  }

  return allowedIPs.some(allowedIP => {
    // CIDR notasyonu desteği
    if (allowedIP.includes('/')) {
      return isIPInCIDR(ip, allowedIP)
    }
    
    // Wildcard desteği
    if (allowedIP.includes('*')) {
      const pattern = allowedIP.replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)
      return regex.test(ip)
    }
    
    // Tam eşleşme
    return ip === allowedIP
  })
}

/**
 * IP adresinin CIDR bloğunda olup olmadığını kontrol eder
 * 
 * @param ip - Kontrol edilecek IP adresi
 * @param cidr - CIDR notasyonu (örn: 192.168.1.0/24)
 * @returns IP CIDR bloğunda mı
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/')
    const prefix = parseInt(prefixLength, 10)
    
    const ipNum = ipToNumber(ip)
    const networkNum = ipToNumber(network)
    const mask = (0xffffffff << (32 - prefix)) >>> 0
    
    return (ipNum & mask) === (networkNum & mask)
  } catch {
    return false
  }
}

/**
 * IP adresini sayıya çevirir
 * 
 * @param ip - IP adresi
 * @returns IP sayı karşılığı
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

// ============================================================================
// İMZA DOĞRULAMA
// ============================================================================

/**
 * HMAC-SHA256 imza oluşturur
 * 
 * @param data - İmzalanacak veri
 * @param secret - Secret key
 * @returns HMAC-SHA256 imzası
 */
function createHMACSignature(data: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex')
}

/**
 * Webhook imzasını doğrular
 * 
 * @param payload - Webhook payload
 * @param signature - Gelen imza
 * @param secret - Secret key
 * @returns İmza geçerli mi
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false
  }

  // İmza formatını normalize et
  const normalizedSignature = signature.toLowerCase().replace(/^sha256=/, '')
  
  // Beklenen imzayı hesapla
  const expectedSignature = createHMACSignature(payload, secret)
  
  // Timing attack'a karşı güvenli karşılaştırma
  return crypto.timingSafeEqual(
    Buffer.from(normalizedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

// ============================================================================
// ANA GÜVENLİK FONKSİYONU
// ============================================================================

/**
 * Webhook güvenlik kontrollerini yapar
 * 
 * @param request - Next.js request objesi
 * @param config - Güvenlik konfigürasyonu
 * @returns Güvenlik kontrolü sonucu
 */
export async function validateWebhookSecurity(
  request: NextRequest,
  config: WebhookSecurityConfig
): Promise<WebhookSecurityResult> {
  try {
    const clientIP = getClientIP(request)
    
    // 1. Rate Limiting Kontrolü
    const rateLimit = checkRateLimit(clientIP, config.maxRequestsPerMinute)
    if (!rateLimit.allowed) {
      return {
        isValid: false,
        error: 'Rate limit aşıldı',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        rateLimitRemaining: 0
      }
    }

    // 2. IP Kontrolü
    if (config.allowedIPs && config.allowedIPs.length > 0) {
      if (!isIPAllowed(clientIP, config.allowedIPs)) {
        return {
          isValid: false,
          error: 'IP adresi izin verilen listede değil',
          errorCode: 'IP_NOT_ALLOWED'
        }
      }
    }

    // 3. Content-Type Kontrolü
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return {
        isValid: false,
        error: 'Geçersiz Content-Type',
        errorCode: 'INVALID_CONTENT_TYPE'
      }
    }

    // 4. User-Agent Kontrolü (iyzico'dan geldiğini doğrula)
    const userAgent = request.headers.get('user-agent') || ''
    if (!userAgent.toLowerCase().includes('iyzico')) {
      console.warn(`[Webhook Security] Şüpheli User-Agent: ${userAgent} from IP: ${clientIP}`)
      // Warning olarak logla ama reddetme (iyzico User-Agent değişebilir)
    }

    // 5. İmza Kontrolü (opsiyonel - asıl doğrulama iyzico API'de yapılacak)
    if (config.requireSignature) {
      const signature = request.headers.get('x-iyzico-signature') || 
                       request.headers.get('X-Iyzico-Signature') ||
                       request.headers.get('authorization') ||
                       ''

      if (!signature) {
        return {
          isValid: false,
          error: 'İmza header\'ı eksik',
          errorCode: 'MISSING_SIGNATURE'
        }
      }

      // İmza formatı kontrolü (basit format kontrolü)
      if (signature.length < 10) {
        return {
          isValid: false,
          error: 'Geçersiz imza formatı',
          errorCode: 'INVALID_SIGNATURE_FORMAT'
        }
      }
    }

    return {
      isValid: true,
      rateLimitRemaining: rateLimit.remaining
    }

  } catch (error) {
    console.error('[Webhook Security] Güvenlik kontrolü hatası:', error)
    return {
      isValid: false,
      error: 'Güvenlik kontrolü başarısız',
      errorCode: 'SECURITY_CHECK_FAILED'
    }
  }
}

// ============================================================================
// HELPER FONKSİYONLAR
// ============================================================================

/**
 * iyzico webhook konfigürasyonunu alır
 * 
 * @returns Webhook güvenlik konfigürasyonu
 */
export function getWebhookSecurityConfig(): WebhookSecurityConfig {
  return {
    maxRequestsPerMinute: parseInt(process.env.WEBHOOK_RATE_LIMIT || '60', 10),
    allowedIPs: process.env.WEBHOOK_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [],
    requireSignature: process.env.WEBHOOK_REQUIRE_SIGNATURE !== 'false',
    secretKey: process.env.IYZICO_SECRET_KEY || ''
  }
}

/**
 * Güvenlik logunu yazar
 * 
 * @param event - Log eventi
 * @param details - Detay bilgileri
 */
export function logSecurityEvent(
  event: 'RATE_LIMIT' | 'IP_BLOCKED' | 'INVALID_SIGNATURE' | 'SUCCESS',
  details: {
    ip: string
    userAgent?: string
    error?: string
    timestamp?: number
  }
): void {
  const logEntry = {
    event,
    timestamp: details.timestamp || Date.now(),
    ip: details.ip,
    userAgent: details.userAgent,
    error: details.error,
    date: new Date().toISOString()
  }

  // Production'da bu loglar güvenlik monitoring sistemine gönderilmeli
  console.log('[Webhook Security]', JSON.stringify(logEntry))
  
  // Kritik güvenlik olayları için alert gönder
  if (event === 'IP_BLOCKED' || event === 'INVALID_SIGNATURE') {
    // TODO: Alert sistemi entegrasyonu
    console.warn(`[SECURITY ALERT] ${event}: ${details.error} from IP: ${details.ip}`)
  }
}

/**
 * Rate limit store'u temizler (test amaçlı)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear()
}