/**
 * Push Notification Sender
 * Server-side ve client-side bildirim gönderme yardımcıları
 */

import { canSendNotification } from './notification-preferences'

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  image?: string
  link?: string
  data?: Record<string, string>
}

/**
 * Tek kullanıcıya bildirim gönder (tercih kontrolü ile)
 */
export async function sendNotificationToUser(
  userId: string,
  notification: NotificationPayload
): Promise<{ success: boolean; error?: string; blocked?: boolean }> {
  try {
    // Bildirim tercihlerini kontrol et
    const notificationType = notification.data?.type
    if (notificationType) {
      const canSend = await canSendNotification(userId, notificationType as any)
      if (!canSend) {
        return { 
          success: false, 
          blocked: true, 
          error: 'Notification blocked by user preferences' 
        }
      }
    }

    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        ...notification,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Send notification error:', error)
    return { success: false, error: 'Network error' }
  }
}

/**
 * Birden fazla kullanıcıya bildirim gönder
 */
export async function sendNotificationToUsers(
  userIds: string[],
  notification: NotificationPayload
): Promise<{ success: number; failed: number; blocked: number }> {
  const results = await Promise.allSettled(
    userIds.map(userId => sendNotificationToUser(userId, notification))
  )

  let success = 0
  let failed = 0
  let blocked = 0

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        success++
      } else if (result.value.blocked) {
        blocked++
      } else {
        failed++
      }
    } else {
      failed++
    }
  })

  return { success, failed, blocked }
}

/**
 * Yeni bölüm bildirimi gönder
 */
export async function sendNewEpisodeNotification(
  userId: string,
  mediaTitle: string,
  season: number,
  episode: number,
  mediaId: number,
  mediaType: 'tv' | 'anime'
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: '🎬 Yeni Bölüm!',
    body: `${mediaTitle} S${season}E${episode} yayında!`,
    link: `/${mediaType === 'anime' ? 'animeler' : 'diziler'}/${mediaId}`,
    data: {
      type: 'new_episode',
      mediaId: mediaId.toString(),
      mediaType,
      season: season.toString(),
      episode: episode.toString(),
    },
  })
}

/**
 * Yeni film bildirimi gönder
 */
export async function sendNewMovieNotification(
  userId: string,
  mediaTitle: string,
  mediaId: number
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: '🎬 Yeni Film!',
    body: `${mediaTitle} artık izlenebilir!`,
    link: `/filmler/${mediaId}`,
    data: {
      type: 'new_movie',
      mediaId: mediaId.toString(),
      mediaType: 'movie',
    },
  })
}

/**
 * Watch Party daveti bildirimi
 */
export async function sendWatchPartyInviteNotification(
  userId: string,
  hostName: string,
  mediaTitle: string,
  roomId: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: '🎉 Watch Party Daveti!',
    body: `${hostName} seni "${mediaTitle}" izlemeye davet ediyor!`,
    link: `/izle-birlikte/${roomId}`,
    data: {
      type: 'watch_party_invite',
      roomId,
    },
  })
}

/**
 * Yeni mesaj bildirimi
 */
export async function sendMessageNotification(
  userId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `💬 ${senderName}`,
    body: messagePreview.length > 50 ? messagePreview.slice(0, 47) + '...' : messagePreview,
    link: `/mesajlar?conversation=${conversationId}`,
    data: {
      type: 'message',
      conversationId,
      senderName,
    },
  })
}

/**
 * Yeni takipçi bildirimi
 */
export async function sendFollowerNotification(
  userId: string,
  followerName: string,
  followerUsername: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: '👤 Yeni Takipçi!',
    body: `${followerName} seni takip etmeye başladı`,
    link: `/profil/${followerUsername}`,
    data: {
      type: 'follower',
      followerUsername,
    },
  })
}

/**
 * Arkadaş aktivitesi bildirimi
 */
export async function sendFriendActivityNotification(
  userId: string,
  friendName: string,
  activityType: 'watched' | 'rated' | 'listed',
  mediaTitle: string,
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime'
): Promise<void> {
  const typeMap = { movie: 'filmler', tv: 'diziler', anime: 'animeler' }
  const activityMap = {
    watched: 'izledi',
    rated: 'puanladı',
    listed: 'listesine ekledi'
  }
  
  await sendNotificationToUser(userId, {
    title: '👥 Arkadaş Aktivitesi',
    body: `${friendName} "${mediaTitle}" ${activityMap[activityType]}`,
    link: `/${typeMap[mediaType]}/${mediaId}`,
    data: {
      type: 'friend_activity',
      mediaId: mediaId.toString(),
      mediaType,
      activityType,
      friendName,
    },
  })
}

/**
 * Sistem bildirimi gönder
 */
export async function sendSystemNotification(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `🔔 ${title}`,
    body,
    link: link || '/',
    data: {
      type: 'system',
    },
  })
}
/**
 * Yorum/yanıt bildirimi
 */
export async function sendCommentNotification(
  userId: string,
  commenterName: string,
  mediaTitle: string,
  mediaId: number,
  mediaType: 'movie' | 'tv' | 'anime'
): Promise<void> {
  const typeMap = { movie: 'filmler', tv: 'diziler', anime: 'animeler' }
  
  await sendNotificationToUser(userId, {
    title: '💬 Yeni Yorum!',
    body: `${commenterName} "${mediaTitle}" üzerinde yorum yaptı`,
    link: `/${typeMap[mediaType]}/${mediaId}#reviews`,
    data: {
      type: 'comment',
      mediaId: mediaId.toString(),
      mediaType,
    },
  })
}