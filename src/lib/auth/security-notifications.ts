/**
 * Security Notifications
 * Yeni cihaz girişlerinde e-posta/push bildirimi
 */

import { doc, setDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { sendEmail } from '@/lib/email/resend'
import { sendPushNotification } from '@/lib/push-notifications'
import { getDeviceType } from '@/lib/auth/webauthn'

export interface SecurityEvent {
  id: string
  userId: string
  type: 'login' | 'password_change' | 'email_change' | '2fa_enabled' | '2fa_disabled' | 'new_device' | 'suspicious_activity'
  deviceInfo: {
    type: string
    browser: string
    os: string
    ip: string
    location?: string
  }
  timestamp: Date
  notified: boolean
}

/**
 * Güvenlik olayı kaydet
 */
export async function logSecurityEvent(
  userId: string,
  type: SecurityEvent['type'],
  deviceInfo: SecurityEvent['deviceInfo']
): Promise<void> {
  try {
    const eventRef = doc(collection(db, 'users', userId, 'securityEvents'))
    
    const event: Omit<SecurityEvent, 'id'> = {
      userId,
      type,
      deviceInfo,
      timestamp: new Date(),
      notified: false,
    }

    await setDoc(eventRef, event)

    // Bildirim gönder
    await sendSecurityNotification(userId, type, deviceInfo)
  } catch (error) {
    console.error('Güvenlik olayı kaydetme hatası:', error)
  }
}

/**
 * Güvenlik bildirimi gönder
 */
async function sendSecurityNotification(
  userId: string,
  type: SecurityEvent['type'],
  deviceInfo: SecurityEvent['deviceInfo']
): Promise<void> {
  try {
    // Kullanıcı bilgilerini al
    const userDoc = await getDocs(
      query(collection(db, 'users'), where('uid', '==', userId), limit(1))
    )

    if (userDoc.empty) return

    const userData = userDoc.docs[0].data()
    const email = userData.email

    // Bildirim mesajları
    const messages = {
      login: {
        title: 'Yeni Giriş Yapıldı',
        body: `Hesabınıza ${deviceInfo.type} cihazından giriş yapıldı.`,
        emailSubject: 'Rimora - Yeni Giriş Bildirimi',
      },
      new_device: {
        title: 'Yeni Cihaz Eklendi',
        body: `Hesabınıza yeni bir cihaz eklendi: ${deviceInfo.type}`,
        emailSubject: 'Rimora - Yeni Cihaz Bildirimi',
      },
      password_change: {
        title: 'Şifre Değiştirildi',
        body: 'Hesap şifreniz değiştirildi.',
        emailSubject: 'Rimora - Şifre Değişikliği Bildirimi',
      },
      email_change: {
        title: 'E-posta Değiştirildi',
        body: 'Hesap e-posta adresiniz değiştirildi.',
        emailSubject: 'Rimora - E-posta Değişikliği Bildirimi',
      },
      '2fa_enabled': {
        title: '2FA Aktif Edildi',
        body: 'İki faktörlü kimlik doğrulama aktif edildi.',
        emailSubject: 'Rimora - 2FA Aktif Edildi',
      },
      '2fa_disabled': {
        title: '2FA Devre Dışı Bırakıldı',
        body: 'İki faktörlü kimlik doğrulama devre dışı bırakıldı.',
        emailSubject: 'Rimora - 2FA Devre Dışı Bırakıldı',
      },
      suspicious_activity: {
        title: '⚠️ Şüpheli Aktivite Tespit Edildi',
        body: 'Hesabınızda şüpheli aktivite tespit edildi.',
        emailSubject: 'Rimora - Şüpheli Aktivite Uyarısı',
      },
    }

    const message = messages[type]

    // Push notification gönder
    try {
      await sendPushNotification(userId, {
        title: message.title,
        body: message.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: {
          type: 'security',
          url: '/ayarlar/guvenlik',
        },
      })
    } catch (error) {
      console.error('Push notification gönderme hatası:', error)
    }

    // E-posta gönder
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: message.emailSubject,
          html: generateSecurityEmailHTML(type, deviceInfo, message),
        })
      } catch (error) {
        console.error('E-posta gönderme hatası:', error)
      }
    }

    // Bildirimi işaretle
    const eventsRef = collection(db, 'users', userId, 'securityEvents')
    const eventsQuery = query(
      eventsRef,
      where('type', '==', type),
      where('notified', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1)
    )
    const eventsSnapshot = await getDocs(eventsQuery)

    if (!eventsSnapshot.empty) {
      await setDoc(
        eventsSnapshot.docs[0].ref,
        { notified: true },
        { merge: true }
      )
    }
  } catch (error) {
    console.error('Güvenlik bildirimi gönderme hatası:', error)
  }
}

/**
 * Güvenlik e-postası HTML oluştur
 */
function generateSecurityEmailHTML(
  type: SecurityEvent['type'],
  deviceInfo: SecurityEvent['deviceInfo'],
  message: { title: string; body: string }
): string {
  const isCritical = type === 'suspicious_activity' || type === 'password_change'
  const color = isCritical ? '#ef4444' : '#6366f1'

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">${message.title}</h2>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          ${message.body}
        </p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #111827;">Cihaz Bilgileri</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Cihaz Türü:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${deviceInfo.type}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Tarayıcı:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${deviceInfo.browser}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">İşletim Sistemi:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${deviceInfo.os}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">IP Adresi:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${deviceInfo.ip}</td>
            </tr>
            ${deviceInfo.location ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Konum:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${deviceInfo.location}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Zaman:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 500;">${new Date().toLocaleString('tr-TR')}</td>
            </tr>
          </table>
        </div>

        ${isCritical ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0; font-weight: 500;">
            ⚠️ Bu işlemi siz yapmadıysanız, derhal şifrenizi değiştirin ve hesabınızı güvence altına alın.
          </p>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://rimora.com/ayarlar/guvenlik" 
             style="display: inline-block; background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Güvenlik Ayarlarına Git
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          Bu işlemi siz yaptıysanız, bu e-postayı görmezden gelebilirsiniz.
        </p>
      </div>

      <div style="background: #f3f4f6; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Rimora. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  `
}

/**
 * Güvenlik olaylarını getir
 */
export async function getSecurityEvents(
  userId: string,
  limitCount: number = 10
): Promise<SecurityEvent[]> {
  try {
    const eventsRef = collection(db, 'users', userId, 'securityEvents')
    const eventsQuery = query(
      eventsRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    const eventsSnapshot = await getDocs(eventsQuery)

    return eventsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SecurityEvent[]
  } catch (error) {
    console.error('Güvenlik olayları getirme hatası:', error)
    return []
  }
}

/**
 * Tarayıcı bilgilerini al
 */
export function getBrowserInfo(): { browser: string; os: string } {
  const ua = navigator.userAgent

  // Tarayıcı tespiti
  let browser = 'Bilinmeyen'
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Edge')) browser = 'Edge'
  else if (ua.includes('Opera')) browser = 'Opera'

  // İşletim sistemi tespiti
  let os = 'Bilinmeyen'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS')) os = 'iOS'

  return { browser, os }
}

/**
 * IP adresini al (client-side için placeholder)
 */
export async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch (error) {
    console.error('IP adresi alma hatası:', error)
    return 'Bilinmeyen'
  }
}
