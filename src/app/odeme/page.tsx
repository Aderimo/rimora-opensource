'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Ödeme Sayfası - iyzico 3D Secure Entegrasyonu
 * 
 * @requirements 1.1 - 3D Secure destekli ödeme formu göstermeli
 * @requirements 1.8 - Ödeme başarısız olduğunda kullanıcıya anlaşılır hata mesajı göstermeli
 */

const PLAN_DETAILS = {
  standard: { name: 'Standart', monthlyPrice: 49.99, yearlyPrice: 479.99 },
  premium: { name: 'Premium', monthlyPrice: 79.99, yearlyPrice: 767.99 },
  family: { name: 'Aile', monthlyPrice: 119.99, yearlyPrice: 1151.99 },
}

// Hata mesajları - Requirement 1.8
const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Lütfen tüm alanları doğru şekilde doldurun.',
  INVALID_JSON: 'Geçersiz istek formatı. Lütfen sayfayı yenileyip tekrar deneyin.',
  CHECKOUT_ERROR: 'Ödeme formu oluşturulamadı. Lütfen daha sonra tekrar deneyin.',
  CHECKOUT_INIT_ERROR: 'Ödeme sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
  INVALID_PLAN: 'Geçersiz abonelik planı seçildi.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
  NETWORK_ERROR: 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
  '10051': 'Kartınızda yeterli bakiye bulunmamaktadır.',
  '10005': 'İşlem onaylanmadı. Lütfen bankanızla iletişime geçin.',
  '10012': 'Geçersiz kart numarası.',
  '10034': 'Kart bilgileri hatalı.',
  '10057': 'Kart sahibi bu işlemi yapamaz.',
  '10058': 'Kartınız bu işlem için uygun değil.',
  DEFAULT: 'Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
}

function getErrorMessage(errorCode?: string): string {
  if (!errorCode) return ERROR_MESSAGES.DEFAULT
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DEFAULT
}

interface PaymentFormData {
  name: string
  surname: string
  email: string
  phone: string
}

