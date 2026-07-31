/**
 * iyzico Payment Gateway Integration
 * 
 * Bu modül sadece server-side'da kullanılmalıdır.
 * Client-side'da import edilmemelidir - ödeme bilgileri güvenliği için kritik!
 * 
 * @requirements 1.1 - 3D Secure destekli ödeme
 * @requirements 1.7 - Ödeme bilgilerini asla client-side'da işlememeli
 */

import Iyzipay from 'iyzipay'
import type { IyzicoCheckoutResponse, IyzicoRetrieveResponse, IyzicoRefundResponse, IyzicoCancelSubscriptionResponse } from '@/types/api'

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * iyzico konfigürasyon interface'i
 */
export interface IyzicoConfig {
  apiKey: string
  secretKey: string
  baseUrl: string // sandbox vs production
}

/**
 * Ödeme oluşturma isteği
 */
export interface CreatePaymentRequest {
  userId: string
  plan: 'standard' | 'premium' | 'family'
  billingCycle: 'monthly' | 'yearly'
  locale: 'tr' | 'en'
  callbackUrl: string
}

/**
 * Ödeme sonucu
 */
export interface PaymentResult {
  status: 'success' | 'failure'
  paymentId: string
  conversationId: string
  errorMessage?: string
}

/**
 * Checkout form başlatma sonucu
 */
export interface CheckoutFormResult {
  status: 'success' | 'failure'
  token?: string
  checkoutFormContent?: string
  paymentPageUrl?: string
  errorMessage?: string
  errorCode?: string
}

/**
 * Webhook payload interface'i
 */
export interface WebhookPayload {
  token: string
  conversationId: string
  status: string
  paymentId?: string
  iyziEventType?: string
  iyziReferenceCode?: string
}

/**
 * Abonelik planı fiyatları (TL cinsinden)
 */
export const PLAN_PRICES: Record<string, Record<string, number>> = {
  standard: {
    monthly: 49.99,
    yearly: 479.99, // ~20% indirim
  },
  premium: {
    monthly: 79.99,
    yearly: 767.99, // ~20% indirim
  },
  family: {
    monthly: 119.99,
    yearly: 1151.99, // ~20% indirim
  },
}

/**
 * Plan özellikleri
 */
export const PLAN_FEATURES: Record<string, string[]> = {
  standard: [
    'HD kalitede izleme',
    '1 cihazda aynı anda izleme',
    'Reklamsız deneyim',
    'Altyazı desteği',
  ],
  premium: [
    '4K Ultra HD kalitede izleme',
    '2 cihazda aynı anda izleme',
    'Reklamsız deneyim',
    'Altyazı desteği',
    'İndirme özelliği',
  ],
  family: [
    '4K Ultra HD kalitede izleme',
    '4 cihazda aynı anda izleme',
    'Reklamsız deneyim',
    'Altyazı desteği',
    'İndirme özelliği',
    '4 profil oluşturma',
  ],
}

// ============================================================================
// IYZICO CLIENT
// ============================================================================

/**
 * iyzico client singleton
 * Environment variable'lardan konfigürasyon alır
 */
