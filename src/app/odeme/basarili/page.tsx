'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function PaymentSuccessPage() {
  useEffect(() => {
    // Konfeti efekti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })
  }, [])

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
          <Icons.check className="h-10 w-10 text-green-500" />
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Ödeme Başarılı!</h1>
        
        <p className="text-muted-foreground mb-8">
          Rimora Premium'a hoş geldiniz! Artık tüm premium özelliklere erişebilirsiniz.
        </p>

        <div className="space-y-3">
          <Link href="/">
            <Button size="lg" className="w-full">
              <Icons.play className="h-5 w-5 mr-2" />
              İzlemeye Başla
            </Button>
          </Link>
          
          <Link href="/profil">
            <Button variant="outline" size="lg" className="w-full">
              Profilime Git
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          Fatura bilgileriniz e-posta adresinize gönderildi.
        </p>
      </div>
    </div>
  )
}
