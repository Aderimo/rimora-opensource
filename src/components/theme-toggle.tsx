'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Icons.sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <Icons.sun className="h-4 w-4" />
      ) : (
        <Icons.moon className="h-4 w-4" />
      )}
    </Button>
  )
}
