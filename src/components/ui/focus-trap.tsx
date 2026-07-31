'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useKeyboardNavigation'

interface FocusTrapProps {
  children: ReactNode
  isActive?: boolean
  onEscape?: () => void
  className?: string
}

/**
 * Focus Trap Component
 * Modal ve dialog'larda focus'u içeride tutar
 */
export function FocusTrap({
  children,
  isActive = true,
  onEscape,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useFocusTrap(containerRef, isActive)

  useEffect(() => {
    if (!onEscape || !containerRef.current) return

    const handleEscape = () => {
      onEscape()
    }

    const container = containerRef.current
    container.addEventListener('escape-pressed', handleEscape as EventListener)

    return () => {
      container.removeEventListener('escape-pressed', handleEscape as EventListener)
    }
  }, [onEscape])

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}
