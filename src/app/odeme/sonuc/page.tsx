'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import confetti from 'canvas-confetti'

/**
 * Ödeme Sonuç Sayfası
 * 
 * @requirements 2.2 - Ödeme sonucu kullanıcıya gösterilmeli
 * @requirements 2.4 - Başarısız ödeme için açıklayıcı hata mesajı
 */

const PLAN_NAMES = {
  standard: 'Standart',
  premium: 'Premium', 
  family: 'Aile'
}

const ERROR_MESSAGES: Record<string, string> = {
  '10051': 'Kartınızda yeterli bakiye bulunmamaktadır.',
  '10005': 'İşlem onaylanmadı. Lütfen bankanızla iletişime geçin.',
  '10012': 'Geçersiz kart numarası.',
  '10034': 'Kart bilgileri hatalı.',
  '10057': 'Kart sahibi bu işlemi yapamaz.',
  '10058': 'Kartınız bu işlem için uygun değil.',
  'PAYMENT_FAILED': 'Ödeme işlemi başarısız oldu.',
  'CALLBACK_ERROR': 'Ödeme sonucu alınamadı.',
  'DEFAULT': 'Ödeme işlemi sırasında bir hata oluştu.'
}

export default function PaymentResultPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showConfetti, setShowConfetti] = useState(false)
  
  const status = searchParams.get('status') // 'success' | 'error'
  const plan = searchParams.get('plan') as keyof typeof PLAN_NAMES
  const cycle = searchParams.get('cycle') // 'monthly' | 'yearly'
  const amount = searchParams.get('amount')
  const paymentId = searchParams.get('paymentId')
  const errorMessage = searchParams.get('message')
  const errorCode = searchParams.get('errorCode')

  // Auth kontrolü
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/giris')
    }
  }, [user, authLoading, router])

  // Başarılı ödeme için confetti efekti
  useEffect(() => {
    if (status === 'success' && !showConfetti) {
      setShowConfetti(true)
      
      // Confetti animasyonu
      const duration = 3000
      const end = Date.now() + duration

      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']

      ;(function frame() {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        })
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      })()
    }
  }, [status, showConfetti])

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isSuccess = status === 'success'
  const planName = plan ? PLAN_NAMES[plan] : 'Bilinmeyen'
  const cycleText = cycle === 'yearly' ? 'Yıllık' : 'Aylık'
  const formattedAmount = amount ? `₺${parseFloat(amount).toFixed(2)}` : ''

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center">
          {isSuccess ? (
            <>
              {/* Başarılı Ödeme */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                  <Icons.check className="h-10 w-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-green-600 mb-2">
                  Ödeme Başarılı!
                </h1>
                <p className="text-lg text-muted-foreground">
                  Rimora {planName} aboneliğiniz aktif edildi
                </p>
              </div>

              {/* Ödeme Detayları */}
              <div className="bg-card border border-border rounded-2xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Ödeme Detayları</h2>
                <div className="space-y-3 text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="font-medium">Rimora {planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dönem:</span>
                    <span className="font-medium">{cycleText}</span>
                  </div>
                  {formattedAmount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tutar:</span>
                      <span className="font-medium">{formattedAmount}</span>
                    </div>
                  )}
                  {paymentId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">İşlem No:</span>
                      <span className="font-mono text-sm">{paymentId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bilgilendirme */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <Icons.info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-blue-900">Aboneliğiniz Aktif</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Artık Rimora'nın tüm premium özelliklerinden yararlanabilirsiniz. 
                      Fatura e-posta adresinize gönderilecektir.
                    </p>
                  </div>
                </div>
              </div>

              {/* Eylem Butonları */}
              <div className="space-y-3">
                <Link href="/">
                  <Button size="lg" className="w-full">
                    <Icons.home className="h-5 w-5 mr-2" />
                    Ana Sayfaya Git
                  </Button>
                </Link>
                <Link href="/profil">
                  <Button variant="outline" size="lg" className="w-full">
                    <Icons.user className="h-5 w-5 mr-2" />
                    Profilimi Görüntüle
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Başarısız Ödeme */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                  <Icons.x className="h-10 w-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-red-600 mb-2">
                  Ödeme Başarısız
                </h1>
                <p className="text-lg text-muted-foreground">
                  Ödeme işlemi tamamlanamadı
                </p>
              </div>

              {/* Hata Mesajı */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
                <div className="flex items-start gap-3">
                  <Icons.alertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-red-900">Hata Detayı</p>
                    <p className="text-sm text-red-700 mt-1">
                      {errorCode && ERROR_MESSAGES[errorCode] 
                        ? ERROR_MESSAGES[errorCode]
                        : errorMessage || ERROR_MESSAGES.DEFAULT
                      }
                    </p>
                    {errorCode && (
                      <p className="text-xs text-red-600 mt-2">
                        Hata Kodu: {errorCode}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Çözüm Önerileri */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <Icons.lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-blue-900">Çözüm Önerileri</p>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Kart bilgilerinizi kontrol edin</li>
                      <li>• Kartınızda yeterli bakiye olduğundan emin olun</li>
                      <li>• İnternet bankacılığından kartınızın online ödemelere açık olduğunu kontrol edin</li>
                      <li>• Farklı bir kart ile deneyebilirsiniz</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Eylem Butonları */}
              <div className="space-y-3">
                <Link href="/odeme">
                  <Button size="lg" className="w-full">
                    <Icons.creditCard className="h-5 w-5 mr-2" />
                    Tekrar Dene
                  </Button>
                </Link>
                <Link href="/abonelik">
                  <Button variant="outline" size="lg" className="w-full">
                    <Icons.chevronLeft className="h-5 w-5 mr-2" />
                    Planlara Dön
                  </Button>
                </Link>
              </div>

              {/* Destek */}
              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Sorun devam ediyorsa bizimle iletişime geçin
                </p>
                <Link href="/iletisim">
                  <Button variant="ghost" size="sm">
                    <Icons.mail className="h-4 w-4 mr-2" />
                    Destek Ekibi
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}