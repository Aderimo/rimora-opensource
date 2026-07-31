'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
      addToast('Şifre sıfırlama e-postası gönderildi', 'success')
    } catch (error: unknown) {
      let message = 'Bir hata oluştu'
      if (error instanceof Error) {
        if (error.message.includes('auth/user-not-found')) {
          message = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı'
        } else if (error.message.includes('auth/invalid-email')) {
          message = 'Geçersiz e-posta adresi'
        }
      }
      addToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <span className="text-3xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 bg-clip-text text-transparent">
                Rimora
              </span>
            </Link>
            <h1 className="text-2xl font-bold mb-2">Şifremi Unuttum</h1>
            <p className="text-muted-foreground">
              E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Icons.check className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-lg font-semibold">E-posta Gönderildi!</h2>
              <p className="text-muted-foreground text-sm">
                <strong>{email}</strong> adresine şifre sıfırlama bağlantısı gönderdik. 
                Lütfen gelen kutunuzu kontrol edin.
              </p>
              <div className="pt-4">
                <Link href="/giris">
                  <Button className="w-full">Giriş Sayfasına Dön</Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">E-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="w-full h-11 px-4 rounded-lg bg-muted border-0 focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <Icons.spinner className="h-5 w-5 animate-spin" />
                ) : (
                  'Şifre Sıfırlama Bağlantısı Gönder'
                )}
              </Button>

              <div className="text-center pt-4">
                <Link href="/giris" className="text-sm text-primary hover:underline">
                  Giriş sayfasına dön
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
