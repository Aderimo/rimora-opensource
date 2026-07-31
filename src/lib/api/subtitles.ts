/**
 * Subtitle API - OpenSubtitles Integration
 * 
 * Bu modül altyazı arama ve tercih yönetimi sağlar.
 * - Gerçek OpenSubtitles API entegrasyonu (/api/subtitles/search proxy üzerinden)
 * - Firestore'da tercih kaydetme
 * - Çoklu dil desteği
 * 
 * Requirements: 6.4, 6.5, 6.6
 */

import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Subtitle {
  id: string
  language: string
  languageName: string
  url: string
  format: string
  rating: number
  downloads: number
}

// Altyazı ayarları - Firestore'da saklanacak
export interface SubtitleSettings {
  enabled: boolean
  language: string
  fontSize: 'small' | 'medium' | 'large'
  backgroundColor: string
  textColor: string
}

// Firestore'da saklanacak doküman yapısı
export interface UserSubtitleSettings {
  userId: string
  settings: SubtitleSettings
  updatedAt: Timestamp
}

// API yanıt tipi
interface SubtitleSearchResponse {
  success: boolean
  data: Array<{
    id: string
    language: string
    languageName: string
    downloadUrl: string
    format: string
    rating: number
    downloads: number
    uploadDate: string
  }>
  total: number
  cached: boolean
  message?: string
}

// ============================================================================
// Constants
// ============================================================================

// Desteklenen altyazı dilleri
export const SUBTITLE_LANGUAGES = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
]

// Varsayılan altyazı ayarları
const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true,
  language: 'tr',
  fontSize: 'medium',
  backgroundColor: 'rgba(0,0,0,0.75)',
  textColor: '#ffffff',
}

// Firestore collection adı
const SUBTITLE_SETTINGS_COLLECTION = 'subtitleSettings'

// LocalStorage key (fallback için)
const SUBTITLE_SETTINGS_KEY = 'rimora-subtitle-settings'

// ============================================================================
// Subtitle Search Functions
// ============================================================================

/**
 * Altyazı arar - Gerçek API çağrısı yapar
 * 
 * @param mediaId TMDB media ID
 * @param mediaType Media tipi (movie, tv, anime)
 * @param season Sezon numarası (TV/anime için)
 * @param episode Bölüm numarası (TV/anime için)
 * @param languages Aranacak diller (varsayılan: ['tr', 'en'])
 * @returns Altyazı listesi
 * 
 * Requirements: 6.4 (Altyazı bulunamadığında bilgi mesajı), 6.5 (Birden fazla dil)
 */
export async function getAvailableSubtitles(
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime',
  season?: number,
  episode?: number,
  languages: string[] = ['tr', 'en']
): Promise<Subtitle[]> {
  try {
    // API proxy endpoint'ine istek yap
    const response = await fetch('/api/subtitles/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tmdbId: mediaId,
        languages,
        season: mediaType !== 'movie' ? season : undefined,
        episode: mediaType !== 'movie' ? episode : undefined,
      }),
    })

    if (!response.ok) {
      // Rate limit hatası
      if (response.status === 429) {
        const data = await response.json()
        console.warn('Altyazı API rate limit:', data.message)
        return []
      }
      
      // Diğer hatalar
      console.error('Altyazı arama hatası:', response.status)
      return []
    }

    const data: SubtitleSearchResponse = await response.json()

    // Başarılı yanıt
    if (data.success && data.data) {
      // API yanıtını Subtitle formatına dönüştür
      return data.data.map(sub => ({
        id: sub.id,
        language: sub.language,
        languageName: sub.languageName,
        url: sub.downloadUrl,
        format: sub.format,
        rating: sub.rating,
        downloads: sub.downloads,
      }))
    }

    // Altyazı bulunamadı - Requirement 6.4
    return []
  } catch (error) {
    console.error('Altyazı arama hatası:', error)
    return []
  }
}

/**
 * Senkron altyazı arama (eski API uyumluluğu için)
 * Video player'da kullanılıyor, async versiyonu tercih edilmeli
 * 
 * @deprecated getAvailableSubtitlesAsync kullanın
 */
export function getAvailableSubtitlesSync(
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime',
  season?: number,
  episode?: number
): Subtitle[] {
  // Eski senkron API için boş dizi döndür
  // Video player async versiyonu kullanmalı
  console.warn('getAvailableSubtitlesSync deprecated, use getAvailableSubtitles instead')
  return []
}

// ============================================================================
// Subtitle Settings Functions - Firestore Integration
// ============================================================================

/**
 * Kullanıcının altyazı tercihlerini Firestore'dan alır
 * Giriş yapmamış kullanıcılar için localStorage kullanır
 * 
 * @param userId Kullanıcı ID (opsiyonel)
 * @returns Altyazı ayarları
 * 
 * Requirements: 6.6 (Tercih kaydetme)
 */
