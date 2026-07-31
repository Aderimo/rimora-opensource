'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    TIER_PRICING,
    TIER_INFO,
    calculateTierPrice,
    calculateYearlySavings,
    type SubscriptionTier
} from '@/lib/subscription'

type BillingCycle = 'monthly' | 'yearly'

const TIERS: Exclude<SubscriptionTier, 'free'>[] = ['bronze', 'gold', 'diamond', 'ruby']

export default function PremiumPage() {
    const { user } = useAuth()
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
    const [isFirstTime, setIsFirstTime] = useState(true)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function checkFirstTime() {
            if (user) {
                const { hasHadSubscriptionBefore } = await import('@/lib/subscription')
                const hasHad = await hasHadSubscriptionBefore(user.uid)
                setIsFirstTime(!hasHad)
            }
            setLoading(false)
        }
        checkFirstTime()
    }, [user])

    const handleSubscribe = async (tier: Exclude<SubscriptionTier, 'free'>) => {
        if (!user) {
            window.location.href = '/giris?redirect=/premium'
            return
        }

        // Ödeme sayfasına yönlendir
        const price = calculateTierPrice(tier, billingCycle === 'yearly', isFirstTime)
        window.location.href = `/odeme?tier=${tier}&cycle=${billingCycle}&price=${price}`
    }

    return (
        <div className="min-h-screen py-12">
            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-transparent to-pink-500/20" />
                <div className="container mx-auto px-4 py-16 text-center relative">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 text-yellow-500 mb-6">
                        <Icons.crown className="h-5 w-5" />
                        <span className="font-semibold">Premium Deneyim</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Rimora <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500">Premium</span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Reklamsız deneyim, özel profil çerçeveleri, rozet ve daha fazlası için Premium'a geçin.
                    </p>
                </div>
            </div>

            {/* Billing Toggle */}
            <div className="container mx-auto px-4 mb-12">
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={cn(
                            'px-6 py-2 rounded-lg font-medium transition-all',
                            billingCycle === 'monthly'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                        )}
                    >
                        Aylık
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={cn(
                            'px-6 py-2 rounded-lg font-medium transition-all relative',
                            billingCycle === 'yearly'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                        )}
                    >
                        Yıllık
                        {isFirstTime && (
                            <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs whitespace-nowrap">
                                İlk yıl 3 ay bedava!
                            </span>
                        )}
                    </button>
                </div>
                {!isFirstTime && billingCycle === 'yearly' && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                        Daha önce abonelik kullandığınız için standart yıllık fiyat üzerinden devam edeceksiniz.
                    </p>
                )}
            </div>

            {/* Pricing Cards */}
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {TIERS.map((tier) => {
                        const info = TIER_INFO[tier]
                        // Calculate price based on first-time status
                        const price = calculateTierPrice(tier, billingCycle === 'yearly', isFirstTime)

                        // Only show savings if it's first time
                        const savings = billingCycle === 'yearly' && isFirstTime
                            ? calculateYearlySavings(tier)
                            : 0

                        const isPopular = tier === 'gold'

                        return (
                            <div
                                key={tier}
                                className={cn(
                                    'relative rounded-2xl p-6 transition-all hover:scale-105',
                                    isPopular ? 'ring-2 ring-yellow-400' : 'border border-border'
                                )}
                                style={{
                                    background: `linear-gradient(135deg, ${info.color}10, transparent)`,
                                }}
                            >
                                {isPopular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-yellow-400 text-black text-xs font-bold">
                                        En Popüler
                                    </div>
                                )}

                                {/* Header */}
                                <div className="text-center mb-6">
                                    <div
                                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                        style={{
                                            background: `linear-gradient(135deg, ${info.color}, ${info.color}80)`,
                                            boxShadow: `0 0 30px ${info.glowColor}`
                                        }}
                                    >
                                        <span className="text-3xl">{info.crown || '👤'}</span>
                                    </div>
                                    <h3 className="text-xl font-bold" style={{ color: info.color }}>
                                        {info.label}
                                    </h3>
                                </div>

                                {/* Price */}
                                <div className="text-center mb-6">
                                    <div className="flex items-end justify-center gap-1">
                                        <span className="text-4xl font-bold">₺{price}</span>
                                        <span className="text-muted-foreground mb-1">
                                            /{billingCycle === 'yearly' ? 'yıl' : 'ay'}
                                        </span>
                                    </div>
                                    {billingCycle === 'yearly' && isFirstTime && (
                                        <p className="text-sm text-green-500 mt-1">
                                            ₺{savings} tasarruf (3 ay bedava)
                                        </p>
                                    )}
                                    {billingCycle === 'yearly' && !isFirstTime && (
                                        <p className="text-sm text-green-500 mt-1">
                                            12 aylık plan
                                        </p>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 mb-6">
                                    {info.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm">
                                            <Icons.check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <Button
                                    className={cn(
                                        'w-full',
                                        isPopular && 'bg-yellow-400 hover:bg-yellow-500 text-black'
                                    )}
                                    style={!isPopular ? {
                                        background: `linear-gradient(135deg, ${info.color}, ${info.color}80)`
                                    } : undefined}
                                    onClick={() => handleSubscribe(tier)}
                                >
                                    Abone Ol
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Features Section */}
            <div className="container mx-auto px-4 py-20">
                <h2 className="text-3xl font-bold text-center mb-12">Premium Avantajları</h2>
                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 mx-auto mb-4 flex items-center justify-center">
                            <Icons.eye className="h-8 w-8 text-purple-500" />
                        </div>
                        <h3 className="font-semibold mb-2">Reklamsız Deneyim</h3>
                        <p className="text-sm text-muted-foreground">Hiçbir reklam görmeden içerik keyfini çıkarın</p>
                    </div>
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 mx-auto mb-4 flex items-center justify-center">
                            <Icons.crown className="h-8 w-8 text-yellow-500" />
                        </div>
                        <h3 className="font-semibold mb-2">Özel Profil Çerçevesi</h3>
                        <p className="text-sm text-muted-foreground">Profilinizi öne çıkaran animasyonlu çerçeveler</p>
                    </div>
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-pink-500/20 mx-auto mb-4 flex items-center justify-center">
                            <Icons.award className="h-8 w-8 text-pink-500" />
                        </div>
                        <h3 className="font-semibold mb-2">Özel Rozetler</h3>
                        <p className="text-sm text-muted-foreground">Premium kullanıcılara özel rozetler kazanın</p>
                    </div>
                </div>
            </div>

            {/* FAQ */}
            <div className="container mx-auto px-4 pb-20">
                <h2 className="text-2xl font-bold text-center mb-8">Sıkça Sorulan Sorular</h2>
                <div className="max-w-2xl mx-auto space-y-4">
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="font-semibold mb-2">Paramı geri alabilir miyim?</h3>
                        <p className="text-sm text-muted-foreground">
                            İlk 7 gün içinde memnun kalmazsanız tam iade yapılır.
                        </p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="font-semibold mb-2">Aboneliğimi iptal edebilir miyim?</h3>
                        <p className="text-sm text-muted-foreground">
                            Evet, istediğiniz zaman iptal edebilirsiniz. Abonelik dönemi sonuna kadar özellikler aktif kalır.
                        </p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="font-semibold mb-2">Hangi ödeme yöntemlerini kabul ediyorsunuz?</h3>
                        <p className="text-sm text-muted-foreground">
                            Kredi kartı, banka kartı ve online ödeme yöntemlerini kabul ediyoruz. (iyzico)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
