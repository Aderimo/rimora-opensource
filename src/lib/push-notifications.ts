import { db, getFCMToken, getMessagingInstance } from './firebase'
import { doc, setDoc, deleteDoc, collection, query, where, getDocs, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'

export interface PushSubscription {
  userId: string
  token: string
  createdAt: Date
  device: string
  browser: string
}

// Design doc'a göre FCMToken interface
export interface FCMToken {
  token: string
  device: string
  browser: string
  createdAt: Timestamp
  lastUsed: Timestamp
}

export interface NotificationPreferences {
  newEpisodes: boolean
  newMovies: boolean
  friendActivity: boolean
  comments: boolean
  messages: boolean
  watchPartyInvites: boolean
  // Extended preferences
  emailNotifications?: boolean
  systemNotifications?: boolean
  followerNotifications?: boolean
}

// Design doc'a göre UserNotificationSettings interface
export interface UserNotificationSettings {
  userId: string
  preferences: NotificationPreferences
  fcmTokens: FCMToken[]
  updatedAt: Timestamp
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  newEpisodes: true,
  newMovies: true,
  friendActivity: true,
  comments: true,
  messages: true,
  watchPartyInvites: true,
  emailNotifications: true,
  systemNotifications: true,
  followerNotifications: true,
}

// Token refresh callback'lerini saklamak için
let tokenRefreshUnsubscribe: (() => void) | null = null

// Bildirim izni iste ve token kaydet
export async function subscribeToPushNotifications(userId: string): Promise<boolean> {
  try {
    const token = await getFCMToken()
    if (!token) return false
    
    // Token'ı Firestore'a kaydet (notificationSettings collection'ına)
    await saveTokenToFirestore(userId, token)
    
    // Token refresh listener'ı başlat
    setupTokenRefreshListener(userId)
    
    // Eski pushSubscriptions collection'ına da kaydet (geriye uyumluluk)
    const subscriptionRef = doc(db, 'pushSubscriptions', `${userId}_${token.slice(-10)}`)
    await setDoc(subscriptionRef, {
      userId,
      token,
      createdAt: new Date(),
      device: getDeviceInfo(),
      browser: getBrowserInfo(),
    })
    
    return true
  } catch (error) {
    console.error('Push subscription error:', error)
    return false
  }
}

// FCM token'ının geçerli olup olmadığını kontrol et
export async function validateToken(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length < 10) {
    return false
  }
  
  // FCM token formatı kontrolü (base64 karakterler ve uzunluk)
  const fcmTokenRegex = /^[A-Za-z0-9_-]+$/
  if (!fcmTokenRegex.test(token)) {
    return false
  }
  
  // Token uzunluğu kontrolü (FCM token'ları genellikle 152+ karakter)
  if (token.length < 100) {
    return false
  }
  
  return true
}

// Kullanıcının aktif token sayısını kontrol et ve sınırla (maksimum 10 token)
async function limitUserTokens(userId: string): Promise<void> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (!settingsDoc.exists()) return
    
    const data = settingsDoc.data() as UserNotificationSettings
    const tokens = data.fcmTokens || []
    
    // Maksimum 10 token'a sınırla
    if (tokens.length > 10) {
      // En eski token'ları kaldır (lastUsed'a göre sırala)
      const sortedTokens = tokens.sort((a, b) => {
        const aTime = (a.lastUsed || a.createdAt).toMillis()
        const bTime = (b.lastUsed || b.createdAt).toMillis()
        return bTime - aTime // En yeni önce
      })
      
      const limitedTokens = sortedTokens.slice(0, 10)
      
      console.log(`Limiting FCM tokens for user ${userId}: ${tokens.length} -> ${limitedTokens.length}`)
      
      await updateDoc(settingsRef, {
        fcmTokens: limitedTokens,
        updatedAt: Timestamp.now(),
      })
    }
  } catch (error) {
    console.error('Error limiting user tokens:', error)
  }
}

