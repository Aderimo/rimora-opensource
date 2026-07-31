/**
 * Admin Yetki Kontrolü Middleware
 * 
 * Bu middleware, admin panel sayfalarına erişim kontrolü sağlar.
 * Role-based access control (RBAC) sistemi ile entegre çalışır.
 */

import { getUserRole, hasPermission, type UserRole, ROLE_RESTRICTIONS } from '@/lib/roles'

export interface AdminAuthResult {
  authorized: boolean
  role: UserRole
  userId: string
  email: string | null
  reason?: string
}

/**
 * Kullanıcının admin paneline erişim yetkisini kontrol eder
 * NOT: Bu fonksiyon client-side'da çalışmaz, sadece server-side'da kullanılmalıdır
 * @param userId - Kullanıcı ID'si
 * @param email - Kullanıcı email'i
 * @param requiredRole - Minimum gerekli rol seviyesi
 * @returns AdminAuthResult - Yetkilendirme sonucu
 */
export async function checkAdminAuth(
  userId: string,
  email: string | null,
  requiredRole: UserRole = 'moderator'
): Promise<AdminAuthResult> {
  // Kullanıcı giriş yapmamış
  if (!userId) {
    return {
      authorized: false,
      role: 'user',
      userId: '',
      email: null,
      reason: 'Giriş yapmanız gerekiyor'
    }
  }

  // Kullanıcının rolünü al
  const userRole = await getUserRole(userId, email || undefined)

  // Yetki kontrolü
  const hasAccess = hasPermission(userRole, requiredRole)

  if (!hasAccess) {
    return {
      authorized: false,
      role: userRole,
      userId,
      email,
      reason: `Bu sayfaya erişim için en az ${requiredRole} yetkisi gerekiyor`
    }
  }

  return {
    authorized: true,
    role: userRole,
    userId,
    email
  }
}

/**
 * Belirli bir işlem için yetki kontrolü yapar
 * @param role - Kullanıcının rolü
 * @param permission - Kontrol edilecek izin
 * @returns boolean - İzin var mı?
 */
export function checkPermission(
  role: UserRole,
  permission: keyof typeof ROLE_RESTRICTIONS.founder
): boolean {
  return ROLE_RESTRICTIONS[role][permission]
}

/**
 * API route'ları için admin yetki kontrolü
 * NOT: Bu fonksiyon Next.js API route'larında kullanılmalıdır
 * @param userId - Kullanıcı ID'si
 * @param email - Kullanıcı email'i
 * @param requiredRole - Minimum gerekli rol
 * @returns AdminAuthResult veya Response (yetkisiz erişim durumunda)
 */
export async function requireAdminAuth(
  userId: string,
  email: string | null,
  requiredRole: UserRole = 'moderator'
): Promise<AdminAuthResult | Response> {
  const authResult = await checkAdminAuth(userId, email, requiredRole)

  if (!authResult.authorized) {
    return new Response(
      JSON.stringify({
        error: 'Yetkisiz erişim',
        reason: authResult.reason
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return authResult
}

/**
 * Kullanıcının belirli bir kaynağa erişim yetkisi var mı kontrol eder
 * @param userRole - Kullanıcının rolü
 * @param resourceOwnerId - Kaynağın sahibinin ID'si
 * @param currentUserId - Mevcut kullanıcının ID'si
 * @returns boolean - Erişim yetkisi var mı?
 */
export function canAccessResource(
  userRole: UserRole,
  resourceOwnerId: string,
  currentUserId: string
): boolean {
  // Kendi kaynağına her zaman erişebilir
  if (resourceOwnerId === currentUserId) {
    return true
  }

  // Admin ve üstü roller tüm kaynaklara erişebilir
  return hasPermission(userRole, 'admin')
}

/**
 * Kullanıcının başka bir kullanıcıyı yönetme yetkisi var mı kontrol eder
 * @param managerRole - Yönetici rolü
 * @param targetRole - Hedef kullanıcının rolü
 * @returns boolean - Yönetme yetkisi var mı?
 */
export function canManageUser(managerRole: UserRole, targetRole: UserRole): boolean {
  // Founder herkes yönetebilir
  if (managerRole === 'founder') {
    return true
  }

  // Admin, moderator ve user'ları yönetebilir (ama başka admin'leri yönetemez)
  if (managerRole === 'admin') {
    return targetRole !== 'founder' && targetRole !== 'admin'
  }

  // Moderator sadece user'ları yönetebilir
  if (managerRole === 'moderator') {
    return targetRole === 'user'
  }

  return false
}

/**
 * Rate limiting için kullanıcı aktivitesini kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param action - Yapılan işlem
 * @param maxAttempts - Maksimum deneme sayısı
 * @param windowMs - Zaman penceresi (milisaniye)
 * @returns boolean - Rate limit aşıldı mı?
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  userId: string,
  action: string,
  maxAttempts: number = 10,
  windowMs: number = 60000 // 1 dakika
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${userId}:${action}`
  const now = Date.now()
  const record = rateLimitStore.get(key)

  // Kayıt yoksa veya süresi dolmuşsa yeni kayıt oluştur
  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs
    })
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: now + windowMs
    }
  }

  // Rate limit aşıldı mı?
  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt
    }
  }

  // Sayacı artır
  record.count++
  rateLimitStore.set(key, record)

  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetAt: record.resetAt
  }
}

/**
 * Temizlik işlemi - Eski rate limit kayıtlarını siler
 * Not: Bu fonksiyon sadece runtime'da çalışmalı, build sırasında değil
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, record] of entries) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Sadece browser/server runtime'da çalıştır, build sırasında değil
if (typeof window !== 'undefined' || typeof process !== 'undefined') {
  // Her dakika temizlik yap
  if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimitStore, 60000)
  }
}
