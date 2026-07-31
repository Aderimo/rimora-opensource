'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  doc, 
  getDoc, 
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  getUserRole, 
  type UserRole, 
  ROLE_INFO, 
  isUserBanned, 
  banUser,
  unbanUser,
  assignRole,
  removeRole,
  canManageUser,
  type BanInfo
} from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'

interface UserData {
  id: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  createdAt: Timestamp | null
  bio: string | null
  role: UserRole
  banInfo: BanInfo | null
}

interface UserStats {
  watchedCount: number
  listsCount: number
  followersCount: number
  followingCount: number
}

interface Activity {
  id: string
  type: string
  timestamp: Timestamp
  details: any
}

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const router = useRouter()
  const { user: currentUser } = useAuth()
  
  const { isAuthorized, isLoading: authLoading, role: adminRole } = useAdminAuth({
    requiredRole: 'moderator',
    redirectTo: '/'
  })

  const [user, setUser] = useState<UserData | null>(null)
  const [stats, setStats] = useState<UserStats>({
    watchedCount: 0,
    listsCount: 0,
    followersCount: 0,
    followingCount: 0
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState<number | undefined>(undefined)

  // Role modal state
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')

  useEffect(() => {
    if (isAuthorized && !authLoading) {
      loadUserData()
    }
  }, [isAuthorized, authLoading, userId])

  const loadUserData = async () => {
    try {
      setLoading(true)

      // Kullanıcı bilgilerini yükle
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (!userDoc.exists()) {
        router.push('/admin/kullanicilar')
        return
      }

      const userData = userDoc.data()
      const userRole = await getUserRole(userId, userData.email)
      const banInfo = await isUserBanned(userId)

      setUser({
        id: userId,
        displayName: userData.displayName || null,
        email: userData.email || null,
        photoURL: userData.photoURL || null,
        createdAt: userData.createdAt || null,
        bio: userData.bio || null,
        role: userRole,
        banInfo
      })

      setSelectedRole(userRole)

      // İstatistikleri yükle
      await loadStats()
      
      // Son aktiviteleri yükle
      await loadActivities()

    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // İzleme geçmişi
      const watchedSnap = await getDocs(
        query(collection(db, 'watchProgress'), where('userId', '==', userId))
      )

      // Listeler
      const listsSnap = await getDocs(
        query(collection(db, 'userLists'), where('userId', '==', userId))
      )

      // Takipçiler
      const followersSnap = await getDocs(
        query(collection(db, 'follows'), where('followingId', '==', userId))
      )

      // Takip edilenler
      const followingSnap = await getDocs(
        query(collection(db, 'follows'), where('followerId', '==', userId))
      )

      setStats({
        watchedCount: watchedSnap.size,
        listsCount: listsSnap.size,
        followersCount: followersSnap.size,
        followingCount: followingSnap.size
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadActivities = async () => {
    try {
      // Son aktiviteleri yükle (activities koleksiyonu varsa)
      const activitiesSnap = await getDocs(
        query(
          collection(db, 'activities'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(10)
        )
      )

      const activitiesData = activitiesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[]

      setActivities(activitiesData)
    } catch (error) {
      console.error('Error loading activities:', error)
      // Activities koleksiyonu yoksa hata vermeden devam et
      setActivities([])
    }
  }

  const handleBan = async () => {
    if (!user || !currentUser) return
    
    try {
      setActionLoading(true)
      await banUser(userId, banReason, currentUser.uid, banDuration)
      await loadUserData()
      setShowBanModal(false)
      setBanReason('')
      setBanDuration(undefined)
    } catch (error) {
      console.error('Error banning user:', error)
      alert('Kullanıcı banlanırken bir hata oluştu')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnban = async () => {
    if (!user || !currentUser) return
    
    try {
      setActionLoading(true)
      await unbanUser(userId, currentUser.uid)
      await loadUserData()
    } catch (error) {
      console.error('Error unbanning user:', error)
      alert('Ban kaldırılırken bir hata oluştu')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRoleChange = async () => {
    if (!user || !currentUser) return

    // Yetki kontrolü
    if (!canManageUser(adminRole, user.role)) {
      alert('Bu kullanıcının rolünü değiştirme yetkiniz yok')
      return
    }

    try {
      setActionLoading(true)
      
      if (selectedRole === 'user') {
        await removeRole(userId, currentUser.uid)
      } else {
        await assignRole(userId, selectedRole, currentUser.uid)
      }
      
      await loadUserData()
      setShowRoleModal(false)
    } catch (error) {
      console.error('Error changing role:', error)
      alert('Rol değiştirilirken bir hata oluştu')
    } finally {
      setActionLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthorized || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <Icons.shield className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Yetkisiz Erişim</h1>
        <p className="text-muted-foreground mt-2">Bu sayfaya erişim için yönetici yetkisi gerekiyor.</p>
        <Button onClick={() => router.push('/')} variant="link" className="text-white mt-4">
          Ana Sayfaya Dön
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/kullanicilar">
              <Button variant="ghost" size="sm" className="gap-2">
                <Icons.arrowLeft className="h-4 w-4" />
                Kullanıcılar
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Icons.user className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg">Kullanıcı Detayı</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sol Panel - Kullanıcı Bilgileri */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profil Kartı */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold mb-4">
                  {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                
                <h2 className="text-xl font-bold mb-1">{user.displayName || 'İsimsiz'}</h2>
                <p className="text-sm text-muted-foreground mb-4">{user.email}</p>

                {/* Rol Badge */}
                <div className="mb-4">
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: `${ROLE_INFO[user.role].color}20`,
                      color: ROLE_INFO[user.role].color
                    }}
                  >
                    {ROLE_INFO[user.role].emoji} {ROLE_INFO[user.role].label}
                  </span>
                </div>

                {/* Ban Durumu */}
                {user.banInfo && (
                  <div className="w-full p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                    <div className="flex items-center gap-2 text-red-500 mb-2">
                      <Icons.ban className="h-4 w-4" />
                      <span className="font-medium text-sm">Banlı Kullanıcı</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Sebep: {user.banInfo.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.banInfo.expiresAt 
                        ? `Bitiş: ${user.banInfo.expiresAt.toLocaleDateString('tr-TR')}`
                        : 'Kalıcı ban'
                      }
                    </p>
                  </div>
                )}

                {/* Kayıt Tarihi */}
                <div className="w-full text-left space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kayıt Tarihi:</span>
                    <span className="font-medium">
                      {user.createdAt?.toDate().toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kullanıcı ID:</span>
                    <span className="font-mono text-xs">{user.id.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* İstatistikler */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <h3 className="font-bold mb-4">İstatistikler</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">İzlenen İçerik</span>
                  <span className="font-bold">{stats.watchedCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Listeler</span>
                  <span className="font-bold">{stats.listsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Takipçi</span>
                  <span className="font-bold">{stats.followersCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Takip Edilen</span>
                  <span className="font-bold">{stats.followingCount}</span>
                </div>
              </div>
            </div>

            {/* İşlemler */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <h3 className="font-bold mb-4">İşlemler</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-white/10"
                  onClick={() => setShowRoleModal(true)}
                  disabled={!canManageUser(adminRole, user.role)}
                >
                  <Icons.shield className="h-4 w-4" />
                  Rol Değiştir
                </Button>

                {user.banInfo ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-green-500/20 text-green-500 hover:bg-green-500/10"
                    onClick={handleUnban}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Icons.spinner className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.check className="h-4 w-4" />
                    )}
                    Ban Kaldır
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10"
                    onClick={() => setShowBanModal(true)}
                    disabled={!canManageUser(adminRole, user.role)}
                  >
                    <Icons.ban className="h-4 w-4" />
                    Kullanıcıyı Banla
                  </Button>
                )}

                <Link href={`/kullanici/${userId}`} target="_blank">
                  <Button variant="outline" className="w-full justify-start gap-2 border-white/10">
                    <Icons.externalLink className="h-4 w-4" />
                    Profili Görüntüle
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Sağ Panel - Aktiviteler */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <h3 className="font-bold text-lg mb-6">Son Aktiviteler</h3>
              
              {activities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Icons.activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Henüz aktivite yok</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-black/20 border border-white/5"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Icons.activity className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium mb-1">{activity.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {activity.timestamp?.toDate().toLocaleString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Kullanıcıyı Banla</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Ban Sebebi</label>
                <Input
                  type="text"
                  placeholder="Örn: Spam, Hakaret, vb."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="bg-black/20 border-white/10"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Süre (Gün)</label>
                <Input
                  type="number"
                  placeholder="Boş bırakın = Kalıcı"
                  value={banDuration || ''}
                  onChange={(e) => setBanDuration(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="bg-black/20 border-white/10"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Boş bırakırsanız kalıcı ban olur
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-white/10"
                onClick={() => {
                  setShowBanModal(false)
                  setBanReason('')
                  setBanDuration(undefined)
                }}
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleBan}
                disabled={!banReason || actionLoading}
              >
                {actionLoading ? (
                  <Icons.spinner className="h-4 w-4 animate-spin" />
                ) : (
                  'Banla'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-white/10 rounded-xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Rol Değiştir</h3>
            
            <div className="space-y-2 mb-6">
              {(['user', 'moderator', 'admin', 'founder'] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  disabled={role === 'founder' && adminRole !== 'founder'}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-colors",
                    selectedRole === role
                      ? "border-primary bg-primary/10"
                      : "border-white/10 hover:bg-white/5",
                    role === 'founder' && adminRole !== 'founder' && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: ROLE_INFO[role].color }}>
                      {ROLE_INFO[role].emoji}
                    </span>
                    <span className="font-medium">{ROLE_INFO[role].label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-white/10"
                onClick={() => setShowRoleModal(false)}
              >
                İptal
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={handleRoleChange}
                disabled={selectedRole === user.role || actionLoading}
              >
                {actionLoading ? (
                  <Icons.spinner className="h-4 w-4 animate-spin" />
                ) : (
                  'Kaydet'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