// Token'ı Firestore notificationSettings collection'ına kaydet
async function saveTokenToFirestore(userId: string, token: string): Promise<void> {
  // Token validation
  if (!await validateToken(token)) {
    console.error('Invalid FCM token format:', token.substring(0, 20) + '...')
    throw new Error('Invalid FCM token format')
  }
  
  const settingsRef = doc(db, 'notificationSettings', userId)
  const now = Timestamp.now()
  
  const newToken: FCMToken = {
    token,
    device: getDeviceInfo(),
    browser: getBrowserInfo(),
    createdAt: now,
    lastUsed: now,
  }
  
  try {
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as UserNotificationSettings
      const existingTokens = data.fcmTokens || []
      
      // Aynı token zaten varsa, lastUsed'ı güncelle
      const existingTokenIndex = existingTokens.findIndex(t => t.token === token)
      
      if (existingTokenIndex >= 0) {
        // Token zaten var, lastUsed'ı güncelle
        const updatedTokens = [...existingTokens]
        updatedTokens[existingTokenIndex] = {
          ...updatedTokens[existingTokenIndex],
          lastUsed: now,
          device: getDeviceInfo(), // Cihaz bilgisini de güncelle
          browser: getBrowserInfo(), // Tarayıcı bilgisini de güncelle
        }
        
        await updateDoc(settingsRef, {
          fcmTokens: updatedTokens,
          updatedAt: now,
        })
      } else {
        // Yeni token ekle
        await updateDoc(settingsRef, {
          fcmTokens: arrayUnion(newToken),
          updatedAt: now,
        })
        
        // Token sayısını sınırla
        await limitUserTokens(userId)
      }
    } else {
      // Yeni doküman oluştur
      const newSettings: UserNotificationSettings = {
        userId,
        preferences: DEFAULT_PREFERENCES,
        fcmTokens: [newToken],
        updatedAt: now,
      }
      
      await setDoc(settingsRef, newSettings)
    }
    
    console.log('FCM token successfully saved to Firestore')
  } catch (error) {
    console.error('Error saving token to Firestore:', error)
    throw error
  }
}

// Token refresh handler - FCM token yenilendiğinde çağrılır
export function setupTokenRefreshListener(userId: string): void {
  if (typeof window === 'undefined') return
  
  // Önceki listener'ı temizle
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe()
    tokenRefreshUnsubscribe = null
  }
  
  const messagingInstance = getMessagingInstance()
  if (!messagingInstance) return
  
  // Service worker'dan token refresh mesajı dinle
  if ('serviceWorker' in navigator) {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'FCM_TOKEN_REFRESH') {
        console.log('FCM token refresh mesajı alındı, yeni token alınıyor...')
        try {
          // Service worker'dan token geldi mi kontrol et
          const newToken = event.data.token || await getFCMToken()
          if (newToken) {
            await handleTokenRefresh(userId, newToken)
          }
        } catch (error) {
          console.error('Token refresh işlemi sırasında hata:', error)
        }
      }
    }
    
    navigator.serviceWorker.addEventListener('message', handleMessage)
    
    // Cleanup fonksiyonu
    tokenRefreshUnsubscribe = () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }
  
  // Periyodik token kontrolü ve eski token temizleme (her 6 saatte bir)
  const maintenanceInterval = setInterval(async () => {
    try {
      const currentToken = await getFCMToken()
      if (currentToken) {
        // Token'ı Firestore'a kaydet (lastUsed güncellenir)
        await saveTokenToFirestore(userId, currentToken)
        
        // Eski token'ları temizle (30 günden eski)
        await cleanupOldTokens(userId)
      }
    } catch (error) {
      console.error('Token maintenance error:', error)
    }
  }, 6 * 60 * 60 * 1000) // 6 saat
  
  // Cleanup fonksiyonunu güncelle
  const originalUnsubscribe = tokenRefreshUnsubscribe
  tokenRefreshUnsubscribe = () => {
    clearInterval(maintenanceInterval)
    if (originalUnsubscribe) {
      originalUnsubscribe()
    }
  }
}

// Eski token'ları temizle (30 günden eski token'ları kaldır)
async function cleanupOldTokens(userId: string): Promise<void> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (!settingsDoc.exists()) return
    
    const data = settingsDoc.data() as UserNotificationSettings
    const tokens = data.fcmTokens || []
    
    if (tokens.length === 0) return
    
    // 30 gün öncesinin timestamp'i
    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    
    // Aktif token'ları filtrele (30 günden yeni olanlar)
    const activeTokens = tokens.filter(token => {
      // lastUsed yoksa createdAt'e bak
      const lastActivity = token.lastUsed || token.createdAt
      return lastActivity && lastActivity.toMillis() > thirtyDaysAgo.toMillis()
    })
    
    // Eğer temizleme yapıldıysa güncelle
    if (activeTokens.length !== tokens.length) {
      console.log(`Cleaning up ${tokens.length - activeTokens.length} old FCM tokens for user ${userId}`)
      
      await updateDoc(settingsRef, {
        fcmTokens: activeTokens,
        updatedAt: Timestamp.now(),
      })
    }
  } catch (error) {
    console.error('Error cleaning up old tokens:', error)
  }
}

