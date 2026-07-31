import { useEffect, useCallback, RefObject } from 'react'

/**
 * Klavye navigasyonu için hook
 * Arrow keys ile liste navigasyonu sağlar
 */
export function useKeyboardNavigation(
  containerRef: RefObject<HTMLElement>,
  options: {
    selector?: string
    onSelect?: (element: HTMLElement) => void
    loop?: boolean
    orientation?: 'horizontal' | 'vertical' | 'both'
  } = {}
) {
  const {
    selector = '[role="button"], button, a, [tabindex="0"]',
    onSelect,
    loop = true,
    orientation = 'both',
  } = options

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef.current) return

      const focusableElements = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(selector)
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

      if (focusableElements.length === 0) return

      const currentIndex = focusableElements.findIndex(
        (el) => el === document.activeElement
      )

      let nextIndex = currentIndex

      // Arrow key navigation
      if (
        (orientation === 'vertical' || orientation === 'both') &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp')
      ) {
        event.preventDefault()
        
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex + 1
        } else if (event.key === 'ArrowUp') {
          nextIndex = currentIndex - 1
        }
      } else if (
        (orientation === 'horizontal' || orientation === 'both') &&
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      ) {
        event.preventDefault()
        
        if (event.key === 'ArrowRight') {
          nextIndex = currentIndex + 1
        } else if (event.key === 'ArrowLeft') {
          nextIndex = currentIndex - 1
        }
      } else if (event.key === 'Home') {
        event.preventDefault()
        nextIndex = 0
      } else if (event.key === 'End') {
        event.preventDefault()
        nextIndex = focusableElements.length - 1
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (currentIndex >= 0 && onSelect) {
          event.preventDefault()
          onSelect(focusableElements[currentIndex])
        }
        return
      } else {
        return
      }

      // Loop around
      if (loop) {
        if (nextIndex >= focusableElements.length) {
          nextIndex = 0
        } else if (nextIndex < 0) {
          nextIndex = focusableElements.length - 1
        }
      } else {
        nextIndex = Math.max(0, Math.min(nextIndex, focusableElements.length - 1))
      }

      if (nextIndex !== currentIndex && focusableElements[nextIndex]) {
        focusableElements[nextIndex].focus()
      }
    },
    [containerRef, selector, onSelect, loop, orientation]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, handleKeyDown])
}

/**
 * Focus trap hook - Modal ve dialog'lar için
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // İlk elemente focus
    firstElement?.focus()

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Modal kapatma için custom event
        container.dispatchEvent(new CustomEvent('escape-pressed'))
      }
    }

    container.addEventListener('keydown', handleTabKey)
    container.addEventListener('keydown', handleEscapeKey)

    return () => {
      container.removeEventListener('keydown', handleTabKey)
      container.removeEventListener('keydown', handleEscapeKey)
    }
  }, [containerRef, isActive])
}

/**
 * Roving tabindex hook - Toolbar ve menu'ler için
 */
export function useRovingTabIndex(
  containerRef: RefObject<HTMLElement>,
  options: {
    selector?: string
    defaultIndex?: number
  } = {}
) {
  const { selector = '[role="button"], button', defaultIndex = 0 } = options

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(selector)
    )

    if (items.length === 0) return

    // İlk item dışındakileri tabindex="-1" yap
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === defaultIndex ? '0' : '-1')
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (!items.includes(target)) return

      const currentIndex = items.indexOf(target)
      let nextIndex = currentIndex

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        nextIndex = (currentIndex + 1) % items.length
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        nextIndex = (currentIndex - 1 + items.length) % items.length
      } else if (event.key === 'Home') {
        event.preventDefault()
        nextIndex = 0
      } else if (event.key === 'End') {
        event.preventDefault()
        nextIndex = items.length - 1
      } else {
        return
      }

      // Tabindex güncelle
      items[currentIndex].setAttribute('tabindex', '-1')
      items[nextIndex].setAttribute('tabindex', '0')
      items[nextIndex].focus()
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, selector, defaultIndex])
}