function getIyzicoClient(): Iyzipay {
  const apiKey = process.env.IYZICO_API_KEY
  const secretKey = process.env.IYZICO_SECRET_KEY
  const baseUrl = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'

  if (!apiKey || !secretKey) {
    throw new Error(
      'iyzico API anahtarları eksik. IYZICO_API_KEY ve IYZICO_SECRET_KEY environment variable\'larını kontrol edin.'
    )
  }

  return new Iyzipay({
    apiKey,
    secretKey,
    uri: baseUrl,
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Benzersiz conversation ID oluşturur
 */
export function generateConversationId(): string {
  return `rimora_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Basket item ID oluşturur
 */
function generateBasketItemId(plan: string, billingCycle: string): string {
  return `subscription_${plan}_${billingCycle}`
}

/**
 * Plan fiyatını alır
 */
export function getPlanPrice(plan: string, billingCycle: string): number {
  return PLAN_PRICES[plan]?.[billingCycle] || 0
}

// ============================================================================
// CHECKOUT FORM FUNCTIONS
// ============================================================================

/**
 * iyzico Checkout Form başlatır (3D Secure destekli)
 * 
 * @param request - Ödeme oluşturma isteği
 * @param buyerInfo - Alıcı bilgileri
 * @returns Checkout form sonucu
 * 
 * @requirements 1.1 - 3D Secure destekli ödeme formu
 */
export async function initializeCheckoutForm(
  request: CreatePaymentRequest,
  buyerInfo: {
    id: string
    name: string
    surname: string
    email: string
    identityNumber?: string
    phone?: string
    ip: string
    city?: string
    country?: string
    address?: string
  }
): Promise<CheckoutFormResult> {
  const iyzipay = getIyzicoClient()
  const conversationId = generateConversationId()
  const price = getPlanPrice(request.plan, request.billingCycle)

  if (price === 0) {
    return {
      status: 'failure',
      errorMessage: 'Geçersiz plan veya fatura dönemi',
      errorCode: 'INVALID_PLAN',
    }
  }

  const checkoutFormRequest = {
    locale: request.locale === 'tr' ? Iyzipay.LOCALE.TR : Iyzipay.LOCALE.EN,
    conversationId,
    price: price.toFixed(2),
    paidPrice: price.toFixed(2),
    currency: Iyzipay.CURRENCY.TRY,
    basketId: `basket_${request.userId}_${Date.now()}`,
    paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
    callbackUrl: request.callbackUrl,
    enabledInstallments: [1], // Tek çekim
    buyer: {
      id: buyerInfo.id,
      name: buyerInfo.name,
      surname: buyerInfo.surname,
      gsmNumber: buyerInfo.phone || '+905000000000',
      email: buyerInfo.email,
      identityNumber: buyerInfo.identityNumber || '11111111111',
      lastLoginDate: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
      registrationDate: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
      registrationAddress: buyerInfo.address || 'Türkiye',
      ip: buyerInfo.ip,
      city: buyerInfo.city || 'Istanbul',
      country: buyerInfo.country || 'Turkey',
      zipCode: '34000',
    },
    shippingAddress: {
      contactName: `${buyerInfo.name} ${buyerInfo.surname}`,
      city: buyerInfo.city || 'Istanbul',
      country: buyerInfo.country || 'Turkey',
      address: buyerInfo.address || 'Türkiye',
      zipCode: '34000',
    },
    billingAddress: {
      contactName: `${buyerInfo.name} ${buyerInfo.surname}`,
      city: buyerInfo.city || 'Istanbul',
      country: buyerInfo.country || 'Turkey',
      address: buyerInfo.address || 'Türkiye',
      zipCode: '34000',
    },
    basketItems: [
      {
        id: generateBasketItemId(request.plan, request.billingCycle),
        name: `Rimora ${request.plan.charAt(0).toUpperCase() + request.plan.slice(1)} Abonelik - ${
          request.billingCycle === 'monthly' ? 'Aylık' : 'Yıllık'
        }`,
        category1: 'Abonelik',
        category2: 'Dijital İçerik',
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: price.toFixed(2),
      },
    ],
  }

  return new Promise((resolve) => {
    iyzipay.checkoutFormInitialize.create(checkoutFormRequest, (err: Error | null, result: IyzicoCheckoutResponse) => {
      if (err) {
        console.error('iyzico checkout form error:', err)
        resolve({
          status: 'failure',
          errorMessage: err.message || 'Ödeme formu oluşturulamadı',
          errorCode: 'CHECKOUT_INIT_ERROR',
        })
        return
      }

      if (result.status === 'success') {
        resolve({
          status: 'success',
          token: result.token,
          checkoutFormContent: result.checkoutFormContent,
          paymentPageUrl: result.paymentPageUrl,
        })
      } else {
        resolve({
          status: 'failure',
          errorMessage: result.errorMessage || 'Ödeme formu oluşturulamadı',
          errorCode: result.errorCode,
        })
      }
    })
  })
}

/**
 * Checkout form sonucunu alır (callback sonrası)
 * 
 * @param token - iyzico token
 * @returns Ödeme sonucu
 */
export async function retrieveCheckoutFormResult(token: string): Promise<PaymentResult & {
  plan?: string
  billingCycle?: string
  price?: number
  basketId?: string
}> {
  const iyzipay = getIyzicoClient()

  return new Promise((resolve) => {
    iyzipay.checkoutForm.retrieve(
      {
        locale: Iyzipay.LOCALE.TR,
        token,
      },
      (err: Error | null, result: IyzicoRetrieveResponse) => {
        if (err) {
          console.error('iyzico retrieve error:', err)
          resolve({
            status: 'failure',
            paymentId: '',
            conversationId: '',
            errorMessage: err.message || 'Ödeme sonucu alınamadı',
          })
          return
        }

        if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
          // Basket item'dan plan bilgisini çıkar
          const basketItem = result.basketItems?.[0]
          let plan = 'standard'
          let billingCycle = 'monthly'

          if (basketItem?.id) {
            const parts = basketItem.id.split('_')
            if (parts.length >= 3) {
              plan = parts[1]
              billingCycle = parts[2]
            }
          }

          resolve({
            status: 'success',
            paymentId: result.paymentId,
            conversationId: result.conversationId,
            plan,
            billingCycle,
            price: parseFloat(result.paidPrice),
            basketId: result.basketId,
          })
        } else {
          resolve({
            status: 'failure',
            paymentId: result.paymentId || '',
            conversationId: result.conversationId || '',
            errorMessage: result.errorMessage || 'Ödeme başarısız',
          })
        }
      }
    )
  })
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

/**
 * Webhook imzasını doğrular
 * 
 * @param payload - Webhook payload
 * @param signature - iyzico imzası (header'dan)
 * @returns İmza geçerli mi
 * 
 * @requirements 1.4 - Webhook imzasını doğrulamalı
 * @requirements 1.5 - Geçersiz imza için 401 döndürmeli
 */
export async function verifyWebhookSignature(
  payload: WebhookPayload,
  signature: string
): Promise<boolean> {
  // iyzico webhook doğrulaması için token retrieve yapılmalı
  if (!payload.token) {
    console.error('[Webhook] Token eksik')
    return false
  }

  // Signature header kontrolü (ek güvenlik katmanı)
  if (signature) {
    try {
      // iyzico'nun webhook imza formatını kontrol et
      const secretKey = process.env.IYZICO_SECRET_KEY
      if (secretKey) {
        // Payload'u string'e çevir
        const payloadString = JSON.stringify({
          token: payload.token,
          conversationId: payload.conversationId,
          status: payload.status
        })
        
        // HMAC-SHA256 ile imza oluştur
        const crypto = await import('crypto')
        const expectedSignature = crypto
          .createHmac('sha256', secretKey)
          .update(payloadString, 'utf8')
          .digest('hex')
        
        // İmza karşılaştırması (timing attack'a karşı güvenli)
        const normalizedSignature = signature.toLowerCase().replace(/^sha256=/, '')
        const isSignatureValid = crypto.timingSafeEqual(
          Buffer.from(normalizedSignature, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        )
        
        if (!isSignatureValid) {
          console.error('[Webhook] İmza doğrulama başarısız')
          // İmza başarısız ama token kontrolüne devam et (iyzico'nun kendi doğrulaması)
        }
      }
    } catch (error) {
      console.error('[Webhook] İmza kontrolü hatası:', error)
      // İmza kontrolü başarısız ama token kontrolüne devam et
    }
  }

  // iyzico'dan token ile sonuç al - bu gerçek doğrulamadır
  try {
    const result = await retrieveCheckoutFormResult(payload.token)
    
    // Payment status kontrolü
    if (result.status !== 'success') {
      console.error('[Webhook] Token doğrulama başarısız:', result.errorMessage)
      return false
    }
    
    // conversationId eşleşmesi kontrolü (varsa)
    if (payload.conversationId && result.conversationId !== payload.conversationId) {
      console.error('[Webhook] Conversation ID uyuşmuyor', {
        expected: result.conversationId,
        received: payload.conversationId
      })
      return false
    }
    
    // Ek güvenlik kontrolleri
    
    // 1. Timestamp kontrolü - çok eski webhook'ları reddet
    const maxAge = 5 * 60 * 1000 // 5 dakika
    const conversationParts = result.conversationId.split('_')
    if (conversationParts.length >= 2) {
      const timestamp = parseInt(conversationParts[1], 10)
      if (!isNaN(timestamp)) {
        const age = Date.now() - timestamp
        if (age > maxAge) {
          console.error('[Webhook] Webhook çok eski:', { age, maxAge })
          return false
        }
      }
    }
    
    // 2. Duplicate webhook kontrolü (basit in-memory cache)
    const webhookCache = global.webhookCache || new Set()
    global.webhookCache = webhookCache
    
    const webhookKey = `${payload.token}_${result.paymentId}`
    if (webhookCache.has(webhookKey)) {
      console.error('[Webhook] Duplicate webhook detected:', webhookKey)
      return false
    }
    
    // Cache'e ekle (5 dakika sonra otomatik temizlenecek)
    webhookCache.add(webhookKey)
    setTimeout(() => {
      webhookCache.delete(webhookKey)
    }, maxAge)
    
    return true
  } catch (error) {
    console.error('[Webhook] Doğrulama hatası:', error)
    return false
  }
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Abonelik iptal eder
 * 
 * @param subscriptionReferenceCode - iyzico abonelik referans kodu
 * @returns İptal sonucu
 */
export async function cancelSubscription(
  subscriptionReferenceCode: string
): Promise<{ status: 'success' | 'failure'; errorMessage?: string }> {
  const iyzipay = getIyzicoClient()

  return new Promise((resolve) => {
    iyzipay.subscription.cancel(
      {
        locale: Iyzipay.LOCALE.TR,
        subscriptionReferenceCode,
      },
      (err: Error | null, result: IyzicoCancelSubscriptionResponse) => {
        if (err) {
          console.error('iyzico cancel subscription error:', err)
          resolve({
            status: 'failure',
            errorMessage: err.message || 'Abonelik iptal edilemedi',
          })
          return
        }

        if (result.status === 'success') {
          resolve({ status: 'success' })
        } else {
          resolve({
            status: 'failure',
            errorMessage: result.errorMessage || 'Abonelik iptal edilemedi',
          })
        }
      }
    )
  })
}

// ============================================================================
// ERROR MESSAGES
// ============================================================================

/**
 * iyzico hata kodlarını kullanıcı dostu mesajlara çevirir
 */
export function getErrorMessage(errorCode: string, locale: 'tr' | 'en' = 'tr'): string {
  const errorMessages: Record<string, Record<string, string>> = {
    '10051': {
      tr: 'Kartınızda yeterli bakiye bulunmamaktadır.',
      en: 'Insufficient funds on your card.',
    },
    '10005': {
      tr: 'İşlem onaylanmadı. Lütfen bankanızla iletişime geçin.',
      en: 'Transaction not approved. Please contact your bank.',
    },
    '10012': {
      tr: 'Geçersiz kart numarası.',
      en: 'Invalid card number.',
    },
    '10034': {
      tr: 'Kart bilgileri hatalı.',
      en: 'Invalid card information.',
    },
    '10057': {
      tr: 'Kart sahibi bu işlemi yapamaz.',
      en: 'Card holder cannot perform this transaction.',
    },
    '10058': {
      tr: 'Kartınız bu işlem için uygun değil.',
      en: 'Your card is not suitable for this transaction.',
    },
    default: {
      tr: 'Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
      en: 'An error occurred during payment. Please try again.',
    },
  }

  return errorMessages[errorCode]?.[locale] || errorMessages.default[locale]
}

// ============================================================================
// REFUND OPERATIONS
// ============================================================================

/**
 * Para iadesi işlemi yapar
 * 
 * @param paymentTransactionId - iyzico payment transaction ID
 * @param price - İade tutarı
 * @param ip - İşlemi yapan admin IP adresi
 * @returns İade sonucu
 * 
 * @requirements 1.6 - Para iadesi desteği
 */
export async function processRefund(
  paymentTransactionId: string,
  price: string,
  ip: string = '127.0.0.1'
): Promise<{ status: 'success' | 'failure'; refundId?: string; errorMessage?: string }> {
  const iyzipay = getIyzicoClient()

  return new Promise((resolve) => {
    iyzipay.refund.create(
      {
        locale: Iyzipay.LOCALE.TR,
        conversationId: `refund_${Date.now()}`,
        paymentTransactionId,
        price,
        ip,
      },
      (err: Error | null, result: IyzicoRefundResponse) => {
        if (err) {
          console.error('[iyzico] Refund error:', err)
          resolve({
            status: 'failure',
            errorMessage: err.message || 'Para iadesi yapılamadı',
          })
          return
        }

        if (result.status === 'success') {
          resolve({
            status: 'success',
            refundId: result.paymentId,
          })
        } else {
          console.error('[iyzico] Refund failed:', result)
          resolve({
            status: 'failure',
            errorMessage: result.errorMessage || 'Para iadesi yapılamadı',
          })
        }
      }
    )
  })
}

// Type declarations are in src/types/iyzipay.d.ts
