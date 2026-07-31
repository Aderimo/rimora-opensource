/**
 * Payment Callback API Endpoint
 * 
 * iyzico 3D Secure işlemi sonrası callback endpoint'i
 * Kullanıcıyı ödeme sonuç sayfasına yönlendirir
 * 
 * @requirements 2.1 - 3D Secure işlemi sonrası callback handling
 * @requirements 2.2 - Ödeme sonucu kullanıcıya gösterilmeli
 */

import { NextRequest, NextResponse } from 'next/server'
import { retrieveCheckoutFormResult } from '@/lib/payment/iyzico'

/**
 * GET /api/payment/callback
 * 
 * iyzico 3D Secure işlemi sonrası callback
 * Kullanıcıyı ödeme sonuç sayfasına yönlendirir
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  
  // Token kontrolü
  if (!token) {
    console.error('Payment callback: Missing token')
    return NextResponse.redirect(
      new URL('/odeme/sonuc?status=error&message=Geçersiz ödeme token', request.url)
    )
  }
  
  try {
    // iyzico'dan ödeme sonucunu al
    const result = await retrieveCheckoutFormResult(token)
    
    if (result.status === 'success') {
      // Başarılı ödeme - success sayfasına yönlendir
      const params = new URLSearchParams({
        status: 'success',
        plan: result.plan || 'standard',
        cycle: result.billingCycle || 'monthly',
        amount: result.price?.toString() || '0',
        paymentId: result.paymentId
      })
      
      return NextResponse.redirect(
        new URL(`/odeme/sonuc?${params.toString()}`, request.url)
      )
    } else {
      // Başarısız ödeme - error sayfasına yönlendir
      const params = new URLSearchParams({
        status: 'error',
        message: result.errorMessage || 'Ödeme işlemi başarısız',
        errorCode: result.errorMessage?.includes('10051') ? '10051' :
                   result.errorMessage?.includes('10005') ? '10005' :
                   result.errorMessage?.includes('10012') ? '10012' : 'PAYMENT_FAILED'
      })
      
      return NextResponse.redirect(
        new URL(`/odeme/sonuc?${params.toString()}`, request.url)
      )
    }
  } catch (error) {
    console.error('Payment callback error:', error)
    
    return NextResponse.redirect(
      new URL('/odeme/sonuc?status=error&message=Ödeme sonucu alınamadı&errorCode=CALLBACK_ERROR', request.url)
    )
  }
}

/**
 * POST /api/payment/callback
 * 
 * iyzico webhook bildirimi (alternatif endpoint)
 * Ana webhook endpoint /api/payment/webhook'dir
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Webhook işlemlerini ana webhook endpoint'ine yönlendir
  return NextResponse.redirect(new URL('/api/payment/webhook', request.url), 307)
}