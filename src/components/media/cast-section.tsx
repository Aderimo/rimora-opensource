'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useLanguage } from '@/contexts/language-context'
import { getImageUrl, posterSizes } from '@/lib/api/tmdb'
import { Icons } from '@/components/icons'
import type { Person } from '@/types'

interface CastSectionProps {
  cast: Person[]
}

export function CastSection({ cast }: CastSectionProps) {
  const { t } = useLanguage()

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{t('media.cast')}</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {cast.map((person) => (
          <CastCard key={person.id} person={person} />
        ))}
      </div>
    </section>
  )
}

function CastCard({ person }: { person: Person }) {
  const [imageError, setImageError] = useState(false)
  const imageUrl = getImageUrl(person.profilePath, posterSizes.medium)

  return (
    <div className="flex-shrink-0 w-32 text-center">
      <div className="relative aspect-square rounded-full overflow-hidden bg-muted mb-2 mx-auto w-24">
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={person.name}
            fill
            className="object-cover"
            sizes="96px"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icons.user className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <p className="font-medium text-sm line-clamp-1">{person.name}</p>
      {person.character && (
        <p className="text-xs text-muted-foreground line-clamp-1">{person.character}</p>
      )}
    </div>
  )
}
