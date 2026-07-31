'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { getFeedActivities, type Activity } from '@/lib/activities'
import { getFollowing } from '@/lib/social'
import { getImageUrl } from '@/lib/api/tmdb'
import { cn } from '@/lib/utils'

import { formatRelativeTimeTR } from '@/lib/utils/format'

export function ActivityFeed() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFeed() {
      if (!user) {
        setLoading(false)
        return
      }
      
      try {
        const followingIds = await getFollowing(user.uid).catch(() => [])
        if (followingIds.length > 0) {
          const feed = await getFeedActivities(followingIds).catch(() => [])
          setActivities(feed)
        }
      } catch {
        // Sessiz hata
        setActivities([])
      } finally {
        setLoading(false)
      }
    }
    loadFeed()
  }, [user])

  const formatTime = (date: Date) => {
    return formatRelativeTimeTR(date)
  }

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'watch': return <Icons.play className="h-4 w-4 text-green-500" />
      case 'favorite': return <Icons.heart className="h-4 w-4 text-pink-500" />
      case 'watchlist': return <Icons.clock className="h-4 w-4 text-purple-500" />
      case 'comment': return <Icons.comment className="h-4 w-4 text-blue-500" />
      case 'rating': return <Icons.star className="h-4 w-4 text-yellow-500" />
      case 'follow': return <Icons.user className="h-4 w-4 text-cyan-500" />
      default: return <Icons.info className="h-4 w-4" />
    }
  }

  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'watch': return `${activity.mediaTitle} izledi`
      case 'favorite': return `${activity.mediaTitle} favorilere ekledi`
      case 'watchlist': return `${activity.mediaTitle} izleme listesine ekledi`
      case 'comment': return `${activity.mediaTitle} için yorum yaptı`
      case 'rating': return `${activity.mediaTitle} için ${activity.rating}/5 puan verdi`
      case 'follow': return `${activity.targetUserName} takip etmeye başladı`
      default: return ''
    }
  }

  const getMediaLink = (activity: Activity) => {
    if (!activity.mediaId || !activity.mediaType) return null
    const path = activity.mediaType === 'movie' ? 'filmler' : activity.mediaType === 'anime' ? 'animeler' : 'diziler'
    return `/${path}/${activity.mediaId}`
  }

  if (!user) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <Icons.user className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold mb-2">Aktivite Akışı</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Takip ettiğiniz kullanıcıların aktivitelerini görmek için giriş yapın.
        </p>
        <Link href="/giris">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Giriş Yap
          </button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex justify-center py-8">
          <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <Icons.info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold mb-2">Aktivite Yok</h3>
        <p className="text-sm text-muted-foreground">
          Takip ettiğiniz kullanıcıların aktiviteleri burada görünecek.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Aktivite Akışı</h3>
      </div>
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {activities.map((activity) => {
          const mediaLink = getMediaLink(activity)
          
          return (
            <div key={activity.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex gap-3">
                {/* User Avatar */}
                <Link href={`/profil/${activity.userId}`} className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                    {activity.userPhoto ? (
                      <Image
                        src={activity.userPhoto}
                        alt={activity.userName}
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-white font-bold text-sm">
                          {activity.userName[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActivityIcon(activity.type)}
                    <Link 
                      href={`/profil/${activity.userId}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {activity.userName}
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getActivityText(activity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(activity.createdAt)}
                  </p>
                </div>

                {/* Media Poster */}
                {activity.mediaPoster && mediaLink && (
                  <Link href={mediaLink} className="flex-shrink-0">
                    <div className="w-12 h-18 rounded overflow-hidden bg-muted">
                      <Image
                        src={getImageUrl(activity.mediaPoster, 'w92') || ''}
                        alt={activity.mediaTitle || ''}
                        width={48}
                        height={72}
                        className="object-cover"
                      />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