export async function getSubtitleSettingsAsync(userId?: string): Promise<SubtitleSettings> {
  // Kullanıcı giriş yapmışsa Firestore'dan al
  if (userId) {
    try {
      const settingsRef = doc(db, SUBTITLE_SETTINGS_COLLECTION, userId)
      const settingsDoc = await getDoc(settingsRef)

      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as UserSubtitleSettings
        return { ...DEFAULT_SUBTITLE_SETTINGS, ...data.settings }
      }
    } catch (error) {
      console.error('Firestore altyazı ayarları okuma hatası:', error)
    }
  }

  // Fallback: localStorage'dan al
  return getSubtitleSettingsFromLocalStorage()
}

/**
 * Kullanıcının altyazı tercihlerini Firestore'a kaydeder
 * Giriş yapmamış kullanıcılar için localStorage kullanır
 * 
 * @param settings Altyazı ayarları
 * @param userId Kullanıcı ID (opsiyonel)
 * 
 * Requirements: 6.6 (Tercih kaydetme)
 */
export async function saveSubtitleSettingsAsync(
  settings: SubtitleSettings,
  userId?: string
): Promise<void> {
  // Her zaman localStorage'a da kaydet (offline fallback)
  saveSubtitleSettingsToLocalStorage(settings)

  // Kullanıcı giriş yapmışsa Firestore'a da kaydet
  if (userId) {
    try {
      const settingsRef = doc(db, SUBTITLE_SETTINGS_COLLECTION, userId)
      const userSettings: UserSubtitleSettings = {
        userId,
        settings,
        updatedAt: Timestamp.now(),
      }
      await setDoc(settingsRef, userSettings, { merge: true })
    } catch (error) {
      console.error('Firestore altyazı ayarları kaydetme hatası:', error)
    }
  }
}

/**
 * Altyazı dil tercihini kaydeder
 * 
 * @param language Dil kodu (örn: 'tr', 'en')
 * @param userId Kullanıcı ID (opsiyonel)
 * 
 * Requirements: 6.6 (Tercih kaydetme)
 */
export async function saveSubtitleLanguagePreference(
  language: string,
  userId?: string
): Promise<void> {
  const currentSettings = await getSubtitleSettingsAsync(userId)
  const newSettings = { ...currentSettings, language }
  await saveSubtitleSettingsAsync(newSettings, userId)
}

// ============================================================================
// LocalStorage Functions (Fallback & Sync API)
// ============================================================================

/**
 * Altyazı ayarlarını localStorage'dan alır (senkron)
 * Giriş yapmamış kullanıcılar veya hızlı erişim için
 */
export function getSubtitleSettings(): SubtitleSettings {
  return getSubtitleSettingsFromLocalStorage()
}

/**
 * Altyazı ayarlarını localStorage'a kaydeder (senkron)
 * Giriş yapmamış kullanıcılar veya hızlı erişim için
 */
export function saveSubtitleSettings(settings: SubtitleSettings): void {
  saveSubtitleSettingsToLocalStorage(settings)
}

/**
 * LocalStorage'dan altyazı ayarlarını okur
 */
function getSubtitleSettingsFromLocalStorage(): SubtitleSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SUBTITLE_SETTINGS
  }

  try {
    const stored = localStorage.getItem(SUBTITLE_SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_SUBTITLE_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error('LocalStorage altyazı ayarları okuma hatası:', error)
  }

  return DEFAULT_SUBTITLE_SETTINGS
}

/**
 * LocalStorage'a altyazı ayarlarını yazar
 */
function saveSubtitleSettingsToLocalStorage(settings: SubtitleSettings): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(SUBTITLE_SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('LocalStorage altyazı ayarları kaydetme hatası:', error)
  }
}

// ============================================================================
// Migration Function
// ============================================================================

/**
 * LocalStorage'daki altyazı tercihlerini Firestore'a taşır
 * Kullanıcı giriş yaptığında çağrılmalı
 * 
 * @param userId Kullanıcı ID
 */
export async function migrateSubtitleSettingsToFirestore(userId: string): Promise<void> {
  try {
    // Firestore'da zaten kayıt var mı kontrol et
    const settingsRef = doc(db, SUBTITLE_SETTINGS_COLLECTION, userId)
    const settingsDoc = await getDoc(settingsRef)

    if (!settingsDoc.exists()) {
      // LocalStorage'dan al ve Firestore'a kaydet
      const localSettings = getSubtitleSettingsFromLocalStorage()
      await saveSubtitleSettingsAsync(localSettings, userId)
      console.log('Altyazı tercihleri Firestore\'a taşındı')
    }
  } catch (error) {
    console.error('Altyazı tercihleri migration hatası:', error)
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Dil kodundan dil adını döndürür
 */
export function getLanguageName(code: string): string {
  const language = SUBTITLE_LANGUAGES.find(l => l.code === code)
  return language?.name || code.toUpperCase()
}

/**
 * Altyazı bulunamadı mesajını döndürür
 * Requirement 6.4
 */
export function getNoSubtitlesMessage(language?: string): string {
  if (language) {
    const langName = getLanguageName(language)
    return `${langName} dilinde altyazı bulunamadı. Başka bir dil seçmeyi deneyin.`
  }
  return 'Bu içerik için altyazı bulunamadı.'
}
