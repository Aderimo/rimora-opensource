import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { getMessaging } from 'firebase-admin/messaging'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, notification } = body

    if (!userId || !notification) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Kullanıcının FCM token'larını al
    const settingsDoc = await adminDb
      .collection('notificationSettings')
      .doc(userId)
      .get()

    if (!settingsDoc.exists) {
      return NextResponse.json(
        { error: 'User notification settings not found' },
        { status: 404 }
      )
    }

    const settings = settingsDoc.data()
    const fcmTokens = settings?.fcmTokens || []

    if (fcmTokens.length === 0) {
      return NextResponse.json(
        { error: 'No FCM tokens found for user' },
        { status: 404 }
      )
    }

    // Bildirim tercihlerini kontrol et
    const preferences = settings?.preferences || {}
    
    // Bildirim tipine göre tercih kontrolü
    const shouldSend = checkNotificationPreference(notification.type, preferences)
    
    if (!shouldSend) {
      return NextResponse.json(
        { message: 'Notification blocked by user preferences' },
        { status: 200 }
      )
    }

    // FCM mesajını hazırla
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        type: notification.type,
        ...(notification.data || {}),
      },
    }

    // Tüm token'lara bildirim gönder
    const messaging = getMessaging()
    const results = await Promise.allSettled(
      fcmTokens.map((tokenObj: any) =>
        messaging.send({
          ...message,
          token: tokenObj.token,
        })
      )
    )

    // Başarısız token'ları temizle
    const failedTokens: string[] = []
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedTokens.push(fcmTokens[index].token)
        console.error('Failed to send notification:', result.reason)
      }
    })

    // Başarısız token'ları Firestore'dan kaldır
    if (failedTokens.length > 0) {
      const validTokens = fcmTokens.filter(
        (tokenObj: any) => !failedTokens.includes(tokenObj.token)
      )
      
      await adminDb
        .collection('notificationSettings')
        .doc(userId)
        .update({
          fcmTokens: validTokens,
          updatedAt: new Date(),
        })
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedTokens.length,
    })
  } catch (error) {
    console.error('Error sending push notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}

// Bildirim tercihlerini kontrol et
function checkNotificationPreference(
  type: string,
  preferences: Record<string, boolean>
): boolean {
  // Sistem bildirimleri her zaman gönderilir
  if (!preferences.systemNotifications) {
    return false
  }

  switch (type) {
    case 'new_episode':
    case 'new_content':
      return preferences.newEpisodes !== false && preferences.newMovies !== false
    
    case 'message':
      return preferences.messages !== false
    
    case 'watch_party':
      return preferences.watchPartyInvites !== false
    
    case 'follow':
      return preferences.followerNotifications !== false
    
    case 'comment':
    case 'like':
      return preferences.comments !== false
    
    case 'friend_activity':
      return preferences.friendActivity !== false
    
    default:
      return true
  }
}
