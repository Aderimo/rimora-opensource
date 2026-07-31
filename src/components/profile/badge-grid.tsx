'use client'

import { useState } from 'react'
import { Badge, ALL_BADGES } from '@/lib/badges'
import { cn } from '@/lib/utils'
import { BadgeModal } from './badge-modal'

interface BadgeGridProps {
  earnedBadges: Badge[]
  userStats?: {
    moviesWatched?: number
    episodesWatched?: number
    animeWatched?: number
    followers?: number
    following?: number
    comments?: number
    favorites?: number
    watchParties?: number
  }
}

export function BadgeGrid({ earnedBadges, userStats = {} }: BadgeGridProps) {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null)
  const [showModal, setShowModal] = useState(false)

  const earnedBadgeIds = new Set(earnedBadges.map(b => b.id))

  // Rozet ilerleme hesaplama
  const calculateProgress = (badgeId: string): { current: number; target: number } => {
    const badge = ALL_BADGES.find(b => b.id === badgeId)
    if (!badge) return { current: 0, target: 1 }

    let current = 0
    const target = badge.requirement

    switch (badgeId) {
      case 'first-watch':
      case 'movie-lover':
      case 'movie-master':
        current = userStats.moviesWatched || 0
        break
      case 'series-fan':
        current = userStats.episodesWatched || 0
        break
      case 'anime-otaku':
        current = userStats.animeWatched || 0
        break
      case 'social-butterfly':
        current = userStats.following || 0
        break
      case 'popular':
      case 'influencer':
        current = userStats.followers || 0
        break
      case 'commentator':
      case 'critic':
        current = userStats.comments || 0
        break
      case 'party-host':
        current = userStats.watchParties || 0
        break
      case 'collector':
        current = userStats.favorites || 0
        break
      default:
        current = 0
    }

    return { current: Math.min(current, target), target }
  }

  const handleBadgeClick = (badgeId: string) => {
    const earnedBadge = earnedBadges.find(b => b.id === badgeId)
    const baseBadge = ALL_BADGES.find(b => b.id === badgeId)
    
    if (baseBadge) {
      setSelectedBadge({
        ...baseBadge,
        earnedAt: earnedBadge?.earnedAt
      })
      setShowModal(true)
    }
  }

  // Kategorilere göre grupla
  const categories = [
    { id: 'watching', name: 'İzleme Rozetleri', icon: '🎬' },
    { id: 'social', name: 'Sosyal Rozetler', icon: '👥' },
    { id: 'achievement', name: 'Başarı Rozetleri', icon: '🏆' },
    { id: 'special', name: 'Özel Rozetler', icon: '✨' },
  ]

  return (
    <div className="space-y-8">
      {categories.map((category) => {
        const categoryBadges = ALL_BADGES.filter(b => b.category === category.id)
        if (categoryBadges.length === 0) return null

        return (
          <div key={category.id}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>{category.icon}</span>
              {category.name}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categoryBadges.map((badge) => {
                const isEarned = earnedBadgeIds.has(badge.id)
                const progress = calculateProgress(badge.id)
                const progressPercent = (progress.current / progress.target) * 100

                return (
                  <button
                    key={badge.id}
                    onClick={() => handleBadgeClick(badge.id)}
                    className={cn(
                      'relative p-4 rounded-xl border transition-all duration-200',
                      'hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary',
                      isEarned
                        ? 'bg-gradient-to-br from-primary/20 to-purple-500/20 border-primary/50'
                        : 'bg-muted/50 border-border opacity-60 hover:opacity-80'
                    )}
                  >
                    {/* Rozet İkonu */}
                    <div className={cn(
                      'text-4xl mb-2 transition-transform',
                      isEarned ? 'grayscale-0' : 'grayscale'
                    )}>
                      {badge.icon}
                    </div>

                    {/* Rozet Adı */}
                    <p className={cn(
                      'text-sm font-medium truncate',
                      isEarned ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {badge.name}
                    </p>

                    {/* İlerleme Bar'ı (kazanılmamış rozetler için) */}
                    {!isEarned && progress.target > 1 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {progress.current}/{progress.target}
                        </p>
                      </div>
                    )}

                    {/* Kazanıldı İşareti */}
                    {isEarned && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Rozet Detay Modalı */}
      <BadgeModal
        badge={selectedBadge}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        progress={selectedBadge ? calculateProgress(selectedBadge.id) : { current: 0, target: 1 }}
        isEarned={selectedBadge ? earnedBadgeIds.has(selectedBadge.id) : false}
      />
    </div>
  )
}
