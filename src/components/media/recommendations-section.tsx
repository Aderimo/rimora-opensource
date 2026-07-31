'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { MediaRow } from './media-row'
import { Icons } from '@/components/icons'
import { getRecommendationsForUser, getBecauseYouWatched } from '@/lib/recommendations'
import type { Media } from '@/types'

interface RecommendationsSectionProps {
  fallbackData?: Media[]
}

export function RecommendationsSection({ fallbackData = [] }: RecommendationsSectionProps) {
  const { user, loading: authLoading } = useAuth()
  const [recommendations, setRecommendations] = useState<Media[]>([])
  const [becauseYouWatched, setBecauseYouWatched] = useState<{ basedOn: string; items: Media[] }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If auth is still loading, wait
    if (authLoading) return

    // If no user, we just use fallbackData (Trending)
    if (!user) {
      setRecommendations(fallbackData)
      setLoading(false)
      return
    }

    // If user exists, fetch personalized data
    async function loadRecommendations() {
      try {
        const [recs, byw] = await Promise.all([
          // Get personalized recs (pass userId)
          getRecommendationsForUser(user!.uid, 20).catch(() => []),
          // Get "Because you watched"
          getBecauseYouWatched(user!.uid, 10).catch(() => []),
        ])

        // If personalized returns empty (e.g. new user), fall back to trending
        if (recs.length === 0) {
          setRecommendations(fallbackData)
        } else {
          setRecommendations(recs)
        }

        setBecauseYouWatched(byw)
      } catch (error) {
        console.error('Failed to load recommendations', error)
        setRecommendations(fallbackData)
      } finally {
        setLoading(false)
      }
    }
    loadRecommendations()
  }, [user, authLoading, fallbackData])

  if (authLoading || loading) {
    // Show skeleton or just the fallback data while loading personalized? 
    // Showing fallback data immediately is better for CLS/UX if we assume most users might see Trending.
    // But better to show spinner or reference if we expect a change.
    // Let's just return a placeholder or the fallback if available to avoid layout shift.
    if (fallbackData.length > 0) {
      return (
        <MediaRow
          title="Gündemdekiler"
          items={fallbackData}
          showType
        />
      )
    }
    return (
      <div className="flex justify-center py-8">
        <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  // Determine Title
  const title = user && recommendations !== fallbackData
    ? "Sizin İçin Öneriler"
    : "Gündemdekiler"

  const displayItems = recommendations.length > 0 ? recommendations : fallbackData

  if (displayItems.length === 0 && becauseYouWatched.length === 0) {
    return null
  }

  return (
    <div className="space-y-10">
      {/* Main Recs (Personalized or Trending) */}
      {displayItems.length > 0 && (
        <MediaRow
          title={title}
          items={displayItems}
          showType
        />
      )}

      {/* Because You Watched */}
      {becauseYouWatched.map((section, index) => (
        <MediaRow
          key={index}
          title={`"${section.basedOn}" izlediğiniz için`}
          items={section.items}
          showType
        />
      ))}
    </div>
  )
}
