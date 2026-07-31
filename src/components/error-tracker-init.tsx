'use client'

import { useEffect } from 'react'
import { initErrorTracking } from '@/lib/error-tracker'

export function ErrorTrackerInit() {
  useEffect(() => {
    initErrorTracking()
  }, [])

  return null
}
