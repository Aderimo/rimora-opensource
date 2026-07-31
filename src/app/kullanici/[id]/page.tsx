'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getUserProfile, followUser, unfollowUser, isFollowing, getFollowCounts } from '@/lib/social'
import { getUserList, type UserListItem } from '@/lib/user-lists'
import { getUserBadges, type Badge } from '@/lib/badges'
import { getUserStats, type UserStats } from '@/lib/user-stats'
import { getImageUrl } from '@/lib/api/tmdb'
import { createConversation } from '@/lib/messaging'
import { cn } from '@/lib/utils'

interface UserProfile {
  uid: string
  displayName: string
  photoURL: string | null
  bio?: string
  email?: string
  createdAt?: Date
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const userId = params.id as string

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [badges, setBadges] = useState<Badge[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [lists, setLists] = useState<Record<string, UserListItem[]>>({
    watchlist: [],
    favorites: [],
    watched: [],
  })
  const [followLoading, setFollowLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)

  useEffect(() => {
    if (!userId) return

    const loadUserData = async () => {
      try {
        const [
          userProfile,
          followStatus,
          counts,
          userBadges,
          stats,
          watchlist,
          favorites,
          watched
        ] = await Promise.all([
          getUserProfile(userId),
          user ? isFollowing(user.uid, userId) : false,
          getFollowCounts(userId),
          getUserBadges(userId),
          getUserStats(userId),
          getUserList(userId, 'watchlist').catch(() => []),
          getUserList(userId, 'favorites').catch(() => []),
          getUserList(userId, 'watched').catch(() => [])
        ])

        setProfile(userProfile)
        setIsFollowingUser(followStatus)
        setFollowCounts(counts)
        setBadges(userBadges)
        setUserStats(stats)
        setLists({ watchlist, favorites, watched })
      } catch (error) {
        console.error('Error loading user profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [userId, user])

  const handleFollow = async () => {
    if (!user || !profile) return
    
    setFollowLoading(true)
    try {
      if (isFollowingUser) {
        await unfollowUser(user.uid, profile.uid)
        setIsFollowingUser(false)
        setFollowCounts(prev => ({ ...prev, followers: prev.followers - 1 }))
      } else {
        await followUser(user.uid, profile.uid, userProfile?.displayName || 'Kullanıcı')
        setIsFollowingUser(true)
        setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }))
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error)
      // Hata durumunda kullanıcıya bilgi ver
      alert(isFollowingUser ? 'Takipten çıkma başarısız oldu. Lütfen tekrar deneyin.' : 'Takip etme başarısız oldu. Lütfen tekrar deneyin.')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleMessage = async () => {
    if (!user || !userProfile || !profile) return

    setMessageLoading(true)
    try {
      const conversationId = await createConversation(
        user.uid,
        userProfile.displayName || 'Kullanıcı',
        userProfile.photoURL,
        profile.uid,
        profile.displayName,
        profile.photoURL
      )
      
      router.push(`/mesajlar?conv=${conversationId}`)
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert('Mesaj oluşturma başarısız oldu. Lütfen tekrar deneyin.')
    } finally {
      setMessageLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center">
        <Icons.userX className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Kullanıcı Bulunamadı</h1>
        <p className="text-muted-foreground mb-6">Bu kullanıcı mevcut değil veya silinmiş olabilir.</p>
        <Link href="/">
          <Button>Ana Sayfaya Dön</Button>
        </Link>
      </div>
    )
  }

  const isOwnProfile = user?.uid === userId

  return (
    <div className="min-h-screen pb-20">
      {/* Header Banner */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-purple-900 to-pink-900 animate-gradient-x" />
        <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
          <div className="container mx-auto flex flex-col md:flex-row items-end gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-4 border-background shadow-2xl bg-muted">
                {profile.photoURL ? (
                  <Image src={profile.photoURL} alt="Profil" fill className="object-cover" sizes="(max-width: 768px) 128px, 160px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-4xl font-bold text-white">
                    {profile.displayName[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 mb-2">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">
                  {profile.displayName}
                </h1>
              </div>
              {profile.bio && <p className="text-white/80 max-w-2xl text-lg">{profile.bio}</p>}

              <div className="flex gap-6 mt-4 text-white/90">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{followCounts.followers}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Takipçi</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{followCounts.following}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Takip</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{userStats?.moviesWatched || 0}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Film</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold">{badges.length}</span>
                  <span className="text-xs uppercase tracking-wider opacity-70">Rozet</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {!isOwnProfile && user && (
              <div className="flex gap-3 mb-2">
                <Button 
                  onClick={handleFollow}
                  disabled={followLoading}
                  variant={isFollowingUser ? "secondary" : "default"}
                  className="gap-2"
                >
                  {followLoading ? (
                    <Icons.spinner className="h-4 w-4 animate-spin" />
                  ) : isFollowingUser ? (
                    <>
                      <Icons.userCheck className="h-4 w-4" />
                      Takip Ediliyor
                    </>
                  ) : (
                    <>
                      <Icons.userPlus className="h-4 w-4" />
                      Takip Et
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleMessage}
                  disabled={messageLoading}
                  variant="outline"
                  className="gap-2"
                >
                  {messageLoading ? (
                    <Icons.spinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Icons.messageSquare className="h-4 w-4" />
                      Mesaj Gönder
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Panel - Rozetler */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icons.award className="h-5 w-5 text-yellow-500" />
                Rozetler ({badges.length})
              </h3>
              {badges.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {badges.slice(0, 9).map((badge) => (
                    <div
                      key={badge.id}
                      className="aspect-square rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex flex-col items-center justify-center p-2 text-center"
                    >
                      <span className="text-2xl mb-1">{badge.icon}</span>
                      <span className="text-xs font-medium text-yellow-200">{badge.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Henüz rozet yok</p>
              )}
            </div>
          </div>

          {/* Sağ Panel - Listeler */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-6">Listeler</h3>
              
              <div className="space-y-8">
                {/* İzlenecekler */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Icons.clock className="h-5 w-5 text-blue-500" />
                    İzlenecekler ({lists.watchlist.length})
                  </h4>
                  {lists.watchlist.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                      {lists.watchlist.slice(0, 8).map((item) => (
                        <Link
                          key={item.id}
                          href={item.mediaType === 'movie' ? `/filmler/${item.mediaId}` : 
                                item.mediaType === 'anime' ? `/animeler/${item.mediaId}` : 
                                `/diziler/${item.mediaId}`}
                          className="aspect-[2/3] rounded-lg overflow-hidden bg-muted hover:scale-105 transition-transform"
                        >
                          {item.posterPath ? (
                            <Image
                              src={getImageUrl(item.posterPath, 'w185') || ''}
                              alt={item.title}
                              width={185}
                              height={278}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icons.film className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Liste boş</p>
                  )}
                </div>

                {/* Favoriler */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Icons.heart className="h-5 w-5 text-pink-500" />
                    Favoriler ({lists.favorites.length})
                  </h4>
                  {lists.favorites.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                      {lists.favorites.slice(0, 8).map((item) => (
                        <Link
                          key={item.id}
                          href={item.mediaType === 'movie' ? `/filmler/${item.mediaId}` : 
                                item.mediaType === 'anime' ? `/animeler/${item.mediaId}` : 
                                `/diziler/${item.mediaId}`}
                          className="aspect-[2/3] rounded-lg overflow-hidden bg-muted hover:scale-105 transition-transform"
                        >
                          {item.posterPath ? (
                            <Image
                              src={getImageUrl(item.posterPath, 'w185') || ''}
                              alt={item.title}
                              width={185}
                              height={278}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icons.film className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Liste boş</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}