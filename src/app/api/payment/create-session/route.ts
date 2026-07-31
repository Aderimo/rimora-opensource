/**
 * Payment Create Session API Endpoint
 * 
 * iyzico checkout form başlatma endpoint'i
 * 3D Secure destekli ödeme formu oluşturur
 * 
 * @requirements 1.1 - 3D Secure destekli ödeme
 * @requirements 1.2 - /api/payment/create-session endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  initializeCheckoutForm, 
  CreatePaymentRequest,
  CheckoutFormResult,
  getPlanPrice,
  PLAN_PRICES
} from '@/lib/payment/iyzico'

/**
 * Request body interface
 */
interface CreateSessionRequest {
  userId: string
  plan: 'standard' | 'premium' | 'family'
  billingCycle: 'monthly' | 'yearly'
  locale: 'tr' | 'en'
  // Buyer info
  name: string
  surname: string
  email: string
  phone?: string
  identityNumber?: string
  city?: string
  country?: string
  address?: string
}

/**
 * Response interface
 */
interface CreateSessionResponse {
  success: boolean
  checkoutFormContent?: string
  token?: string
  paymentPageUrl?: string
  price?: number
  error?: string
  errorCode?: string
}

/**
 * Validate request body
 */
function validateRequest(body: Partial<CreateSessionRequest>): { valid: boolean; error?: string } {
  if (!body.userId || typeof body.userId !== 'string') {
    return { valid: false, error: 'userId gerekli' }
  }
  
  if (!body.plan || !['standard', 'premium', 'family'].includes(body.plan)) {
    return { valid: false, error: 'Geçersiz plan. standard, premium veya family olmalı' }
  }
  
  if (!body.billingCycle || !['monthly', 'yearly'].includes(body.billingCycle)) {
    return { valid: false, error: 'Geçersiz fatura dönemi. monthly veya yearly olmalı' }
  }
  
  if (!body.locale || !['tr', 'en'].includes(body.locale)) {
    return { valid: false, error: 'Geçersiz dil. tr veya en olmalı' }
  }
  
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
    return { valid: false, error: 'İsim gerekli (en az 2 karakter)' }
  }
  
  if (!body.surname || typeof body.surname !== 'string' || body.surname.trim().length < 2) {
    return { valid: false, error: 'Soyisim gerekli (en az 2 karakter)' }
  }
  
  if (!body.email || typeof body.email !== 'string' || !isValidEmail(body.email)) {
    return { valid: false, error: 'Geçerli bir e-posta adresi gerekli' }
  }
  
  return { valid: true }
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Fallback
  return '127.0.0.1'
}

/**
 * Generate callback URL
 */
function getCallbackUrl(request: NextRequest): string {
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${protocol}://${host}/api/payment/callback`
}

/**
 * POST /api/payment/create-session
 * 
 * iyzico checkout form başlatır ve 3D Secure destekli ödeme formu döndürür
 */
export async function POST(request: NextRequest): Promise<NextResponse<CreateSessionResponse>> {
  try {
    // Parse request body
    let body: Partial<CreateSessionRequest>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Geçersiz JSON formatı', errorCode: 'INVALID_JSON' },
        { status: 400 }
      )
    }
    
    // Validate request
    const validation = validateRequest(body)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, errorCode: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    
    const validatedBody = body as CreateSessionRequest
    
    // Get client IP
    const clientIP = getClientIP(request)
    
    // Get callback URL
    const callbackUrl = getCallbackUrl(request)
    
    // Prepare payment request
    const paymentRequest: CreatePaymentRequest = {
      userId: validatedBody.userId,
      plan: validatedBody.plan,
      billingCycle: validatedBody.billingCycle,
      locale: validatedBody.locale,
      callbackUrl,
    }
    
    // Prepare buyer info
    const buyerInfo = {
      id: validatedBody.userId,
      name: validatedBody.name.trim(),
      surname: validatedBody.surname.trim(),
      email: validatedBody.email.trim().toLowerCase(),
      phone: validatedBody.phone?.trim(),
      identityNumber: validatedBody.identityNumber?.trim(),
      ip: clientIP,
      city: validatedBody.city?.trim(),
      country: validatedBody.country?.trim(),
      address: validatedBody.address?.trim(),
    }
    
    // Initialize checkout form with iyzico
    const result: CheckoutFormResult = await initializeCheckoutForm(paymentRequest, buyerInfo)
    
    if (result.status === 'success') {
      const price = getPlanPrice(validatedBody.plan, validatedBody.billingCycle)
      
      return NextResponse.json({
        success: true,
        checkoutFormContent: result.checkoutFormContent,
        token: result.token,
        paymentPageUrl: result.paymentPageUrl,
        price,
      })
    } else {
      // Log error for debugging (server-side only)
      console.error('iyzico checkout form error:', {
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        userId: validatedBody.userId,
        plan: validatedBody.plan,
      })
      
      return NextResponse.json(
        {
          success: false,
          error: result.errorMessage || 'Ödeme formu oluşturulamadı',
          errorCode: result.errorCode || 'CHECKOUT_ERROR',
        },
        { status: 400 }
      )
    }
  } catch (error) {
    // Log unexpected errors
    console.error('Payment create-session unexpected error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}

/**
 * GET method not allowed
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed', errorCode: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  )
}