// Token refresh olduğunda çağrılır
async function handleTokenRefresh(userId: string, newToken: string): Promise<void> {
  try {
    await saveTokenToFirestore(userId, newToken)
    console.log('New FCM token saved to Firestore')
  } catch (error) {
    console.error('Error handling token refresh:', error)
  }
}

// Eski token'ı kaldır ve yenisini ekle
export async function refreshToken(userId: string, oldToken: string, newToken: string): Promise<void> {
  // Yeni token validation
  if (!await validateToken(newToken)) {
    console.error('Invalid new FCM token format:', newToken.substring(0, 20) + '...')
    throw new Error('Invalid new FCM token format')
  }
  
  const settingsRef = doc(db, 'notificationSettings', userId)
  const now = Timestamp.now()
  
  try {
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as UserNotificationSettings
      const existingTokens = data.fcmTokens || []
      
      // Eski token'ı bul ve kaldır
      const filteredTokens = existingTokens.filter(t => t.token !== oldToken)
      
      // Yeni token zaten var mı kontrol et
      const newTokenExists = filteredTokens.some(t => t.token === newToken)
      
      if (!newTokenExists) {
        // Yeni token'ı ekle
        const newTokenObj: FCMToken = {
          token: newToken,
          device: getDeviceInfo(),
          browser: getBrowserInfo(),
          createdAt: now,
          lastUsed: now,
        }
        
        filteredTokens.push(newTokenObj)
      } else {
        // Yeni token zaten varsa sadece lastUsed'ı güncelle
        const tokenIndex = filteredTokens.findIndex(t => t.token === newToken)
        if (tokenIndex >= 0) {
          filteredTokens[tokenIndex] = {
            ...filteredTokens[tokenIndex],
            lastUsed: now,
            device: getDeviceInfo(),
            browser: getBrowserInfo(),
          }
        }
      }
      
      await updateDoc(settingsRef, {
        fcmTokens: filteredTokens,
        updatedAt: now,
      })
      
      // Token sayısını sınırla
      await limitUserTokens(userId)
      
      console.log('FCM token successfully refreshed')
    } else {
      // Doküman yoksa yeni oluştur
      await saveTokenToFirestore(userId, newToken)
    }
  } catch (error) {
    console.error('Error refreshing token:', error)
    throw error
  }
}

// Token refresh listener'ı durdur
export function stopTokenRefreshListener(): void {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe()
    tokenRefreshUnsubscribe = null
  }
}

// Bildirim aboneliğini iptal et
export async function unsubscribeFromPushNotifications(userId: string): Promise<void> {
  try {
    // Token refresh listener'ı durdur
    stopTokenRefreshListener()
    
    // notificationSettings'den token'ları temizle
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      await updateDoc(settingsRef, {
        fcmTokens: [],
        updatedAt: Timestamp.now(),
      })
    }
    
    // Eski pushSubscriptions collection'ından da sil (geriye uyumluluk)
    const subscriptionsRef = collection(db, 'pushSubscriptions')
    const q = query(subscriptionsRef, where('userId', '==', userId))
    const snapshot = await getDocs(q)
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
    await Promise.all(deletePromises)
  } catch (error) {
    console.error('Push unsubscription error:', error)
  }
}

// Bildirim tercihlerini Firestore'dan al
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as UserNotificationSettings
      return { ...DEFAULT_PREFERENCES, ...data.preferences }
    }
    
    // Firestore'da yoksa localStorage'dan migration yap
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`notification-prefs-${userId}`)
      if (stored) {
        const prefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
        // Firestore'a kaydet (migration)
        await saveNotificationPreferences(userId, prefs)
        // localStorage'dan sil
        localStorage.removeItem(`notification-prefs-${userId}`)
        return prefs
      }
    }
    
    return DEFAULT_PREFERENCES
  } catch (error) {
    console.error('Error getting notification preferences:', error)
    // Hata durumunda localStorage'dan oku (fallback)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`notification-prefs-${userId}`)
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
      }
    }
    return DEFAULT_PREFERENCES
  }
}

