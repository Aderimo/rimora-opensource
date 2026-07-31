'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getUserSubscription, type Subscription } from '@/lib/subscription'

export default function AccountSettingsPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/giris')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      getUserSubscription(user.uid)
        .then(setSubscription)
        .finally(() => setSubLoading(false))
    }
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const planNames: Record<string, string> = { free: 'Ücretsiz', standard: 'Standart', premium: 'Premium', family: 'Aile' }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link href="/ayarlar" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <Icons.chevronLeft className="h-4 w-4" />
          Ayarlara Dön
        </Link>

        <h1 className="text-2xl font-bold mb-8">Hesap Ayarları</h1>

        {/* Account Info */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Hesap Bilgileri</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm text-muted-foreground">E-posta</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <Button variant="outline" size="sm">Değiştir</Button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm text-muted-foreground">Kullanıcı Adı</p>
                <p className="font-medium">{userProfile?.displayName || 'Belirlenmemiş'}</p>
              </div>
              <Link href="/profil">
                <Button variant="outline" size="sm">Düzenle</Button>
              </Link>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-muted-foreground">Şifre</p>
                <p className="font-medium">••••••••</p>
              </div>
              <Button variant="outline" size="sm">Değiştir</Button>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Abonelik</h2>
          {subLoading ? (
            <div className="flex justify-center py-4">
              <Icons.spinner className="h-6 w-6 animate-spin" />
            </div>
          ) : subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{planNames[subscription.plan || 'free']} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.status === 'active' ? 'Aktif' : 'Pasif'} •
                    {subscription.endDate.toLocaleDateString('tr-TR')} tarihine kadar
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${subscription.plan === 'premium' ? 'bg-primary/20 text-primary' :
                  subscription.plan === 'family' ? 'bg-purple-500/20 text-purple-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                  {planNames[subscription.plan || 'free']}
                </span>
              </div>
              <div className="flex gap-2">
                <Link href="/abonelik">
                  <Button variant="outline" size="sm">Planı Değiştir</Button>
                </Link>
                {subscription.autoRenew && (
                  <Button variant="ghost" size="sm" className="text-red-500">İptal Et</Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Henüz bir aboneliğiniz yok</p>
              <Link href="/abonelik">
                <Button>Premium'a Geç</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-red-500 mb-4">Tehlikeli Bölge</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinir ve geri alınamaz.
          </p>
          <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10">
            Hesabı Sil
          </Button>
        </div>
      </div>
    </div>
  )
}
