'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type AnnouncementPriority = 'polite' | 'assertive'

interface LiveAnnouncerContextType {
  announce: (message: string, priority?: AnnouncementPriority) => void
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextType | null>(null)

/**
 * Live Announcer Provider
 * Screen reader'lar için dinamik içerik duyuruları
 */
export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage(message)
      // Mesajı temizle
      setTimeout(() => setAssertiveMessage(''), 100)
    } else {
      setPoliteMessage(message)
      // Mesajı temizle
      setTimeout(() => setPoliteMessage(''), 100)
    }
  }, [])

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      
      {/* Screen reader için live region'lar */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveAnnouncerContext.Provider>
  )
}

/**
 * Live Announcer Hook
 * Screen reader duyuruları için
 */
export function useLiveAnnouncer() {
  const context = useContext(LiveAnnouncerContext)
  
  if (!context) {
    throw new Error('useLiveAnnouncer must be used within LiveAnnouncerProvider')
  }
  
  return context
}

/**
 * Announce Component
 * Belirli durumlarda otomatik duyuru yapar
 */
interface AnnounceProps {
  message: string
  priority?: AnnouncementPriority
  when?: boolean
}

export function Announce({ message, priority = 'polite', when = true }: AnnounceProps) {
  const { announce } = useLiveAnnouncer()
  
  if (when) {
    announce(message, priority)
  }
  
  return null
}
