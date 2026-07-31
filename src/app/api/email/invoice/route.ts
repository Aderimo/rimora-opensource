/**
 * Fatura E-posta API Route
 * 
 * Ödeme sonrası fatura e-postası gönderir.
 * Bu endpoint webhook tarafından çağrılır.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendInvoiceEmail } from '@/lib/email/resend'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface InvoiceEmailRequest {
  userId: string
  email: string
  userName: string
  plan: 'standard' | 'premium' | 'family'
  planName: string
  price: number
  billingCycle: 'monthly' | 'yearly'
  paymentDate: string
  invoiceNumber: string
  paymentMethod: string
  nextPaymentDate?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: InvoiceEmailRequest = await request.json()
    const { 
      userId, 
      email, 
      userName, 
      plan, 
      planName, 
      price, 
      billingCycle, 
      paymentDate, 
      invoiceNumber, 
      paymentMethod, 
      nextPaymentDate 
    } = body

    // Validasyon
    if (!userId || !email || !userName || !plan || !planName || !price || !billingCycle || !paymentDate || !invoiceNumber || !paymentMethod) {
      return NextResponse.json(
        { error: 'Tüm zorunlu alanlar doldurulmalıdır' },
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

    // Plan kontrolü
    if (!['standard', 'premium', 'family'].includes(plan)) {
      return NextResponse.json(
        { error: 'Geçersiz plan' },
        { status: 400 }
      )
    }

    // Fiyat kontrolü
    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json(
        { error: 'Geçersiz fiyat' },
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
          { success: true, message: 'E-posta bildirimleri kapalı, fatura gönderilmedi' },
          { status: 200 }
        )
      }
    }

    // Fatura e-postası verisi hazırla
    const invoiceData = {
      userName,
      email,
      plan,
      planName,
      price,
      billingCycle,
      paymentDate,
      invoiceNumber,
      paymentMethod,
      nextPaymentDate,
    }

    // Fatura e-postası gönder
    const result = await sendInvoiceEmail(invoiceData)

    if (!result.success) {
      console.error('Invoice email failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Fatura e-postası gönderilemedi' },
        { status: 500 }
      )
    }

    // E-posta log'u kaydet
    try {
      const emailLogRef = doc(db, 'emailLogs', `${userId}_invoice_${invoiceNumber}_${Date.now()}`)
      await setDoc(emailLogRef, {
        userId,
        email,
        type: 'invoice',
        plan,
        invoiceNumber,
        price,
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
      message: 'Fatura e-postası başarıyla gönderildi',
      invoiceNumber,
    })

  } catch (error) {
    console.error('Invoice email API error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}

// GET isteği için bilgi döndür
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/email/invoice',
    method: 'POST',
    description: 'Ödeme sonrası fatura e-postası gönderir',
    body: {
      userId: 'string (zorunlu)',
      email: 'string (zorunlu)',
      userName: 'string (zorunlu)',
      plan: 'standard | premium | family (zorunlu)',
      planName: 'string (zorunlu)',
      price: 'number (zorunlu)',
      billingCycle: 'monthly | yearly (zorunlu)',
      paymentDate: 'string (zorunlu)',
      invoiceNumber: 'string (zorunlu)',
      paymentMethod: 'string (zorunlu)',
      nextPaymentDate: 'string (opsiyonel)',
    },
  })
}