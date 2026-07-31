'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useAuth } from '@/contexts/auth-context'
import { followUser, unfollowUser, isFollowing, getFollowCounts } from '@/lib/social'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FollowButtonProps {
    targetUserId: string
    className?: string
    initialIsFollowing?: boolean
    onFollowChange?: (isFollowing: boolean) => void
}

export function FollowButton({ targetUserId, className, initialIsFollowing, onFollowChange }: FollowButtonProps) {
    const { user } = useAuth()
    const [following, setFollowing] = useState(initialIsFollowing || false)
    const [loading, setLoading] = useState(false)

    // Check following status on mount if not provided
    useEffect(() => {
        if (user && targetUserId && initialIsFollowing === undefined) {
            isFollowing(user.uid, targetUserId).then(setFollowing)
        }
    }, [user, targetUserId, initialIsFollowing])

    const handleFollow = async () => {
        if (!user) {
            toast.error('Takip etmek için giriş yapmalısınız')
            return
        }

        // Optimistic update
        const newStatus = !following
        setFollowing(newStatus)
        if (onFollowChange) onFollowChange(newStatus)

        setLoading(true)
        try {
            if (newStatus) {
                await followUser(user.uid, user.displayName || 'Kullanıcı', user.photoURL || null, targetUserId)
                toast.success('Takip edildi')
            } else {
                await unfollowUser(user.uid, targetUserId)
                toast.success('Takip bırakıldı')
            }
        } catch (error) {
            console.error(error)
            // Revert on error
            setFollowing(!newStatus)
            if (onFollowChange) onFollowChange(!newStatus)
            toast.error('İşlem başarısız')
        } finally {
            setLoading(false)
        }
    }

    if (user?.uid === targetUserId) return null

    return (
        <Button
            onClick={handleFollow}
            disabled={loading}
            variant={following ? "secondary" : "default"}
            className={cn("gap-2 min-w-[120px]", className)}
        >
            {following ? (
                <>
                    <Icons.check className="w-4 h-4" />
                    Takip Ediliyor
                </>
            ) : (
                <>
                    <Icons.userPlus className="w-4 h-4" />
                    Takip Et
                </>
            )}
        </Button>
    )
}
