'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { getFollowing, toggleFollow } from '@/lib/social'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface UserInfo {
  uid: string
  displayName: string
  photoURL: string | null
}

export default function FollowingPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [following, setFollowing] = useState<UserInfo[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/giris')
  }, [user, loading, router])

  useEffect(() => {
    async function loadFollowing() {
      if (!user) return
      try {
        const followingIds = await getFollowing(user.uid)
        const usersData = await Promise.all(
          followingIds.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'users', uid))
            const data = userDoc.data()
            return {
              uid,
              displayName: data?.displayName || 'Kullanıcı',
              photoURL: data?.photoURL || null,
            }
          })
        )
        setFollowing(usersData)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setPageLoading(false)
      }
    }
    loadFollowing()
  }, [user])

  const handleUnfollow = async (targetUid: string) => {
    if (!user || !userProfile) return
    await toggleFollow(user.uid, userProfile.displayName || '', userProfile.photoURL, targetUid)
    setFollowing(prev => prev.filter(f => f.uid !== targetUid))
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
        <h1 className="text-2xl font-bold mb-6">Takip Edilenler ({following.length})</h1>
        
        {pageLoading ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : following.length > 0 ? (
          <div className="space-y-2">
            {following.map((f) => (
              <div key={f.uid} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
                <Link href={`/profil/${f.uid}`} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
                    {f.photoURL ? (
                      <Image src={f.photoURL} alt={f.displayName} width={48} height={48} className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-white font-bold">{f.displayName[0].toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <span className="font-medium">{f.displayName}</span>
                </Link>
                <Button variant="outline" size="sm" onClick={() => handleUnfollow(f.uid)}>
                  Takipten Çık
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Icons.users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Henüz kimseyi takip etmiyorsunuz</p>
          </div>
        )}
      </div>
    </div>
  )
}
