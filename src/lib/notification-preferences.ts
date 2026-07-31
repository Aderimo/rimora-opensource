/**
 * Bildirim tercihleri yardımcı fonksiyonları
 * Kullanıcının bildirim tercihlerini kontrol etmek için kullanılır
 */

import { getNotificationPreferences, type NotificationPreferences } from './push-notifications'

export type NotificationType = 
  | 'new_episode'
  | 'new_movie' 
  | 'friend_activity'
  | 'comment'
  | 'message'
  | 'watch_party_invite'
  | 'follower'
  | 'system'

/**
 * Kullanıcının belirli bir bildirim türü için tercihini kontrol et
 */
export async function canSendNotification(
  userId: string, 
  notificationType: NotificationType
): Promise<boolean> {
  try {
    const preferences = await getNotificationPreferences(userId)
    return shouldSendNotificationByType(preferences, notificationType)
  } catch (error) {
    console.error('Error checking notification preferences:', error)
    // Hata durumunda varsayılan olarak gönder
    return true
  }
}

/**
 * Bildirim tercihlerine göre gönderim kontrolü (client-side)
 */
export function shouldSendNotificationByType(
  preferences: NotificationPreferences, 
  notificationType: NotificationType
): boolean {
  switch (notificationType) {
    case 'new_episode':
      return Boolean(preferences.newEpisodes)
    case 'new_movie':
      return Boolean(preferences.newMovies)
    case 'friend_activity':
      return Boolean(preferences.friendActivity)
    case 'comment':
      return Boolean(preferences.comments)
    case 'message':
      return Boolean(preferences.messages)
    case 'watch_party_invite':
      return Boolean(preferences.watchPartyInvites)
    case 'follower':
      return Boolean(preferences.followerNotifications ?? true) // Varsayılan true
    case 'system':
      return Boolean(preferences.systemNotifications ?? true) // Varsayılan true
    default:
      // Bilinmeyen türler için varsayılan olarak gönder
      return true
  }
}

/**
 * Birden fazla kullanıcı için bildirim tercihlerini toplu kontrol et
 */
export async function filterUsersByNotificationPreference(
  userIds: string[],
  notificationType: NotificationType
): Promise<string[]> {
  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const canSend = await canSendNotification(userId, notificationType)
      return canSend ? userId : null
    })
  )

  return results
    .filter((result): result is PromiseFulfilledResult<string> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value)
}

/**
 * Bildirim türü açıklamalarını getir (UI için)
 */
export function getNotificationTypeDescription(type: NotificationType): string {
  const descriptions: Record<NotificationType, string> = {
    new_episode: 'Yeni bölüm bildirimleri',
    new_movie: 'Yeni film bildirimleri',
    friend_activity: 'Arkadaş aktivite bildirimleri',
    comment: 'Yorum bildirimleri',
    message: 'Mesaj bildirimleri',
    watch_party_invite: 'Birlikte izle davet bildirimleri',
    follower: 'Takipçi bildirimleri',
    system: 'Sistem bildirimleri',
  }
  
  return descriptions[type] || 'Bilinmeyen bildirim türü'
}

/**
 * Kullanıcının aktif bildirim türlerini getir
 */
export async function getActiveNotificationTypes(userId: string): Promise<NotificationType[]> {
  try {
    const preferences = await getNotificationPreferences(userId)
    const activeTypes: NotificationType[] = []
    
    const typeMap: Array<[keyof NotificationPreferences, NotificationType]> = [
      ['newEpisodes', 'new_episode'],
      ['newMovies', 'new_movie'],
      ['friendActivity', 'friend_activity'],
      ['comments', 'comment'],
      ['messages', 'message'],
      ['watchPartyInvites', 'watch_party_invite'],
      ['followerNotifications', 'follower'],
      ['systemNotifications', 'system'],
    ]
    
    typeMap.forEach(([prefKey, notifType]) => {
      if (preferences[prefKey]) {
        activeTypes.push(notifType)
      }
    })
    
    return activeTypes
  } catch (error) {
    console.error('Error getting active notification types:', error)
    return []
  }
}