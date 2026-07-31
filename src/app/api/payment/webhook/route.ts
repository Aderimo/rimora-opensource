/**
 * Payment Webhook API Endpoint
 * 
 * iyzico webhook bildirimi işleme endpoint'i
 * Ödeme sonuçlarını alır ve subscription'ı Firestore'a yazar
 * 
 * @requirements 1.3 - Webhook bildirimi alındığında /api/payment/webhook endpoint'ine bildirim göndermeli
 * @requirements 1.4 - Webhook imzasını doğrulamalı
 * @requirements 1.5 - Geçersiz imza için 401 Unauthorized döndürmeli
 * @requirements 1.6 - Webhook doğrulandığında subscription bilgisini Firestore'a yazmalı
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  retrieveCheckoutFormResult,
  WebhookPayload,
  getPlanPrice
} from '@/lib/payment/iyzico'
import { 
  doc, 
  setDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  validateWebhookSecurity, 
  getWebhookSecurityConfig,
  logSecurityEvent
} from '@/lib/middleware/webhook-security'
import { formatDateTR } from '@/lib/utils/format'

/**
 * Webhook response interface
 */
interface WebhookResponse {
  success: boolean
  message?: string
  error?: string
  errorCode?: string
}

/**
 * Generate invoice number
 * Format: INV-YYYYMMDD-XXXXX (INV-20241201-12345)
 */
function generateInvoiceNumber(): string {
  const date = new Date()
  const dateStr = date.getFullYear().toString() + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + 
                  date.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
  return `INV-${dateStr}-${random}`
}

/**
 * Extract userId from conversationId
 * conversationId format: rimora_{timestamp}_{random}
 * We need to get userId from the payment result's basketId
 * basketId format: basket_{userId}_{timestamp}
 */
function extractUserIdFromBasketId(basketId: string): string | null {
  if (!basketId) return null
  const parts = basketId.split('_')
  if (parts.length >= 2 && parts[0] === 'basket') {
    return parts[1]
  }
  return null
}

/**
 * Calculate subscription end date based on billing cycle
 */
function calculateEndDate(billingCycle: 'monthly' | 'yearly'): Date {
  const endDate = new Date()
  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1)
  } else {
    endDate.setMonth(endDate.getMonth() + 1)
  }
  return endDate
}

/**
 * Get client IP address for logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.ip || '127.0.0.1'
}

/**
 * Write subscription to Firestore
 * 
 * @requirements 1.6 - Webhook doğrulandığında subscription bilgisini Firestore'a yazmalı
 */
