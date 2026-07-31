'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getFollowers, toggleFollow, isFollowing } from '@/lib/social'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface UserInfo {
  uid: string
  displayName: string
  photoURL: string | null
  isFollowing: boolean
}

export default function FollowersPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [followers, setFollowers] = useState<UserInfo[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/giris')
    }
  }, [user, loading, router])

  useEffect(() => {
    async function loadFollowers() {
      if (!user) return
      try {
        const followerIds = await getFollowers(user.uid)
        const usersData = await Promise.all(
          followerIds.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'users', uid))
            const data = userDoc.data()
            const following = await isFollowing(user.uid, uid)
            return {
              uid,
              displayName: data?.displayName || 'Kullanıcı',
              photoURL: data?.photoURL || null,
              isFollowing: following,
            }
          })
        )
        setFollowers(usersData)
      } catch (error) {
        console.error('Error loading followers:', error)
      } finally {
        setPageLoading(false)
      }
    }
    loadFollowers()
  }, [user])

  const handleToggleFollow = async (targetUser: UserInfo) => {
    if (!user || !userProfile) return
    const newState = await toggleFollow(
      user.uid,
      userProfile.displayName || 'Kullanıcı',
      userProfile.photoURL,
      targetUser.uid
    )
    setFollowers(prev => prev.map(f => 
      f.uid === targetUser.uid ? { ...f, isFollowing: newState } : f
    ))
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
        <Link href="/profil" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <Icons.chevronLeft className="h-4 w-4" />
          Profile Dön
        </Link>
        <h1 className="text-2xl font-bold mb-6">Takipçiler ({followers.length})</h1>
        
        {pageLoading ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : followers.length > 0 ? (
          <div className="space-y-2">
            {followers.map((follower) => (
              <div key={follower.uid} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
                <Link href={`/profil/${follower.uid}`} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
                    {follower.photoURL ? (
                      <Image src={follower.photoURL} alt={follower.displayName} width={48} height={48} className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-white font-bold">{follower.displayName[0].toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <span className="font-medium">{follower.displayName}</span>
                </Link>
                <Button
                  variant={follower.isFollowing ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleToggleFollow(follower)}
                >
                  {follower.isFollowing ? 'Takipten Çık' : 'Takip Et'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Icons.users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Henüz takipçiniz yok</p>
          </div>
        )}
      </div>
    </div>
  )
}
