/**
 * Session Management & Login History
 * Aktif oturumları yönetme ve giriş geçmişi
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface Session {
  id: string
  userId: string
  deviceInfo: DeviceInfo
  location: LocationInfo
  ipAddress: string
  createdAt: Date
  lastActivityAt: Date
  expiresAt: Date
  isCurrentSession: boolean
  isTrusted: boolean
}

export interface DeviceInfo {
  browser: string
  os: string
  device: string
  userAgent: string
}

export interface LocationInfo {
  country?: string
  city?: string
  region?: string
  timezone?: string
  coordinates?: {
    latitude: number
    longitude: number
  }
}

export interface LoginHistory {
  id: string
  userId: string
  timestamp: Date
  deviceInfo: DeviceInfo
  location: LocationInfo
  ipAddress: string
  success: boolean
  failureReason?: string
  suspicious: boolean
}

/**
 * Yeni session oluştur
 */
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  ipAddress: string,
  isTrusted: boolean = false
): Promise<string> {
  try {
    const sessionId = generateSessionId()
    const location = await getLocationFromIP(ipAddress)

    const session: Session = {
      id: sessionId,
      userId,
      deviceInfo,
      location,
      ipAddress,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün
      isCurrentSession: true,
      isTrusted,
    }

    await setDoc(doc(db, 'sessions', sessionId), session)

    // Login history'ye ekle
    await addLoginHistory(userId, deviceInfo, location, ipAddress, true)

    return sessionId
  } catch (error) {
    console.error('Session oluşturma hatası:', error)
    throw new Error('Session oluşturulamadı')
  }
}

/**
 * Session'ı güncelle
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'sessions', sessionId),
      {
        lastActivityAt: new Date(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Session güncelleme hatası:', error)
  }
}

/**
 * Session'ı sonlandır
 */
export async function terminateSession(sessionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'sessions', sessionId))
  } catch (error) {
    console.error('Session sonlandırma hatası:', error)
    throw new Error('Session sonlandırılamadı')
  }
}

/**
 * Kullanıcının tüm session'larını getir
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  try {
    const sessionsRef = collection(db, 'sessions')
    const q = query(
      sessionsRef,
      where('userId', '==', userId),
      orderBy('lastActivityAt', 'desc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => doc.data() as Session)
  } catch (error) {
    console.error('Session getirme hatası:', error)
    return []
  }
}

/**
 * Diğer tüm session'ları sonlandır
 */
export async function terminateOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<void> {
  try {
    const sessions = await getUserSessions(userId)

    const promises = sessions
      .filter((s) => s.id !== currentSessionId)
      .map((s) => terminateSession(s.id))

    await Promise.all(promises)
  } catch (error) {
    console.error('Diğer session\'ları sonlandırma hatası:', error)
    throw new Error('Session\'lar sonlandırılamadı')
  }
}

/**
 * Login history'ye ekle
 */
export async function addLoginHistory(
  userId: string,
  deviceInfo: DeviceInfo,
  location: LocationInfo,
  ipAddress: string,
  success: boolean,
  failureReason?: string
): Promise<void> {
  try {
    const historyId = `${userId}_${Date.now()}`
    
    // Suspicious activity kontrolü
    const suspicious = await detectSuspiciousActivity(
      userId,
      location,
      ipAddress
    )

    const history: LoginHistory = {
      id: historyId,
      userId,
      timestamp: new Date(),
      deviceInfo,
      location,
      ipAddress,
      success,
      failureReason,
      suspicious,
    }

    await setDoc(doc(db, 'loginHistory', historyId), history)

    // Suspicious ise bildirim gönder
    if (suspicious && success) {
      await notifySuspiciousLogin(userId, history)
    }
  } catch (error) {
    console.error('Login history ekleme hatası:', error)
  }
}

/**
 * Login history'yi getir
 */
export async function getLoginHistory(
  userId: string,
  limitCount: number = 50
): Promise<LoginHistory[]> {
  try {
    const historyRef = collection(db, 'loginHistory')
    const q = query(
      historyRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => doc.data() as LoginHistory)
  } catch (error) {
    console.error('Login history getirme hatası:', error)
    return []
  }
}

/**
 * Şüpheli aktivite tespit et
 */
async function detectSuspiciousActivity(
  userId: string,
  location: LocationInfo,
  ipAddress: string
): Promise<boolean> {
  try {
    // Son 24 saatteki login'leri kontrol et
    const recentLogins = await getRecentLogins(userId, 24)

    if (recentLogins.length === 0) return false

    // Farklı ülkeden giriş
    const lastLocation = recentLogins[0].location
    if (
      lastLocation.country &&
      location.country &&
      lastLocation.country !== location.country
    ) {
      return true
    }

    // Çok farklı IP adresi
    const uniqueIPs = new Set(recentLogins.map((l) => l.ipAddress))
    if (uniqueIPs.size > 5) {
      return true
    }

    // Çok fazla başarısız deneme
    const failedAttempts = recentLogins.filter((l) => !l.success).length
    if (failedAttempts > 3) {
      return true
    }

    return false
  } catch (error) {
    console.error('Suspicious activity tespit hatası:', error)
    return false
  }
}

/**
 * Son X saatteki login'leri getir
 */
async function getRecentLogins(
  userId: string,
  hours: number
): Promise<LoginHistory[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)
    const historyRef = collection(db, 'loginHistory')
    const q = query(
      historyRef,
      where('userId', '==', userId),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'desc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => doc.data() as LoginHistory)
  } catch (error) {
    console.error('Recent logins getirme hatası:', error)
    return []
  }
}

/**
 * Şüpheli login bildirimi gönder
 */
async function notifySuspiciousLogin(
  userId: string,
  history: LoginHistory
): Promise<void> {
  // TODO: Push notification veya email gönder
  console.warn('Suspicious login detected:', history)
}

/**
 * IP adresinden lokasyon bilgisi al
 */
async function getLocationFromIP(ipAddress: string): Promise<LocationInfo> {
  try {
    // ipapi.co veya benzer bir servis kullanılabilir
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`)
    const data = await response.json()

    return {
      country: data.country_name,
      city: data.city,
      region: data.region,
      timezone: data.timezone,
      coordinates: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
    }
  } catch (error) {
    console.error('IP lokasyon getirme hatası:', error)
    return {}
  }
}

/**
 * Cihaz bilgisini al
 */
export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent

  return {
    browser: getBrowser(ua),
    os: getOS(ua),
    device: getDevice(ua),
    userAgent: ua,
  }
}

function getBrowser(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  if (ua.includes('Opera')) return 'Opera'
  return 'Bilinmeyen'
}

function getOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS')) return 'iOS'
  return 'Bilinmeyen'
}

function getDevice(ua: string): string {
  if (/Mobile|Android|iPhone|iPad/.test(ua)) return 'Mobil'
  if (/Tablet|iPad/.test(ua)) return 'Tablet'
  return 'Masaüstü'
}

/**
 * Session ID oluştur
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Session'ın geçerli olup olmadığını kontrol et
 */
export function isSessionValid(session: Session): boolean {
  return new Date() < session.expiresAt
}
