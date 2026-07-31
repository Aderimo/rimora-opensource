'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { createNotification, sendPushNotification } from '@/lib/notifications'
import { subscribeToPushNotifications } from '@/lib/push-notifications'

export default function TestNotificationsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubscribe = async () => {
    if (!user) return
    
    setLoading(true)
    setMessage('')
    
    try {
      const success = await subscribeToPushNotifications(user.uid)
      if (success) {
        setMessage('✅ Push bildirimlere başarıyla abone oldunuz!')
      } else {
        setMessage('❌ Push bildirim aboneliği başarısız oldu.')
      }
    } catch (error) {
      console.error('Subscribe error:', error)
      setMessage('❌ Hata: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const sendTestNotification = async (type: string) => {
    if (!user) return
    
    setLoading(true)
    setMessage('')
    
    try {
      let notificationData: any = {
        title: '',
        body: '',
        type,
        data: {},
      }

      switch (type) {
        case 'new_episode':
          notificationData = {
            title: 'Yeni Bölüm!',
            body: 'Breaking Bad - Sezon 5 Bölüm 16 yayınlandı',
            type: 'new_episode',
            data: {
              mediaId: 1396,
              mediaType: 'tv',
            },
          }
          break
        
        case 'message':
          notificationData = {
            title: 'Yeni Mesaj',
            body: 'Test kullanıcısından yeni bir mesajınız var',
            type: 'message',
            data: {
              conversationId: 'test-conversation-123',
            },
          }
          break
        
        case 'watch_party':
          notificationData = {
            title: 'Watch Party Daveti',
            body: 'Test kullanıcısı sizi bir watch party\'ye davet etti',
            type: 'watch_party',
            data: {
              roomId: 'test-room-123',
            },
          }
          break
        
        case 'follow':
          notificationData = {
            title: 'Yeni Takipçi',
            body: 'Test kullanıcısı sizi takip etmeye başladı',
            type: 'follow',
            data: {
              fromUserId: user.uid,
            },
          }
          break
        
        case 'comment':
          notificationData = {
            title: 'Yeni Yorum',
            body: 'Test kullanıcısı listenize yorum yaptı',
            type: 'comment',
            data: {
              mediaId: 550,
              mediaType: 'movie',
            },
          }
          break
      }

      // Firestore'a bildirim ekle
      await createNotification(
        user.uid,
        notificationData.type,
        notificationData.title,
        notificationData.body,
        notificationData.data
      )

      // Push bildirim gönder
      await sendPushNotification(user.uid, notificationData)

      setMessage(`✅ ${notificationData.title} bildirimi gönderildi!`)
    } catch (error) {
      console.error('Send notification error:', error)
      setMessage('❌ Bildirim gönderilemedi: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Bildirim Test Sayfası</h1>
          <p className="text-muted-foreground">Bu sayfayı kullanmak için giriş yapmalısınız.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Bildirim Test Sayfası</h1>
        <p className="text-muted-foreground mb-8">
          Bu sayfa bildirim sistemini test etmek için kullanılır.
        </p>

        {/* Subscribe Button */}
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">1. Push Bildirimlere Abone Ol</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Önce push bildirimlere abone olmanız gerekiyor.
          </p>
          <Button onClick={handleSubscribe} disabled={loading}>
            {loading ? 'İşleniyor...' : 'Push Bildirimlere Abone Ol'}
          </Button>
        </div>

        {/* Test Notifications */}
        <div className="mb-8 p-6 bg-card border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">2. Test Bildirimleri Gönder</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Farklı bildirim tiplerini test edin. Her bildirim tıklandığında ilgili sayfaya yönlendirecek.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => sendTestNotification('new_episode')}
              disabled={loading}
              variant="outline"
            >
              📺 Yeni Bölüm Bildirimi
            </Button>
            
            <Button
              onClick={() => sendTestNotification('message')}
              disabled={loading}
              variant="outline"
            >
              💬 Mesaj Bildirimi
            </Button>
            
            <Button
              onClick={() => sendTestNotification('watch_party')}
              disabled={loading}
              variant="outline"
            >
              🎬 Watch Party Daveti
            </Button>
            
            <Button
              onClick={() => sendTestNotification('follow')}
              disabled={loading}
              variant="outline"
            >
              👤 Takipçi Bildirimi
            </Button>
            
            <Button
              onClick={() => sendTestNotification('comment')}
              disabled={loading}
              variant="outline"
            >
              💭 Yorum Bildirimi
            </Button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.startsWith('✅') 
              ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
            {message}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Test Adımları:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Önce "Push Bildirimlere Abone Ol" butonuna tıklayın</li>
            <li>Tarayıcı izin istediğinde "İzin Ver" seçeneğini seçin</li>
            <li>Test bildirimlerinden birini gönderin</li>
            <li>Bildirim geldiğinde üzerine tıklayın</li>
            <li>İlgili sayfaya yönlendirildiğinizi kontrol edin</li>
          </ol>
          
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              <strong>Not:</strong> Push bildirimlerin çalışması için HTTPS gereklidir. 
              Localhost'ta test ediyorsanız, tarayıcı bildirimleri engelleyebilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
