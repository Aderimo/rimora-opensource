import { db } from './firebase'
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore'

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  category: 'watching' | 'social' | 'special' | 'achievement'
  requirement: number
  earnedAt?: Date
}

// Rozet kazanma callback tipi
type BadgeEarnedCallback = (badge: Omit<Badge, 'earnedAt'>) => void

// Global callback listesi
let badgeEarnedCallbacks: BadgeEarnedCallback[] = []

// Callback kayıt fonksiyonu
export function onBadgeEarned(callback: BadgeEarnedCallback): () => void {
  badgeEarnedCallbacks.push(callback)
  // Unsubscribe fonksiyonu döndür
  return () => {
    badgeEarnedCallbacks = badgeEarnedCallbacks.filter(cb => cb !== callback)
  }
}

// Rozet kazanıldığında bildirimi tetikle
function notifyBadgeEarned(badgeId: string): void {
  const badge = ALL_BADGES.find(b => b.id === badgeId)
  if (badge) {
    badgeEarnedCallbacks.forEach(callback => callback(badge))
  }
}

// Tüm rozetler
export const ALL_BADGES: Omit<Badge, 'earnedAt'>[] = [
  // İzleme Rozetleri
  { id: 'first-watch', name: 'İlk Adım', description: 'İlk içeriğini izledin', icon: '🎬', category: 'watching', requirement: 1 },
  { id: 'movie-lover', name: 'Film Sever', description: '10 film izledin', icon: '🎥', category: 'watching', requirement: 10 },
  { id: 'movie-master', name: 'Film Ustası', description: '50 film izledin', icon: '🏆', category: 'watching', requirement: 50 },
  { id: 'series-fan', name: 'Dizi Fanı', description: '100 bölüm izledin', icon: '📺', category: 'watching', requirement: 100 },
  { id: 'binge-watcher', name: 'Maraton Koşucusu', description: 'Bir günde 10 bölüm izledin', icon: '🏃', category: 'watching', requirement: 10 },
  { id: 'anime-otaku', name: 'Anime Otaku', description: '25 anime izledin', icon: '🎌', category: 'watching', requirement: 25 },
  { id: 'night-owl', name: 'Gece Kuşu', description: 'Gece 2den sonra izleme yaptın', icon: '🦉', category: 'watching', requirement: 1 },
  
  // Sosyal Rozetler
  { id: 'social-butterfly', name: 'Sosyal Kelebek', description: '10 kişiyi takip ettin', icon: '🦋', category: 'social', requirement: 10 },
  { id: 'popular', name: 'Popüler', description: '10 takipçi kazandın', icon: '⭐', category: 'social', requirement: 10 },
  { id: 'influencer', name: 'Influencer', description: '100 takipçi kazandın', icon: '👑', category: 'social', requirement: 100 },
  { id: 'commentator', name: 'Yorumcu', description: '10 yorum yaptın', icon: '💬', category: 'social', requirement: 10 },
  { id: 'critic', name: 'Eleştirmen', description: '50 yorum yaptın', icon: '📝', category: 'social', requirement: 50 },
  { id: 'party-host', name: 'Parti Sahibi', description: 'Birlikte izle odası oluşturdun', icon: '🎉', category: 'social', requirement: 1 },
  
  // Başarı Rozetleri
  { id: 'early-bird', name: 'Erken Kuş', description: 'İlk 1000 kullanıcıdan biri oldun', icon: '🐦', category: 'achievement', requirement: 1 },
  { id: 'collector', name: 'Koleksiyoncu', description: '100 içerik favorilere ekledin', icon: '📚', category: 'achievement', requirement: 100 },
  { id: 'explorer', name: 'Kaşif', description: 'Her türden içerik izledin', icon: '🧭', category: 'achievement', requirement: 3 },
  { id: 'dedicated', name: 'Sadık', description: '30 gün üst üste giriş yaptın', icon: '🔥', category: 'achievement', requirement: 30 },
  
  // Özel Rozetler
  { id: 'beta-tester', name: 'Beta Test', description: 'Beta döneminde katıldın', icon: '🧪', category: 'special', requirement: 1 },
  { id: 'bug-hunter', name: 'Hata Avcısı', description: 'Bir hata bildirdin', icon: '🐛', category: 'special', requirement: 1 },
  { id: 'supporter', name: 'Destekçi', description: 'Premium üye oldun', icon: '💎', category: 'special', requirement: 1 },
]

