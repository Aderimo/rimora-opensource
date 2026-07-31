'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'

export default function PrivacySettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  const [settings, setSettings] = useState({
    profilePublic: true,
    showWatchHistory: true,
    showFavorites: true,
    allowMessages: true,
    showOnlineStatus: true,
    allowFollowers: true,
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/giris')
    }
  }, [user, loading, router])

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link href="/ayarlar" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <Icons.chevronLeft className="h-4 w-4" />
          Ayarlara Dön
        </Link>

        <h1 className="text-2xl font-bold mb-8">Gizlilik Ayarları</h1>

        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
          <PrivacyToggle
            title="Profil Herkese Açık"
            description="Profilinizi herkes görebilir"
            enabled={settings.profilePublic}
            onToggle={() => toggleSetting('profilePublic')}
          />
          <PrivacyToggle
            title="İzleme Geçmişi"
            description="İzleme geçmişinizi profilinizde göster"
            enabled={settings.showWatchHistory}
            onToggle={() => toggleSetting('showWatchHistory')}
          />
          <PrivacyToggle
            title="Favoriler"
            description="Favori listelerinizi profilinizde göster"
            enabled={settings.showFavorites}
            onToggle={() => toggleSetting('showFavorites')}
          />
          <PrivacyToggle
            title="Mesajlara İzin Ver"
            description="Diğer kullanıcılar size mesaj gönderebilir"
            enabled={settings.allowMessages}
            onToggle={() => toggleSetting('allowMessages')}
          />
          <PrivacyToggle
            title="Çevrimiçi Durumu"
            description="Çevrimiçi olduğunuzda diğerleri görebilir"
            enabled={settings.showOnlineStatus}
            onToggle={() => toggleSetting('showOnlineStatus')}
          />
          <PrivacyToggle
            title="Takipçilere İzin Ver"
            description="Diğer kullanıcılar sizi takip edebilir"
            enabled={settings.allowFollowers}
            onToggle={() => toggleSetting('allowFollowers')}
          />
        </div>

        <div className="mt-6">
          <Button className="w-full">Değişiklikleri Kaydet</Button>
        </div>
      </div>
    </div>
  )
}

function PrivacyToggle({ title, description, enabled, onToggle }: {
  title: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </button>
    </div>
  )
}
