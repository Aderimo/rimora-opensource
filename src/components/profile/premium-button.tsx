'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getUserTier, TIER_INFO, type SubscriptionTier } from '@/lib/subscription'
import { Icons } from '@/components/icons'

export function PremiumButton() {
    const { user } = useAuth()
    const [tier, setTier] = useState<SubscriptionTier>('free')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user) {
            getUserTier(user.uid).then(t => {
                setTier(t)
                setLoading(false)
            })
        } else {
            setLoading(false)
        }
    }, [user])

    if (loading) return null

    const tierInfo = TIER_INFO[tier]
    const isPremium = tier !== 'free'

    return (
        <Link href="/premium">
            <button
                className={`
          relative flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
          transition-all duration-300 overflow-hidden
          ${isPremium
                        ? `bg-gradient-to-r ${tierInfo.gradient} text-white`
                        : 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500'
                    }
        `}
                style={{
                    boxShadow: isPremium
                        ? `0 0 20px ${tierInfo.glowColor}, 0 0 40px ${tierInfo.glowColor}`
                        : '0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2)'
                }}
            >
                {/* Shimmer effect */}
                <div className="absolute inset-0 shimmer" />

                <span className="relative z-10">
                    {isPremium ? tierInfo.crown : <Icons.crown className="h-4 w-4" />}
                </span>
                <span className="relative z-10">
                    {isPremium ? tierInfo.label : 'Premium'}
                </span>
            </button>
        </Link>
    )
}
