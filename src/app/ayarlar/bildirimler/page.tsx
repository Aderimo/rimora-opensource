'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences 
} from '@/lib/push-notifications'
import { cn } from '@/lib/utils'

// Extended preferences with email notifications
interface ExtendedNotificationPreferences extends NotificationPreferences {
  emailNotifications: boolean
  systemNotifications: boolean
  followerNotifications: boolean
  // E-posta kategorileri
  emailWelcome: boolean
  emailSubscription: boolean
  emailWeeklyDigest: boolean
  emailPromotions: boolean
}

const DEFAULT_EXTENDED_PREFERENCES: ExtendedNotificationPreferences = {
  newEpisodes: true,
  newMovies: true,
  friendActivity: true,
  comments: true,
  messages: true,
  watchPartyInvites: true,
  emailNotifications: true,
  systemNotifications: true,
  followerNotifications: true,
  // E-posta kategorileri
  emailWelcome: true,
  emailSubscription: true,
  emailWeeklyDigest: true,
  emailPromotions: false,
}

// Notification categories for better organization
const notificationCategories = [
  {
    id: 'content',
    title: 'İçerik Bildirimleri',
    description: 'Yeni içerikler hakkında bildirimler',
    icon: Icons.film,
    options: [
      { 
        key: 'newEpisodes' as const, 
        title: 'Yeni Bölümler', 
        desc: 'Takip ettiğiniz dizilere yeni bölüm eklendiğinde',
        icon: Icons.tv 
      },
      { 
        key: 'newMovies' as const, 
        title: 'Yeni Filmler', 
        desc: 'İlginizi çekebilecek yeni filmler eklendiğinde',
        icon: Icons.film 
      },
    ]
  },
  {
    id: 'social',
    title: 'Sosyal Bildirimler',
    description: 'Arkadaşlar ve takipçiler hakkında bildirimler',
    icon: Icons.users,
    options: [
      { 
        key: 'friendActivity' as const, 
        title: 'Arkadaş Aktiviteleri', 
        desc: 'Arkadaşlarınız bir şey izlediğinde veya yorum yaptığında',
        icon: Icons.users 
      },
      { 
        key: 'followerNotifications' as const, 
        title: 'Takipçi Bildirimleri', 
        desc: 'Biri sizi takip etmeye başladığında',
        icon: Icons.userPlus 
      },
      { 
        key: 'watchPartyInvites' as const, 
        title: 'Birlikte İzle Davetleri', 
        desc: 'Birlikte izleme odasına davet edildiğinizde',
        icon: Icons.play 
      },
    ]
  },
  {
    id: 'communication',
    title: 'İletişim Bildirimleri',
    description: 'Mesajlar ve yorumlar hakkında bildirimler',
    icon: Icons.comment,
    options: [
      { 
        key: 'comments' as const, 
        title: 'Yorum Bildirimleri', 
        desc: 'Yorumlarınıza yanıt geldiğinde',
        icon: Icons.comment 
      },
      { 
        key: 'messages' as const, 
        title: 'Mesaj Bildirimleri', 
        desc: 'Yeni mesaj aldığınızda',
        icon: Icons.send 
      },
    ]
  },
  {
    id: 'system',
    title: 'Sistem Bildirimleri',
    description: 'Platform güncellemeleri ve duyurular',
    icon: Icons.settings,
    options: [
      { 
        key: 'systemNotifications' as const, 
        title: 'Sistem Duyuruları', 
        desc: 'Platform güncellemeleri ve önemli duyurular',
        icon: Icons.bell 
      },
    ]
  },
  {
    id: 'email',
    title: 'E-posta Bildirimleri',
    description: 'E-posta ile alacağınız bildirimler',
    icon: Icons.mail,
    options: [
      { 
        key: 'emailNotifications' as const, 
        title: 'E-posta Bildirimleri', 
        desc: 'Tüm e-posta bildirimlerini aç/kapat',
        icon: Icons.mail 
      },
      { 
        key: 'emailSubscription' as const, 
        title: 'Abonelik E-postaları', 
        desc: 'Abonelik onayı, iptal ve süre dolumu bildirimleri',
        icon: Icons.creditCard 
      },
      { 
        key: 'emailWeeklyDigest' as const, 
        title: 'Haftalık Özet', 
        desc: 'Haftanın en popüler içerikleri ve önerileri',
        icon: Icons.calendar 
      },
      { 
        key: 'emailPromotions' as const, 
        title: 'Promosyonlar', 
        desc: 'Özel teklifler ve kampanyalar',
        icon: Icons.gift 
      },
    ]
  },
]

