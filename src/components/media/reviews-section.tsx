'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { addReview, getReviews, getUserReview, toggleReviewLike, type Review } from '@/lib/reviews'
import type { MediaType } from '@/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface ReviewsSectionProps {
    mediaId: number
    mediaType: MediaType
}

export function ReviewsSection({ mediaId, mediaType }: ReviewsSectionProps) {
    const { user } = useAuth()
    const { t } = useLanguage()
    const { addToast } = useToast()

    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [submitLoading, setSubmitLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)

    // Form State
    const [rating, setRating] = useState(0)
    const [content, setContent] = useState('')
    const [spoiler, setSpoiler] = useState(false)
    const [userReview, setUserReview] = useState<Review | null>(null)

    useEffect(() => {
        loadReviews()
        if (user) {
            loadUserReview()
        }
    }, [mediaId, mediaType, user])

    const loadReviews = async () => {
        try {
            const { reviews } = await getReviews(mediaId, mediaType)
            setReviews(reviews)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const loadUserReview = async () => {
        if (!user) return
        const review = await getUserReview(user.uid, mediaId, mediaType)
        if (review) {
            setUserReview(review)
            setRating(review.rating)
            setContent(review.content || '')
            setSpoiler(review.spoiler)
        }
    }

    const handleSubmit = async () => {
        if (!user) return
        if (rating === 0) {
            addToast('Lütfen bir puan verin', 'warning')
            return
        }

        setSubmitLoading(true)
        try {
            await addReview(user.uid, mediaId, mediaType, rating, content, spoiler)
            await loadReviews()
            await loadUserReview()
            setShowModal(false)
            addToast('Değerlendirmeniz kaydedildi', 'success')
        } catch (error) {
            addToast('Bir hata oluştu', 'error')
        } finally {
            setSubmitLoading(false)
        }
    }

    const handleLike = async (reviewId: string) => {
        if (!user) {
            addToast('Beğenmek için giriş yapmalısınız', 'warning')
            return
        }

        // Optimistic update
        setReviews(prev => prev.map(r => {
            if (r.id === reviewId) {
                return { ...r, likes: r.likes + 1 } // Actually toggle logic is complex optimistically, let's just await
            }
            return r
        }))

        try {
            await toggleReviewLike(reviewId, user.uid)
            await loadReviews() // Reload to get actual count
        } catch (error) {
            await loadReviews() // Revert on error
        }
    }

    return (
        <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Yorumlar ve Değerlendirmeler</h3>

                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Icons.star className="h-4 w-4" />
                            {userReview ? 'Değerlendirmemi Düzenle' : 'Değerlendir'}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Değerlendirme Yap</DialogTitle>
                            <DialogDescription>
                                Bu içerik hakkında düşüncelerini paylaş.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            {/* Rating */}
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => { }} // Optional hover effect
                                        className={cn(
                                            "p-1 transition-transform hover:scale-110",
                                            rating >= star ? "text-yellow-500" : "text-muted-foreground"
                                        )}
                                    >
                                        <Icons.star className={cn("h-6 w-6", rating >= star && "fill-current")} />
                                    </button>
                                ))}
                            </div>
                            <div className="text-center font-bold text-lg text-yellow-500">
                                {rating > 0 ? `${rating}/10` : 'Puan Ver'}
                            </div>

                            {/* Content */}
                            <div className="grid gap-2">
                                <Label htmlFor="review">Yorumunuz (İsteğe bağlı)</Label>
                                <Textarea
                                    id="review"
                                    placeholder="Düşüncelerinizi yazın..."
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </div>

                            {/* Spoiler */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Spoiler İçerir</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Yorumunuz spoiler içeriyorsa işaretleyin
                                    </p>
                                </div>
                                <Switch
                                    checked={spoiler}
                                    onCheckedChange={setSpoiler}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowModal(false)}>İptal</Button>
                            <Button onClick={handleSubmit} disabled={submitLoading}>
                                {submitLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex justify-center py-8">
                    <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : reviews.length > 0 ? (
                <div className="grid gap-4">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-muted/50 rounded-lg p-4 border border-border">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex gap-3">
                                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-background">
                                        {review.user?.photoURL ? (
                                            <Image
                                                src={review.user.photoURL}
                                                alt={review.user.displayName || 'User'}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 text-primary font-bold">
                                                {(review.user?.displayName || 'U')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{review.user?.displayName || 'Kullanıcı'}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(review.createdAt, { addSuffix: true, locale: tr })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-yellow-500 text-sm mt-0.5">
                                            <Icons.star className="h-3 w-3 fill-current" />
                                            <span className="font-bold">{review.rating}</span>
                                            <span className="text-muted-foreground">/10</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Likes */}
                                <button
                                    onClick={() => handleLike(review.id)}
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <Icons.heart className={cn("h-4 w-4", review.likes > 0 && "fill-current text-red-500")} />
                                    {review.likes > 0 && <span>{review.likes}</span>}
                                </button>
                            </div>

                            {/* Content */}
                            {review.content && (
                                <div className="mt-3 pl-13">
                                    {review.spoiler ? (
                                        <div className="bg-black/20 rounded p-3 text-center">
                                            <p className="text-sm font-medium text-red-400 mb-1">Spoiler Uyarısı</p>
                                            <button
                                                className="text-xs text-muted-foreground hover:text-foreground underline"
                                                onClick={(e) => {
                                                    const target = e.currentTarget
                                                    const parent = target.parentElement
                                                    if (parent) {
                                                        parent.innerHTML = `<p class="text-sm text-foreground whitespace-pre-wrap">${review.content}</p>`
                                                    }
                                                }}
                                            >
                                                Göstermek için tıklayın
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{review.content}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
                    <Icons.comment className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>Henüz değerlendirme yapılmamış.</p>
                    <p className="text-sm">İlk değerlendiren siz olun!</p>
                </div>
            )}
        </div>
    )
}