export default function PaymentPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkoutFormRef = useRef<HTMLDivElement>(null)
  
  const planId = searchParams.get('plan') as keyof typeof PLAN_DETAILS
  const cycle = searchParams.get('cycle') as 'monthly' | 'yearly'
  
  // Form state
  const [formData, setFormData] = useState<PaymentFormData>({
    name: '',
    surname: '',
    email: '',
    phone: '',
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  // UI state
  const [step, setStep] = useState<'info' | 'payment'>('info')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutFormContent, setCheckoutFormContent] = useState<string | null>(null)

  // Kullanıcı bilgilerini form'a doldur
  useEffect(() => {
    if (userProfile) {
      const nameParts = (userProfile.displayName || '').split(' ')
      setFormData(prev => ({
        ...prev,
        name: nameParts[0] || '',
        surname: nameParts.slice(1).join(' ') || '',
        email: userProfile.email || '',
      }))
    }
  }, [userProfile])

  // Auth kontrolü
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/giris?redirect=/odeme')
    }
  }, [user, authLoading, router])

  // Geçersiz plan kontrolü
  if (!planId || !PLAN_DETAILS[planId]) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <Icons.info className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Geçersiz Plan</h1>
          <p className="text-muted-foreground mb-4">Lütfen bir plan seçin</p>
          <Link href="/abonelik">
            <Button>Planlara Git</Button>
          </Link>
        </div>
      </div>
    )
  }

  const plan = PLAN_DETAILS[planId]
  const price = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
  const periodText = cycle === 'yearly' ? 'yıllık' : 'aylık'

  // Form validation
  const isFormValid = () => {
    return (
      formData.name.trim().length >= 2 &&
      formData.surname.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      agreedToTerms
    )
  }

  // iyzico checkout form başlatma - Requirement 1.1, 1.2
  const initializePayment = async () => {
    if (!user || !isFormValid()) return

    setProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/payment/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          plan: planId,
          billingCycle: cycle || 'monthly',
          locale: 'tr',
          name: formData.name.trim(),
          surname: formData.surname.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success && data.checkoutFormContent) {
        setCheckoutFormContent(data.checkoutFormContent)
        setStep('payment')
      } else {
        // Requirement 1.8 - Anlaşılır hata mesajı
        setError(getErrorMessage(data.errorCode))
      }
    } catch (err) {
      console.error('Payment initialization error:', err)
      setError(getErrorMessage('NETWORK_ERROR'))
    } finally {
      setProcessing(false)
    }
  }

  // iyzico checkout form'u render et
  useEffect(() => {
    if (checkoutFormContent && checkoutFormRef.current) {
      // iyzico checkout form HTML'ini inject et
      checkoutFormRef.current.innerHTML = checkoutFormContent
      
      // Script'leri çalıştır
      const scripts = checkoutFormRef.current.querySelectorAll('script')
      scripts.forEach((script) => {
        const newScript = document.createElement('script')
        if (script.src) {
          newScript.src = script.src
        } else {
          newScript.textContent = script.textContent
        }
        document.body.appendChild(newScript)
      })
    }
  }, [checkoutFormContent])

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null) // Clear error on input change
  }

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await initializePayment()
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <Link 
          href="/abonelik" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8"
        >
          <Icons.chevronLeft className="h-4 w-4" />
          Planlara Dön
        </Link>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Payment Form / iyzico Checkout */}
          <div className="md:col-span-3">
            {step === 'info' ? (
              <>
                <h1 className="text-2xl font-bold mb-6">Ödeme Bilgileri</h1>

                {/* Error Message - Requirement 1.8 */}
                {error && (
                  <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Icons.alertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Ödeme Hatası</p>
                        <p className="text-sm text-destructive/80 mt-1">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3D Secure Info Banner */}
                <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Icons.shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-primary">3D Secure Güvenli Ödeme</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ödemeniz iyzico altyapısı ile 3D Secure teknolojisi kullanılarak güvenle işlenir.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Ad <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Adınız"
                      className={cn(
                        "w-full h-12 px-4 rounded-xl bg-muted border focus:outline-none transition-colors",
                        formData.name.trim().length > 0 && formData.name.trim().length < 2
                          ? "border-destructive focus:border-destructive"
                          : "border-border focus:border-primary"
                      )}
                      required
                      minLength={2}
                    />
                    {formData.name.trim().length > 0 && formData.name.trim().length < 2 && (
                      <p className="text-xs text-destructive mt-1">Ad en az 2 karakter olmalıdır</p>
                    )}
                  </div>

                  {/* Surname */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Soyad <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="surname"
                      value={formData.surname}
                      onChange={handleInputChange}
                      placeholder="Soyadınız"
                      className={cn(
                        "w-full h-12 px-4 rounded-xl bg-muted border focus:outline-none transition-colors",
                        formData.surname.trim().length > 0 && formData.surname.trim().length < 2
                          ? "border-destructive focus:border-destructive"
                          : "border-border focus:border-primary"
                      )}
                      required
                      minLength={2}
                    />
                    {formData.surname.trim().length > 0 && formData.surname.trim().length < 2 && (
                      <p className="text-xs text-destructive mt-1">Soyad en az 2 karakter olmalıdır</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      E-posta <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="ornek@email.com"
                      className={cn(
                        "w-full h-12 px-4 rounded-xl bg-muted border focus:outline-none transition-colors",
                        formData.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
                          ? "border-destructive focus:border-destructive"
                          : "border-border focus:border-primary"
                      )}
                      required
                    />
                    {formData.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                      <p className="text-xs text-destructive mt-1">Geçerli bir e-posta adresi girin</p>
                    )}
                  </div>

                  {/* Phone (Optional) */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Telefon <span className="text-muted-foreground text-xs">(Opsiyonel)</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+90 5XX XXX XX XX"
                      className="w-full h-12 px-4 rounded-xl bg-muted border border-border focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Terms */}
                  <label className="flex items-start gap-3 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                      <Link href="/kullanim-kosullari" className="text-primary hover:underline">
                        Kullanım Koşulları
                      </Link>
                      {' '}ve{' '}
                      <Link href="/gizlilik" className="text-primary hover:underline">
                        Gizlilik Politikası
                      </Link>
                      'nı okudum ve kabul ediyorum.
                    </span>
                  </label>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 text-lg mt-6"
                    disabled={processing || !isFormValid()}
                  >
                    {processing ? (
                      <>
                        <Icons.spinner className="h-5 w-5 mr-2 animate-spin" />
                        Ödeme Formu Hazırlanıyor...
                      </>
                    ) : (
                      <>
                        <Icons.creditCard className="h-5 w-5 mr-2" />
                        Ödemeye Devam Et
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    <Icons.shield className="h-3 w-3 inline mr-1" />
                    256-bit SSL ile güvenli ödeme • iyzico altyapısı
                  </p>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold">Kart Bilgileri</h1>
                  <button
                    onClick={() => {
                      setStep('info')
                      setCheckoutFormContent(null)
                      setError(null)
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Icons.chevronLeft className="h-4 w-4" />
                    Geri
                  </button>
                </div>

                {/* 3D Secure Info */}
                <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Icons.shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-primary">3D Secure Doğrulama</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Kart bilgilerinizi girdikten sonra bankanızın 3D Secure doğrulama sayfasına yönlendirileceksiniz.
                      </p>
                    </div>
                  </div>
                </div>

                {/* iyzico Checkout Form Container - Requirement 1.1 */}
                <div 
                  ref={checkoutFormRef}
                  id="iyzico-checkout-form"
                  className="min-h-[400px] bg-card border border-border rounded-xl p-4"
                >
                  {/* iyzico checkout form will be injected here */}
                  <div className="flex items-center justify-center h-[400px]">
                    <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
                  </div>
                </div>

                <p className="text-xs text-center text-muted-foreground mt-4">
                  <Icons.shield className="h-3 w-3 inline mr-1" />
                  Ödemeniz iyzico güvenli ödeme altyapısı ile işlenmektedir
                </p>
              </>
            )}
          </div>

          {/* Order Summary */}
          <div className="md:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
              <h2 className="text-lg font-bold mb-4">Sipariş Özeti</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dönem</span>
                  <span className="font-medium capitalize">{periodText}</span>
                </div>
                {cycle === 'yearly' && (
                  <div className="flex justify-between text-green-500">
                    <span>Tasarruf</span>
                    <span className="font-medium">
                      ₺{((plan.monthlyPrice * 12) - plan.yearlyPrice).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-bold">Toplam</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold">₺{price.toFixed(2)}</span>
                    <span className="text-muted-foreground text-sm">/{cycle === 'yearly' ? 'yıl' : 'ay'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-start gap-3">
                    <Icons.check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">30 Gün Para İade Garantisi</p>
                      <p className="text-muted-foreground">Memnun kalmazsanız ilk 30 gün içinde tam iade.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-start gap-3">
                    <Icons.shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Güvenli Ödeme</p>
                      <p className="text-muted-foreground">iyzico 3D Secure altyapısı ile güvenli ödeme.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Desteklenen Ödeme Yöntemleri</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 px-2 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs font-medium">VISA</span>
                  </div>
                  <div className="h-8 px-2 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs font-medium">MC</span>
                  </div>
                  <div className="h-8 px-2 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs font-medium">AMEX</span>
                  </div>
                  <div className="h-8 px-2 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs font-medium">TROY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