// Bildirim tercihlerini Firestore'a kaydet
export async function saveNotificationPreferences(
  userId: string, 
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    const now = Timestamp.now()
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as UserNotificationSettings
      const updatedPreferences = { ...data.preferences, ...preferences }
      
      await updateDoc(settingsRef, {
        preferences: updatedPreferences,
        updatedAt: now,
      })
    } else {
      // Yeni doküman oluştur
      const newSettings: UserNotificationSettings = {
        userId,
        preferences: { ...DEFAULT_PREFERENCES, ...preferences },
        fcmTokens: [],
        updatedAt: now,
      }
      
      await setDoc(settingsRef, newSettings)
    }
  } catch (error) {
    console.error('Error saving notification preferences:', error)
    // Hata durumunda localStorage'a kaydet (fallback)
    if (typeof window !== 'undefined') {
      const current = await getNotificationPreferences(userId)
      const updated = { ...current, ...preferences }
      localStorage.setItem(`notification-prefs-${userId}`, JSON.stringify(updated))
    }
  }
}

// Kullanıcının FCM token'larını getir
export async function getUserFCMTokens(userId: string): Promise<FCMToken[]> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as UserNotificationSettings
      return data.fcmTokens || []
    }
    
    return []
  } catch (error) {
    console.error('Error getting FCM tokens:', error)
    return []
  }
}

// Belirli bir token'ı kaldır
export async function removeToken(userId: string, token: string): Promise<void> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as UserNotificationSettings
      const filteredTokens = (data.fcmTokens || []).filter(t => t.token !== token)
      
      await updateDoc(settingsRef, {
        fcmTokens: filteredTokens,
        updatedAt: Timestamp.now(),
      })
      
      console.log('FCM token successfully removed')
    }
  } catch (error) {
    console.error('Error removing token:', error)
  }
}

// Kullanıcının tüm token'larını temizle (logout sırasında kullanılabilir)
export async function clearAllUserTokens(userId: string): Promise<void> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId)
    const settingsDoc = await getDoc(settingsRef)
    
    if (settingsDoc.exists()) {
      await updateDoc(settingsRef, {
        fcmTokens: [],
        updatedAt: Timestamp.now(),
      })
      
      console.log('All FCM tokens cleared for user')
    }
  } catch (error) {
    console.error('Error clearing all tokens:', error)
  }
}

// Token'ın aktif olup olmadığını kontrol et (son 7 gün içinde kullanılmış mı)
export async function isTokenActive(userId: string, token: string): Promise<boolean> {
  try {
    const tokens = await getUserFCMTokens(userId)
    const targetToken = tokens.find(t => t.token === token)
    
    if (!targetToken) return false
    
    // Son 7 gün içinde kullanılmış mı kontrol et
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const lastActivity = targetToken.lastUsed || targetToken.createdAt
    
    return lastActivity.toDate() > sevenDaysAgo
  } catch (error) {
    console.error('Error checking token activity:', error)
    return false
  }
}

// Kullanıcının aktif token sayısını getir
export async function getActiveTokenCount(userId: string): Promise<number> {
  try {
    const tokens = await getUserFCMTokens(userId)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    return tokens.filter(token => {
      const lastActivity = token.lastUsed || token.createdAt
      return lastActivity.toDate() > sevenDaysAgo
    }).length
  } catch (error) {
    console.error('Error getting active token count:', error)
    return 0
  }
}

// İçerik aboneliği (yeni bölüm bildirimi için)
export async function subscribeToContent(
  userId: string,
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime',
  mediaTitle: string
): Promise<void> {
  const subscriptionRef = doc(db, 'contentSubscriptions', `${userId}_${mediaType}_${mediaId}`)
  await setDoc(subscriptionRef, {
    userId,
    mediaId,
    mediaType,
    mediaTitle,
    subscribedAt: new Date(),
  })
}

// İçerik aboneliğini iptal et
export async function unsubscribeFromContent(
  userId: string,
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime'
): Promise<void> {
  const subscriptionRef = doc(db, 'contentSubscriptions', `${userId}_${mediaType}_${mediaId}`)
  await deleteDoc(subscriptionRef)
}

// Kullanıcının abone olduğu içerikleri getir
export async function getUserContentSubscriptions(userId: string): Promise<any[]> {
  try {
    const subscriptionsRef = collection(db, 'contentSubscriptions')
    const q = query(subscriptionsRef, where('userId', '==', userId))
    const snapshot = await getDocs(q)
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting subscriptions:', error)
    return []
  }
}

// Cihaz bilgisi
function getDeviceInfo(): string {
  if (typeof window === 'undefined') return 'unknown'
  
  const ua = navigator.userAgent
  if (/mobile/i.test(ua)) return 'mobile'
  if (/tablet/i.test(ua)) return 'tablet'
  return 'desktop'
}

// Tarayıcı bilgisi
function getBrowserInfo(): string {
  if (typeof window === 'undefined') return 'unknown'
  
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Other'
}
