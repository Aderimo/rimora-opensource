'use client'

import { useBadgeNotification } from '@/hooks/useBadgeNotification'

/**
 * Badge notification provider component
 * Rozet kazanıldığında toast bildirimi gösterir
 * 
 * @requirements 13.2 - Kullanıcı yeni rozet kazandığında bildirim göstermeli
 */
interface BadgeNotificationProviderProps {
  children: React.ReactNode
}

export function BadgeNotificationProvider({ children }: BadgeNotificationProviderProps) {
  useBadgeNotification()
  return <>{children}</>
}
