'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useSettings } from '@/contexts/settings-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const { showAdultContent, setShowAdultContent } = useSettings()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/giris')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const settingsGroups = [
    {
      title: 'Hesap',
      items: [
        { type: 'link', href: '/ayarlar/hesap', icon: Icons.user, label: 'Hesap Ayarları', desc: 'E-posta, şifre ve abonelik' },
        { type: 'link', href: '/ayarlar/gizlilik', icon: Icons.shield, label: 'Gizlilik', desc: 'Profil görünürlüğü ve izinler' },
      ]
    },
    {
      title: 'İçerik Tercihleri',
      items: [
        {
          type: 'switch',
          icon: Icons.eye,
          label: '+18 İçerikleri Göster',
          desc: 'Arama ve keşfet sayfasında yetişkin içerikleri göster',
          checked: showAdultContent,
          onChange: setShowAdultContent
        },
      ]
    },
    {
      title: 'Tercihler',
      items: [
        { type: 'link', href: '/ayarlar/bildirimler', icon: Icons.bell, label: 'Bildirimler', desc: 'Push ve e-posta bildirimleri' },
      ]
    },
    {
      title: 'Abonelik',
      items: [
        { type: 'link', href: '/abonelik', icon: Icons.star, label: 'Premium', desc: 'Abonelik planları ve özellikler' },
      ]
    },
  ]

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <Icons.chevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Ayarlar</h1>
            <p className="text-muted-foreground">Hesap ve uygulama ayarlarınızı yönetin</p>
          </div>
        </div>

        {/* Settings Groups */}
        <div className="space-y-8">
          {settingsGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                {group.title}
              </h2>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {group.items.map((item: any, index: number) => {
                  const Icon = item.icon

                  if (item.type === 'switch') {
                    return (
                      <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                        <Switch
                          checked={item.checked}
                          onCheckedChange={item.onChange}
                        />
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                      <Icons.chevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* App Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Rimora v1.0.0</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link href="/gizlilik-politikasi" className="hover:text-foreground">Gizlilik Politikası</Link>
            <Link href="/kullanim-sartlari" className="hover:text-foreground">Kullanım Şartları</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
