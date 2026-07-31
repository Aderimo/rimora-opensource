/**
 * Abonelik E-posta Bildirimleri API Route
 * 
 * Abonelik durumu değişikliklerinde (onay, iptal, süre dolumu) e-posta gönderir.
 * Bu endpoint webhook veya Cloud Function tarafından çağrılabilir.
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  sendSubscriptionConfirmEmail, 
  sendSubscriptionCancelledEmail,
  sendSubscriptionExpiringEmail 
} from '@/lib/email'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Plan isimleri
const PLAN_NAMES: Record<string, string> = {
  standard: 'Standart',
  premium: 'Premium',
  family: 'Aile',
  free: 'Ücretsiz',
}

type EmailType = 'confirm' | 'cancelled' | 'expiring'

interface SubscriptionEmailRequest {
  userId: string
  email: string
  userName: string
  type: EmailType
  plan: 'standard' | 'premium' | 'family'
  endDate?: string
  price?: number
  billingCycle?: 'monthly' | 'yearly'
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscriptionEmailRequest = await request.json()
    const { userId, email, userName, type, plan, endDate, price, billingCycle } = body

    // Validasyon
    if (!userId || !email || !userName || !type || !plan) {
      return NextResponse.json(
        { error: 'userId, email, userName, type ve plan zorunludur' },
        { status: 400 }
      )
    }

    // E-posta tipi kontrolü
    const validTypes: EmailType[] = ['confirm', 'cancelled', 'expiring']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Geçersiz e-posta tipi. Geçerli tipler: confirm, cancelled, expiring' },
        { status: 400 }
      )
    }

    // E-posta formatı kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Geçersiz e-posta formatı' },
        { status: 400 }
      )
    }

    // Kullanıcının e-posta tercihlerini kontrol et
    const prefsRef = doc(db, 'notificationSettings', userId)
    const prefsSnap = await getDoc(prefsRef)
    
    if (prefsSnap.exists()) {
      const prefs = prefsSnap.data()
      if (prefs.preferences?.emailNotifications === false) {
        return NextResponse.json(
          { success: true, message: 'E-posta bildirimleri kapalı, gönderilmedi' },
          { status: 200 }
        )
      }
    }

    // E-posta verisi hazırla
    const emailData = {
      userName,
      email,
      plan,
      planName: PLAN_NAMES[plan] || plan,
      endDate,
      price,
      billingCycle,
    }

    // E-posta tipine göre gönder
    let result
    switch (type) {
      case 'confirm':
        result = await sendSubscriptionConfirmEmail(emailData)
        break
      case 'cancelled':
        result = await sendSubscriptionCancelledEmail(emailData)
        break
      case 'expiring':
        result = await sendSubscriptionExpiringEmail(emailData)
        break
      default:
        return NextResponse.json(
          { error: 'Geçersiz e-posta tipi' },
          { status: 400 }
        )
    }

    if (!result.success) {
      console.error(`Subscription ${type} email failed:`, result.error)
      return NextResponse.json(
        { error: result.error || 'E-posta gönderilemedi' },
        { status: 500 }
      )
    }

    // E-posta log'u kaydet
    try {
      const emailLogRef = doc(db, 'emailLogs', `${userId}_subscription_${type}_${Date.now()}`)
      await setDoc(emailLogRef, {
        userId,
        email,
        type: `subscription_${type}`,
        plan,
        messageId: result.messageId,
        sentAt: serverTimestamp(),
        status: 'sent',
      })
    } catch (logError) {
      console.warn('Email log kaydedilemedi:', logError)
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Abonelik ${type} e-postası gönderildi`,
    })

  } catch (error) {
    console.error('Subscription email API error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}

// GET isteği için bilgi döndür
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/email/subscription',
    method: 'POST',
    description: 'Abonelik durumu değişikliklerinde e-posta gönderir',
    body: {
      userId: 'string (zorunlu)',
      email: 'string (zorunlu)',
      userName: 'string (zorunlu)',
      type: 'confirm | cancelled | expiring (zorunlu)',
      plan: 'standard | premium | family (zorunlu)',
      endDate: 'string (opsiyonel)',
      price: 'number (opsiyonel)',
      billingCycle: 'monthly | yearly (opsiyonel)',
    },
  })
}
