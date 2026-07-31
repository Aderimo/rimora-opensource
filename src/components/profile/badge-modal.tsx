'use client'

import { useEffect, useRef } from 'react'
import { Badge } from '@/lib/badges'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'

import { formatDateTR } from '@/lib/utils/format'

interface BadgeModalProps {
  badge: Badge | null
  isOpen: boolean
  onClose: () => void
  progress: { current: number; target: number }
  isEarned: boolean
}

export function BadgeModal({ badge, isOpen, onClose, progress, isEarned }: BadgeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Dışarı tıklama ile kapatma
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!isOpen || !badge) return null

  const progressPercent = (progress.current / progress.target) * 100

  // Kategori renkleri
  const categoryColors = {
    watching: 'from-blue-500 to-cyan-500',
    social: 'from-pink-500 to-rose-500',
    achievement: 'from-amber-500 to-orange-500',
    special: 'from-purple-500 to-violet-500',
  }

  const categoryNames = {
    watching: 'İzleme Rozeti',
    social: 'Sosyal Rozet',
    achievement: 'Başarı Rozeti',
    special: 'Özel Rozet',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Kapatma Butonu */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
          aria-label="Kapat"
        >
          <Icons.close className="w-5 h-5" />
        </button>

        {/* Üst Gradient Bölüm */}
        <div className={cn(
          'relative h-32 rounded-t-2xl bg-gradient-to-br',
          categoryColors[badge.category],
          !isEarned && 'grayscale opacity-50'
        )}>
          {/* Rozet İkonu */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <div className={cn(
              'w-20 h-20 rounded-full bg-background flex items-center justify-center text-5xl shadow-lg border-4',
              isEarned ? 'border-primary' : 'border-muted grayscale'
            )}>
              {badge.icon}
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div className="pt-14 pb-6 px-6 text-center">
          {/* Rozet Adı */}
          <h2 id="badge-modal-title" className="text-xl font-bold mb-1">
            {badge.name}
          </h2>

          {/* Kategori */}
          <p className="text-sm text-muted-foreground mb-4">
            {categoryNames[badge.category]}
          </p>

          {/* Açıklama */}
          <p className="text-foreground/80 mb-6">
            {badge.description}
          </p>

          {/* Durum */}
          {isEarned ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Kazanıldı!</span>
              </div>
              
              {badge.earnedAt && (
                <p className="text-sm text-muted-foreground">
                  Kazanma Tarihi: {formatDateTR(new Date(badge.earnedAt), { longMonth: true })}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* İlerleme */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">İlerleme</span>
                  <span className="font-medium">{progress.current} / {progress.target}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500 bg-gradient-to-r',
                      categoryColors[badge.category]
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  %{Math.round(progressPercent)} tamamlandı
                </p>
              </div>

              {/* Kalan */}
              {progress.target - progress.current > 0 && (
                <p className="text-sm text-muted-foreground">
                  Bu rozeti kazanmak için <span className="font-semibold text-foreground">{progress.target - progress.current}</span> daha gerekiyor.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Alt Buton */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-muted hover:bg-muted/80 font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
