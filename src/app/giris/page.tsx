'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { trustDevice, generateDeviceFingerprint } from '@/lib/auth/trusted-devices'
import { logSecurityEvent, getBrowserInfo, getClientIP } from '@/lib/auth/security-notifications'
import { getDeviceType } from '@/lib/auth/webauthn'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const { signIn, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      
      // Auth context'ten user bilgisini al
      const { user } = useAuth()
      if (!user) throw new Error('Kullanıcı bilgisi alınamadı')

      // Cihaz bilgilerini al
      const browserInfo = getBrowserInfo()
      const ip = await getClientIP()
      const deviceType = getDeviceType()

      // Güvenlik olayını kaydet
      await logSecurityEvent(user.uid, 'login', {
        type: deviceType,
        browser: browserInfo.browser,
        os: browserInfo.os,
        ip,
      })

      // Trusted device olarak kaydet
      if (rememberDevice) {
        await trustDevice(
          user.uid,
          {
            userAgent: navigator.userAgent,
            ip,
            location: undefined,
          },
          `${deviceType} - ${browserInfo.browser}`
        )
      }

      router.push('/')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Giriş yapılırken bir hata oluştu'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)

    try {
      await signInWithGoogle()
      
      // Auth context'ten user bilgisini al
      const { user } = useAuth()
      if (!user) throw new Error('Kullanıcı bilgisi alınamadı')

      // Cihaz bilgilerini al
      const browserInfo = getBrowserInfo()
      const ip = await getClientIP()
      const deviceType = getDeviceType()

      // Güvenlik olayını kaydet
      await logSecurityEvent(user.uid, 'login', {
        type: deviceType,
        browser: browserInfo.browser,
        os: browserInfo.os,
        ip,
      })

      // Trusted device olarak kaydet
      if (rememberDevice) {
        await trustDevice(
          user.uid,
          {
            userAgent: navigator.userAgent,
            ip,
            location: undefined,
          },
          `${deviceType} - ${browserInfo.browser}`
        )
      }

      router.push('/')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Google ile giriş yapılırken bir hata oluştu'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Rimora
            </h1>
            <p className="text-muted-foreground mt-2">{t('auth.login')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Giriş formu">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary"
                required
                aria-required="true"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary"
                required
                aria-required="true"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="rememberDevice"
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="rememberDevice" className="text-sm cursor-pointer">
                  Bu cihazı hatırla
                </label>
              </div>
              
              <Link href="/sifremi-unuttum" className="text-sm text-primary hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading} aria-label="Giriş yap">
              {loading ? (
                <Icons.spinner className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-muted-foreground">
                {t('auth.orContinueWith')}
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
            aria-label="Google ile giriş yap"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google {t('auth.loginWith')}
          </Button>

          {/* Register Link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('auth.noAccount')}{' '}
            <Link href="/kayit" className="text-primary hover:underline font-medium">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