export default function NotificationSettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [preferences, setPreferences] = useState<ExtendedNotificationPreferences>(DEFAULT_EXTENDED_PREFERENCES)

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    if (!user) return
    
    try {
      const prefs = await getNotificationPreferences(user.uid)
      setPreferences({
        ...DEFAULT_EXTENDED_PREFERENCES,
        ...prefs,
      })
      
      // Check push notification permission
      if ('Notification' in window) {
        const permission = Notification.permission
        setPushPermission(permission)
        setPushEnabled(permission === 'granted')
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      addToast('Ayarlar yüklenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }, [user, addToast])

  useEffect(() => {
    if (!user) {
      router.push('/giris')
      return
    }
    loadSettings()
  }, [user, router, loadSettings])

  // Handle push notification toggle
  const handleTogglePush = async () => {
    if (!user) return
    
    setSaving(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPushNotifications(user.uid)
        setPushEnabled(false)
        addToast('Push bildirimleri kapatıldı', 'success')
      } else {
        const success = await subscribeToPushNotifications(user.uid)
        if (success) {
          setPushEnabled(true)
          setPushPermission('granted')
          addToast('Push bildirimleri açıldı', 'success')
        } else {
          setPushPermission(Notification.permission)
          if (Notification.permission === 'denied') {
            addToast('Bildirim izni tarayıcı ayarlarından engellenmiş', 'error')
          } else {
            addToast('Bildirim izni reddedildi', 'error')
          }
        }
      }
    } catch (error) {
      console.error('Push toggle error:', error)
      addToast('Bir hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle preference toggle with immediate Firestore save
  const handleTogglePreference = async (key: keyof ExtendedNotificationPreferences) => {
    if (!user) return
    
    const newValue = !preferences[key]
    const newPrefs = { ...preferences, [key]: newValue }
    
    // Optimistic update
    setPreferences(newPrefs)
    
    try {
      await saveNotificationPreferences(user.uid, { [key]: newValue })
    } catch (error) {
      // Revert on error
      setPreferences(preferences)
      addToast('Ayar kaydedilemedi', 'error')
      console.error('Error saving preference:', error)
    }
  }

  // Toggle all notifications in a category
  const handleToggleCategory = async (categoryId: string, enabled: boolean) => {
    if (!user) return
    
    const category = notificationCategories.find(c => c.id === categoryId)
    if (!category) return
    
    const updates: Partial<ExtendedNotificationPreferences> = {}
    category.options.forEach(option => {
      updates[option.key] = enabled
    })
    
    const newPrefs = { ...preferences, ...updates }
    setPreferences(newPrefs)
    
    try {
      await saveNotificationPreferences(user.uid, updates)
    } catch (error) {
      setPreferences(preferences)
      addToast('Ayarlar kaydedilemedi', 'error')
    }
  }

  // Check if all options in a category are enabled
  const isCategoryEnabled = (categoryId: string): boolean => {
    const category = notificationCategories.find(c => c.id === categoryId)
    if (!category) return false
    return category.options.every(option => preferences[option.key])
  }

  // Check if some (but not all) options in a category are enabled
  const isCategoryPartial = (categoryId: string): boolean => {
    const category = notificationCategories.find(c => c.id === categoryId)
    if (!category) return false
    const enabledCount = category.options.filter(option => preferences[option.key]).length
    return enabledCount > 0 && enabledCount < category.options.length
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Back Link */}
        <Link 
          href="/ayarlar" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <Icons.chevronLeft className="h-4 w-4" />
          Ayarlara Dön
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Bildirim Ayarları</h1>
          <p className="text-muted-foreground mt-1">
            Hangi bildirimleri almak istediğinizi seçin
          </p>
        </div>

        {/* Push Notifications Master Toggle */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icons.bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Push Bildirimleri</h3>
                <p className="text-sm text-muted-foreground">
                  Tarayıcı bildirimleri alın
                </p>
              </div>
            </div>
            <Button
              variant={pushEnabled ? 'default' : 'outline'}
              onClick={handleTogglePush}
              disabled={saving}
              className="min-w-[80px]"
            >
              {saving ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : pushEnabled ? (
                'Açık'
              ) : (
                'Aç'
              )}
            </Button>
          </div>
          
          {/* Permission Warning */}
          {pushPermission === 'denied' && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500 flex items-center gap-2">
                <Icons.alertCircle className="h-4 w-4 flex-shrink-0" />
                Bildirim izni tarayıcı ayarlarından engellenmiş. Bildirimleri açmak için tarayıcı ayarlarından izin vermeniz gerekiyor.
              </p>
            </div>
          )}
          
          {!pushEnabled && pushPermission !== 'denied' && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Icons.alertCircle className="h-4 w-4 flex-shrink-0" />
                Push bildirimleri kapalı. Anlık bildirimler almak için açmanızı öneririz.
              </p>
            </div>
          )}
        </div>

        {/* Notification Categories */}
        <div className="space-y-4">
          {notificationCategories.map((category) => {
            const CategoryIcon = category.icon
            const allEnabled = isCategoryEnabled(category.id)
            const partialEnabled = isCategoryPartial(category.id)
            
            return (
              <div 
                key={category.id} 
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Category Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{category.title}</h3>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleCategory(category.id, !allEnabled)}
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors',
                      allEnabled ? 'bg-primary' : partialEnabled ? 'bg-primary/50' : 'bg-muted'
                    )}
                    aria-label={`${category.title} ${allEnabled ? 'kapat' : 'aç'}`}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                        allEnabled || partialEnabled ? 'translate-x-7' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                
                {/* Category Options */}
                <div className="divide-y divide-border">
                  {category.options.map((option) => {
                    const OptionIcon = option.icon
                    const isEnabled = preferences[option.key]
                    
                    return (
                      <div 
                        key={option.key} 
                        className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                            <OptionIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{option.title}</p>
                            <p className="text-xs text-muted-foreground">{option.desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleTogglePreference(option.key)}
                          className={cn(
                            'relative w-11 h-6 rounded-full transition-colors',
                            isEnabled ? 'bg-primary' : 'bg-muted'
                          )}
                          aria-label={`${option.title} ${isEnabled ? 'kapat' : 'aç'}`}
                        >
                          <span
                            className={cn(
                              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                              isEnabled ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Info Footer */}
        <p className="mt-6 text-sm text-muted-foreground text-center">
          Bildirim ayarlarınız otomatik olarak kaydedilir ve tüm cihazlarınızda senkronize edilir.
        </p>
      </div>
    </div>
  )
}