async function writeSubscriptionToFirestore(
  userId: string,
  plan: 'standard' | 'premium' | 'family',
  billingCycle: 'monthly' | 'yearly',
  price: number,
  paymentId: string
): Promise<void> {
  const endDate = calculateEndDate(billingCycle)
  
  // Plan'ı tier'a çevir (yeni sistem uyumluluğu için)
  const tierMapping: Record<string, string> = {
    'standard': 'bronze',
    'premium': 'gold', 
    'family': 'diamond'
  }
  
  const subscriptionData = {
    plan,
    tier: tierMapping[plan] || 'bronze', // Yeni tier sistemi için
    status: 'active' as const,
    startDate: serverTimestamp(),
    endDate: Timestamp.fromDate(endDate),
    autoRenew: true,
    billingCycle,
    price,
    paymentMethod: 'iyzico',
    iyzicoPaymentId: paymentId,
    lastPaymentDate: serverTimestamp(),
    nextPaymentDate: Timestamp.fromDate(endDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  
  await setDoc(doc(db, 'subscriptions', userId), subscriptionData)
  
  console.log(`Subscription created for user ${userId}:`, {
    plan,
    tier: subscriptionData.tier,
    billingCycle,
    price,
    paymentId,
    endDate: endDate.toISOString(),
  })
}

/**
 * POST /api/payment/webhook
 * 
 * iyzico webhook bildirimi işler
 * 
 * @requirements 1.3 - Webhook bildirimi alındığında işleme
 * @requirements 1.4 - Webhook imzasını doğrulamalı
 * @requirements 1.5 - Geçersiz imza için 401 Unauthorized döndürmeli
 * @requirements 1.6 - Subscription bilgisini Firestore'a yazmalı
 */
export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || ''
  
  try {
    // 1. Güvenlik Kontrolü - Rate limiting, IP kontrolü, temel validasyonlar
    const securityConfig = getWebhookSecurityConfig()
    const securityResult = await validateWebhookSecurity(request, securityConfig)
    
    if (!securityResult.isValid) {
      // Güvenlik olayını logla
      logSecurityEvent(
        securityResult.errorCode === 'RATE_LIMIT_EXCEEDED' ? 'RATE_LIMIT' :
        securityResult.errorCode === 'IP_NOT_ALLOWED' ? 'IP_BLOCKED' :
        securityResult.errorCode === 'INVALID_SIGNATURE' ? 'INVALID_SIGNATURE' : 'IP_BLOCKED',
        {
          ip: clientIP,
          userAgent,
          error: securityResult.error
        }
      )
      
      const statusCode = securityResult.errorCode === 'RATE_LIMIT_EXCEEDED' ? 429 :
                        securityResult.errorCode === 'INVALID_SIGNATURE' ? 401 : 403
      
      return NextResponse.json(
        { 
          success: false, 
          error: securityResult.error, 
          errorCode: securityResult.errorCode 
        },
        { 
          status: statusCode,
          headers: securityResult.rateLimitRemaining !== undefined ? {
            'X-RateLimit-Remaining': securityResult.rateLimitRemaining.toString()
          } : {}
        }
      )
    }

    // 2. Request body'yi parse et
    let body: Partial<WebhookPayload>
    try {
      body = await request.json()
    } catch {
      console.error('Webhook: Invalid JSON format')
      logSecurityEvent('INVALID_SIGNATURE', {
        ip: clientIP,
        userAgent,
        error: 'Invalid JSON format'
      })
      return NextResponse.json(
        { success: false, error: 'Geçersiz veri formatı', errorCode: 'INVALID_JSON' },
        { status: 400 }
      )
    }
    
    // 3. Required field validasyonu
    if (!body.token) {
      console.error('Webhook: Missing token')
      return NextResponse.json(
        { success: false, error: 'Ödeme doğrulama bilgisi eksik', errorCode: 'MISSING_TOKEN' },
        { status: 400 }
      )
    }
    
    // 4. iyzico ile ödeme doğrulaması (asıl güvenlik kontrolü)
    // @requirements 1.4 - Webhook imzasını doğrulamalı
    
    // iyzico'dan ödeme sonucunu al ve doğrula
    const paymentResult = await retrieveCheckoutFormResult(body.token)
    
    if (paymentResult.status !== 'success') {
      console.error('Webhook: Payment verification failed', {
        token: body.token?.substring(0, 10) + '...',
        errorMessage: paymentResult.errorMessage,
        ip: clientIP
      })
      
      logSecurityEvent('INVALID_SIGNATURE', {
        ip: clientIP,
        userAgent,
        error: `Payment verification failed: ${paymentResult.errorMessage}`
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: paymentResult.errorMessage || 'Ödeme doğrulanamadı', 
          errorCode: 'PAYMENT_VERIFICATION_FAILED' 
        },
        { status: 401 } // @requirements 1.5 - Geçersiz imza için 401 Unauthorized
      )
    }
    
    // 5. Extract userId from basketId
    const userId = extractUserIdFromBasketId(paymentResult.basketId || '')
    
    if (!userId) {
      console.error('Webhook: Could not extract userId from basketId', {
        basketId: paymentResult.basketId,
        ip: clientIP
      })
      return NextResponse.json(
        { success: false, error: 'Kullanıcı bilgisi bulunamadı', errorCode: 'USER_NOT_FOUND' },
        { status: 400 }
      )
    }
    
    // 6. Validate plan
    const plan = paymentResult.plan as 'standard' | 'premium' | 'family'
    if (!['standard', 'premium', 'family'].includes(plan)) {
      console.error('Webhook: Invalid plan', { plan: paymentResult.plan, ip: clientIP })
      return NextResponse.json(
        { success: false, error: 'Geçersiz plan', errorCode: 'INVALID_PLAN' },
        { status: 400 }
      )
    }
    
    // 7. Validate billing cycle
    const billingCycle = paymentResult.billingCycle as 'monthly' | 'yearly'
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      console.error('Webhook: Invalid billing cycle', { billingCycle: paymentResult.billingCycle, ip: clientIP })
      return NextResponse.json(
        { success: false, error: 'Geçersiz fatura dönemi', errorCode: 'INVALID_BILLING_CYCLE' },
        { status: 400 }
      )
    }
    
    // 8. Get price (use from payment result or calculate)
    const price = paymentResult.price || getPlanPrice(plan, billingCycle)
    
    // 9. Write subscription to Firestore
    // @requirements 1.6 - Webhook doğrulandığında subscription bilgisini Firestore'a yazmalı
    try {
      await writeSubscriptionToFirestore(
        userId,
        plan,
        billingCycle,
        price,
        paymentResult.paymentId
      )
      
      // Abonelik onay e-postası gönder (arka planda)
      // Kullanıcı bilgilerini al ve e-posta gönder
      try {
        const userDoc = await import('firebase/firestore').then(m => m.getDoc(doc(db, 'users', userId)))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          const endDate = calculateEndDate(billingCycle)
          const invoiceNumber = generateInvoiceNumber()
          const paymentDate = formatDateTR(new Date())
          const nextPaymentDate = formatDateTR(endDate)
          
          // Fatura e-postası gönder (öncelik)
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              email: userData.email,
              userName: userData.displayName || userData.name || 'Kullanıcı',
              plan,
              planName: plan === 'standard' ? 'Standart' : plan === 'premium' ? 'Premium' : 'Aile',
              price,
              billingCycle,
              paymentDate,
              invoiceNumber,
              paymentMethod: 'Kredi Kartı (iyzico)',
              nextPaymentDate,
            }),
          }).catch(err => {
            console.error('Invoice email error:', err)
          })
          
          // Abonelik onay e-postası gönder (ikincil)
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              email: userData.email,
              userName: userData.displayName || userData.name || 'Kullanıcı',
              type: 'confirm',
              plan,
              endDate: nextPaymentDate,
              price,
              billingCycle,
            }),
          }).catch(err => {
            console.error('Subscription confirmation email error:', err)
          })
        }
      } catch (emailError) {
        console.error('User data fetch for email error:', emailError)
        // E-posta hatası webhook başarısını etkilemez
      }
    } catch (firestoreError) {
      console.error('Webhook: Firestore write error', {
        userId,
        error: firestoreError,
        ip: clientIP
      })
      return NextResponse.json(
        { success: false, error: 'Abonelik kaydedilemedi. Lütfen destek ekibiyle iletişime geçin.', errorCode: 'FIRESTORE_ERROR' },
        { status: 500 }
      )
    }
    
    // 10. Başarılı işlem logla
    logSecurityEvent('SUCCESS', {
      ip: clientIP,
      userAgent,
      timestamp: Date.now()
    })
    
    console.log('Webhook: Payment processed successfully', {
      userId,
      plan,
      billingCycle,
      paymentId: paymentResult.paymentId,
      ip: clientIP
    })
    
    return NextResponse.json({
      success: true,
      message: 'Ödeme başarıyla işlendi',
    })
    
  } catch (error) {
    console.error('Webhook: Unexpected error', {
      error,
      ip: clientIP,
      userAgent
    })
    
    // Beklenmeyen hata logla
    logSecurityEvent('INVALID_SIGNATURE', {
      ip: clientIP,
      userAgent,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Beklenmeyen bir hata oluştu', 
        errorCode: 'INTERNAL_ERROR' 
      },
      { status: 500 }
    )
  }
}

/**
 * GET method - Health check
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'Payment webhook endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
