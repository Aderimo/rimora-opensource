'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import { onBadgeEarned, type Badge } from '@/lib/badges'

/**
 * Hook to show toast notifications when badges are earned
 * 
 * @requirements 13.2 - Kullanıcı yeni rozet kazandığında bildirim göstermeli
 */
export function useBadgeNotification() {
  const { addToast } = useToast()

  useEffect(() => {
    // Rozet kazanıldığında toast göster
    const unsubscribe = onBadgeEarned((badge: Omit<Badge, 'earnedAt'>) => {
      addToast(
        `${badge.icon} Yeni Rozet Kazandın: ${badge.name}!`,
        'success'
      )
    })

    return () => {
      unsubscribe()
    }
  }, [addToast])
}
