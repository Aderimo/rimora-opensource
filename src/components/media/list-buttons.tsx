'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/toast'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { ListManagementModal } from './list-management-modal'
import { toggleListItem, isInList } from '@/lib/user-lists'
import type { MediaType } from '@/types'
import { cn } from '@/lib/utils'

interface ListButtonsProps {
  mediaId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  variant?: 'compact' | 'large'
}

export function ListButtons({ mediaId, mediaType, title, posterPath, variant = 'compact' }: ListButtonsProps) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [isWatched, setIsWatched] = useState(false)
  const [loading, setLoading] = useState(false)

  // Status check logic
  useEffect(() => {
    if (user && variant === 'large') {
      isInList(user.uid, mediaId, mediaType, 'watched')
        .then(setIsWatched)
        .catch(console.error)
    }
  }, [user, mediaId, mediaType, variant])

  const handleOpenModal = () => {
    if (!user) {
      addToast('Bu özelliği kullanmak için giriş yapmalısınız', 'warning')
      return
    }
    setShowModal(true)
  }

  const handleToggleWatched = async () => {
    if (!user) {
      addToast('Bu özelliği kullanmak için giriş yapmalısınız', 'warning')
      return
    }

    setLoading(true)
    try {
      const added = await toggleListItem(user.uid, mediaId, mediaType, 'watched', title, posterPath)
      setIsWatched(added)
      addToast(added ? 'İzledim listesine eklendi' : 'İzledim listesinden çıkarıldı', 'success')
    } catch (error) {
      addToast('İşlem başarısız', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'large') {
    return (
      <div className="flex gap-2" role="group" aria-label="Liste işlemleri">
        <Button
          size="lg"
          variant="outline"
          className={cn(
            "gap-2 border-white/20 hover:bg-white/20 transition-colors",
            isWatched
              ? "bg-green-500/20 text-green-500 border-green-500/50 hover:bg-green-500/30"
              : "bg-white/10 text-white"
          )}
          onClick={handleToggleWatched}
          disabled={loading}
          aria-label={isWatched ? "İzledim listesinden çıkar" : "İzledim listesine ekle"}
          aria-pressed={isWatched}
        >
          {loading ? (
            <Icons.spinner className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : isWatched ? (
            <Icons.check className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Icons.eye className="h-5 w-5" aria-hidden="true" />
          )}
          {isWatched ? 'İzlendi' : 'İzledim'}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
          onClick={handleOpenModal}
          aria-label="Listeye ekle"
        >
          <Icons.list className="h-5 w-5" aria-hidden="true" />
          Listeye Ekle
        </Button>

        <ListManagementModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          mediaId={mediaId}
          mediaType={mediaType}
          title={title}
          posterPath={posterPath}
        />
      </div>
    )
  }

  // Compact variant for cards (sadece + ikonu)
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-9 w-9 p-0 bg-black/50 hover:bg-black/80 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          handleOpenModal()
        }}
        title="Listeye Ekle"
        type="button"
        aria-label="Listeye ekle"
      >
        <Icons.plus className="h-4 w-4 text-white" aria-hidden="true" />
      </Button>

      <ListManagementModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        mediaId={mediaId}
        mediaType={mediaType}
        title={title}
        posterPath={posterPath}
      />
    </>
  )
}
