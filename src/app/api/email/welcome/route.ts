/**
 * Hoş Geldin E-postası API Route
 * 
 * Yeni kullanıcı kaydı sonrası hoş geldin e-postası gönderir.
 * Bu endpoint kayıt işlemi sırasında veya Cloud Function tarafından çağrılabilir.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Rate limiting için basit in-memory store
const emailSentCache = new Map<string, number>()
const RATE_LIMIT_WINDOW = 5 * 60 * 1000 // 5 dakika

interface WelcomeEmailRequest {
  userId: string
  email: string
  userName: string
}

export async function POST(request: NextRequest) {
  try {
    const body: WelcomeEmailRequest = await request.json()
    const { userId, email, userName } = body

    // Validasyon
    if (!userId || !email || !userName) {
      return NextResponse.json(
        { error: 'userId, email ve userName zorunludur' },
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

    // Rate limiting kontrolü
    const lastSent = emailSentCache.get(userId)
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_WINDOW) {
      return NextResponse.json(
        { error: 'Bu kullanıcıya yakın zamanda e-posta gönderildi' },
        { status: 429 }
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

    // E-posta gönder
    const result = await sendWelcomeEmail({
      userName,
      email,
    })

    if (!result.success) {
      console.error('Welcome email failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'E-posta gönderilemedi' },
        { status: 500 }
      )
    }

    // Rate limit cache'i güncelle
    emailSentCache.set(userId, Date.now())

    // E-posta log'u kaydet
    try {
      const emailLogRef = doc(db, 'emailLogs', `${userId}_welcome_${Date.now()}`)
      await setDoc(emailLogRef, {
        userId,
        email,
        type: 'welcome',
        messageId: result.messageId,
        sentAt: serverTimestamp(),
        status: 'sent',
      })
    } catch (logError) {
      // Log hatası kritik değil, devam et
      console.warn('Email log kaydedilemedi:', logError)
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Hoş geldin e-postası gönderildi',
    })

  } catch (error) {
    console.error('Welcome email API error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}

// GET isteği için bilgi döndür
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/email/welcome',
    method: 'POST',
    description: 'Yeni kullanıcılara hoş geldin e-postası gönderir',
    body: {
      userId: 'string (zorunlu)',
      email: 'string (zorunlu)',
      userName: 'string (zorunlu)',
    },
  })
}