// Kullanıcının rozetlerini getir
export async function getUserBadges(userId: string): Promise<Badge[]> {
  try {
    const badgesRef = collection(db, 'users', userId, 'badges')
    const snapshot = await getDocs(badgesRef)
    
    return snapshot.docs.map(doc => {
      const data = doc.data()
      const badgeInfo = ALL_BADGES.find(b => b.id === doc.id)
      return {
        id: doc.id,
        name: badgeInfo?.name || 'Bilinmeyen Rozet',
        description: badgeInfo?.description || '',
        icon: badgeInfo?.icon || '🏅',
        category: badgeInfo?.category || 'achievement',
        requirement: badgeInfo?.requirement || 0,
        earnedAt: data.earnedAt?.toDate(),
      }
    })
  } catch (error) {
    console.error('Error getting badges:', error)
    return []
  }
}

// Rozet ver
export async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
  try {
    const badgeRef = doc(db, 'users', userId, 'badges', badgeId)
    await setDoc(badgeRef, {
      earnedAt: serverTimestamp(),
    })
    
    // Rozet kazanma bildirimini tetikle
    notifyBadgeEarned(badgeId)
    
    return true
  } catch (error) {
    console.error('Error awarding badge:', error)
    return false
  }
}

// Rozet kontrolü ve otomatik verme
export async function checkAndAwardBadges(
  userId: string,
  stats: {
    moviesWatched?: number
    episodesWatched?: number
    animeWatched?: number
    followers?: number
    following?: number
    comments?: number
    favorites?: number
    watchParties?: number
  }
): Promise<string[]> {
  const awardedBadges: string[] = []
  const currentBadges = await getUserBadges(userId)
  const currentBadgeIds = new Set(currentBadges.map(b => b.id))

  // İzleme rozetleri
  if (stats.moviesWatched && stats.moviesWatched >= 1 && !currentBadgeIds.has('first-watch')) {
    await awardBadge(userId, 'first-watch')
    awardedBadges.push('first-watch')
  }
  if (stats.moviesWatched && stats.moviesWatched >= 10 && !currentBadgeIds.has('movie-lover')) {
    await awardBadge(userId, 'movie-lover')
    awardedBadges.push('movie-lover')
  }
  if (stats.moviesWatched && stats.moviesWatched >= 50 && !currentBadgeIds.has('movie-master')) {
    await awardBadge(userId, 'movie-master')
    awardedBadges.push('movie-master')
  }
  if (stats.episodesWatched && stats.episodesWatched >= 100 && !currentBadgeIds.has('series-fan')) {
    await awardBadge(userId, 'series-fan')
    awardedBadges.push('series-fan')
  }
  if (stats.animeWatched && stats.animeWatched >= 25 && !currentBadgeIds.has('anime-otaku')) {
    await awardBadge(userId, 'anime-otaku')
    awardedBadges.push('anime-otaku')
  }

  // Sosyal rozetler
  if (stats.following && stats.following >= 10 && !currentBadgeIds.has('social-butterfly')) {
    await awardBadge(userId, 'social-butterfly')
    awardedBadges.push('social-butterfly')
  }
  if (stats.followers && stats.followers >= 10 && !currentBadgeIds.has('popular')) {
    await awardBadge(userId, 'popular')
    awardedBadges.push('popular')
  }
  if (stats.followers && stats.followers >= 100 && !currentBadgeIds.has('influencer')) {
    await awardBadge(userId, 'influencer')
    awardedBadges.push('influencer')
  }
  if (stats.comments && stats.comments >= 10 && !currentBadgeIds.has('commentator')) {
    await awardBadge(userId, 'commentator')
    awardedBadges.push('commentator')
  }
  if (stats.comments && stats.comments >= 50 && !currentBadgeIds.has('critic')) {
    await awardBadge(userId, 'critic')
    awardedBadges.push('critic')
  }
  if (stats.watchParties && stats.watchParties >= 1 && !currentBadgeIds.has('party-host')) {
    await awardBadge(userId, 'party-host')
    awardedBadges.push('party-host')
  }

  // Başarı rozetleri
  if (stats.favorites && stats.favorites >= 100 && !currentBadgeIds.has('collector')) {
    await awardBadge(userId, 'collector')
    awardedBadges.push('collector')
  }

  return awardedBadges
}

// Rozet kategorisine göre filtrele
export function getBadgesByCategory(category: Badge['category']): Omit<Badge, 'earnedAt'>[] {
  return ALL_BADGES.filter(b => b.category === category)
}
