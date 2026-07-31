'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { TIER_INFO, type SubscriptionTier } from '@/lib/subscription'

interface TierAvatarFrameProps {
    tier: SubscriptionTier
    photoURL?: string | null
    displayName?: string
    size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
    sm: { container: 'w-10 h-10', text: 'text-sm', frame: 2 },
    md: { container: 'w-20 h-20', text: 'text-2xl', frame: 3 },
    lg: { container: 'w-28 h-28', text: 'text-4xl', frame: 4 },
}

export function TierAvatarFrame({ tier, photoURL, displayName, size = 'md' }: TierAvatarFrameProps) {
    const tierInfo = TIER_INFO[tier]
    const sizeConfig = SIZES[size]
    const isPremium = tier !== 'free'

    return (
        <div
            className={cn(
                "relative rounded-xl overflow-visible",
                sizeConfig.container
            )}
        >
            {/* Glow effect for premium */}
            {isPremium && (
                <div
                    className="absolute -inset-1 rounded-xl animate-pulse"
                    style={{
                        background: `linear-gradient(135deg, ${tierInfo.frameColor}, transparent, ${tierInfo.frameColor})`,
                        filter: `blur(${sizeConfig.frame * 2}px)`,
                        opacity: 0.6,
                    }}
                />
            )}

            {/* Frame border */}
            <div
                className={cn(
                    "absolute -inset-0.5 rounded-xl",
                    isPremium && "animate-[spin_4s_linear_infinite]"
                )}
                style={{
                    background: isPremium
                        ? `conic-gradient(from 0deg, ${tierInfo.frameColor}, transparent, ${tierInfo.frameColor}, transparent, ${tierInfo.frameColor})`
                        : 'transparent',
                    padding: sizeConfig.frame,
                }}
            />

            {/* Avatar container */}
            <div
                className={cn(
                    "relative rounded-xl overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500",
                    sizeConfig.container
                )}
                style={{
                    border: isPremium ? `${sizeConfig.frame}px solid ${tierInfo.frameColor}` : 'none',
                }}
            >
                {photoURL ? (
                    <Image src={photoURL} alt={displayName || 'Avatar'} fill className="object-cover" sizes="128px" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={cn("font-bold text-white", sizeConfig.text)}>
                            {(displayName || 'U')[0].toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            {/* Crown badge for premium */}
            {isPremium && tierInfo.crown && (
                <div
                    className="absolute -top-2 -right-2 text-lg z-10"
                    style={{ filter: `drop-shadow(0 0 4px ${tierInfo.frameColor})` }}
                >
                    {tierInfo.crown}
                </div>
            )}
        </div>
    )
}
