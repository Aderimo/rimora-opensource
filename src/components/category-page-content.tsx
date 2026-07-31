'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useLanguage } from '@/contexts/language-context'
import type { Media } from '@/types'

interface Section {
  id: string
  titleKey: string
  items: Media[]
}

interface CategoryPageContentProps {
  title: string
  featured: Media[]
  sections: Section[]
}

// Lazy load components
const HeroSlider = dynamic(() => import('@/components/media/hero-slider').then(m => ({ default: m.HeroSlider })), {
  loading: () => <div className="h-[70vh] bg-muted animate-pulse" />,
  ssr: true
})

const MediaRow = dynamic(() => import('@/components/media/media-row').then(m => ({ default: m.MediaRow })), {
  loading: () => <div className="h-48 bg-muted rounded-lg animate-pulse" />,
  ssr: true
})

export function CategoryPageContent({ title, featured, sections }: CategoryPageContentProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col">
      {/* Hero Slider */}
      {featured.length > 0 && (
        <Suspense fallback={<div className="h-[70vh] bg-muted animate-pulse" />}>
          <HeroSlider items={featured} />
        </Suspense>
      )}

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-8 space-y-10">
        {sections.map((section) => (
          section.items.length > 0 && (
            <Suspense key={section.id} fallback={<div className="h-48 bg-muted rounded-lg animate-pulse" />}>
              <MediaRow
                title={t(section.titleKey)}
                items={section.items}
              />
            </Suspense>
          )
        ))}
      </div>
    </div>
  )
}
